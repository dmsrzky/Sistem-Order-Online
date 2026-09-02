import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { buatTransaksiSnap } from "@/lib/midtrans";
import { normalkanMeja } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders          — daftar order untuk dashboard (polling tiap 3 detik)
 * GET /api/orders?kode=KS-0001 — satu order, untuk halaman status customer
 *
 * Order gagal dan belum bayar IKUT terkirim. Itu inti dari aturan §4 PRD:
 * tidak ada order yang hilang tanpa jejak, apa pun hasil pembayarannya.
 */
export async function GET(req: NextRequest) {
  const kode = req.nextUrl.searchParams.get("kode");

  if (kode) {
    const { data, error } = await db
      .from("orders")
      .select(
        "id, kode, nomor_meja, total, status_bayar, status_kerja, ditandai_manual, dibuat_pada, dibayar_pada, order_items(nama, harga, qty)"
      )
      .eq("kode", kode)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });

    return NextResponse.json({
      order: { ...data, items: (data as any).order_items ?? [] },
    });
  }

  const { data, error } = await db
    .from("orders")
    .select(
      "id, kode, nomor_meja, total, status_bayar, status_kerja, ditandai_manual, dibuat_pada, dibayar_pada, order_items(nama, harga, qty)"
    )
    .order("dibuat_pada", { ascending: false })
    .limit(60);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orders = (data ?? []).map((o: any) => ({
    ...o,
    items: o.order_items ?? [],
    order_items: undefined,
  }));

  return NextResponse.json({ orders });
}

/**
 * POST /api/orders — dipanggil saat customer menekan "Pesan & bayar".
 *
 * URUTANNYA PENTING: order ditulis ke database DULU, token Midtrans
 * diminta SESUDAHNYA. Kalau dibalik, order yang pembayarannya tidak
 * pernah diselesaikan tidak akan pernah ada jejaknya — dan itu persis
 * kegagalan yang bikin sistem ini dibangun (uang keluar, pesanan hilang).
 *
 * Konsekuensinya: order berstatus belum_bayar akan menumpuk dari orang
 * yang membuka menu lalu berubah pikiran. Itu memang disengaja. Kasir
 * yang memutuskan, bukan sistem yang menyembunyikan.
 */
export async function POST(req: NextRequest) {
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON yang sah." }, { status: 400 });
  }

  const meja = normalkanMeja(payload?.meja);
  if (!meja) {
    return NextResponse.json({ error: "Nomor meja tidak valid." }, { status: 400 });
  }

  const diminta: Array<{ menuId: number; qty: number }> = Array.isArray(payload?.items)
    ? payload.items
    : [];
  if (diminta.length === 0) {
    return NextResponse.json({ error: "Keranjang kosong." }, { status: 400 });
  }

  // Harga diambil ulang dari database, TIDAK dipercaya dari browser.
  // Kalau harga dikirim dari sisi customer, siapa pun bisa memesan
  // dengan harga Rp 0 lewat devtools.
  const ids = [...new Set(diminta.map((i) => Number(i.menuId)).filter(Number.isFinite))];
  const { data: menu, error: errMenu } = await db
    .from("menu_items")
    .select("id, nama, harga, tersedia")
    .in("id", ids);

  if (errMenu) {
    return NextResponse.json({ error: errMenu.message }, { status: 500 });
  }

  const peta = new Map((menu ?? []).map((m) => [m.id, m]));
  const baris: Array<{ menu_id: number; nama: string; harga: number; qty: number }> = [];

  for (const i of diminta) {
    const m = peta.get(Number(i.menuId));
    const qty = Math.floor(Number(i.qty));
    if (!m || !m.tersedia) continue;
    if (!Number.isFinite(qty) || qty < 1 || qty > 99) continue;
    baris.push({ menu_id: m.id, nama: m.nama, harga: m.harga, qty });
  }

  if (baris.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada item yang bisa dipesan. Coba muat ulang halaman menu." },
      { status: 400 }
    );
  }

  const total = baris.reduce((n, b) => n + b.harga * b.qty, 0);

  const { data: kodeData, error: errKode } = await db.rpc("next_order_kode");
  if (errKode || !kodeData) {
    return NextResponse.json(
      { error: errKode?.message ?? "Gagal membuat kode order." },
      { status: 500 }
    );
  }
  const kode: string = kodeData as string;

  const { data: order, error: errOrder } = await db
    .from("orders")
    .insert({
      kode,
      nomor_meja: meja,
      total,
      status_bayar: "belum_bayar",
      status_kerja: "baru",
      midtrans_order_id: kode,
    })
    .select("id, kode")
    .single();

  if (errOrder || !order) {
    return NextResponse.json(
      { error: errOrder?.message ?? "Gagal menyimpan order." },
      { status: 500 }
    );
  }

  const { error: errItems } = await db
    .from("order_items")
    .insert(baris.map((b) => ({ ...b, order_id: order.id })));

  if (errItems) {
    // Order tanpa item tidak ada gunanya dan bikin laporan salah.
    await db.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: errItems.message }, { status: 500 });
  }

  // Order sudah aman tersimpan. Mulai dari titik ini, kegagalan apa pun
  // di Midtrans tidak lagi bisa menghilangkan pesanan.
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    req.nextUrl.origin;

  try {
    const snap = await buatTransaksiSnap({
      orderId: kode,
      items: baris.map((b) => ({
        id: String(b.menu_id),
        nama: b.nama,
        harga: b.harga,
        qty: b.qty,
      })),
      nomorMeja: meja,
      baseUrl,
    });

    return NextResponse.json({
      kode,
      total,
      snapToken: snap.token,
      redirectUrl: snap.redirect_url,
    });
  } catch (e: any) {
    // Midtrans gagal, tapi ordernya sudah ada di dashboard. Kasir bisa
    // menyelesaikan manual. Customer diberi tahu apa yang harus dilakukan,
    // bukan dibiarkan menatap layar error.
    return NextResponse.json(
      {
        kode,
        total,
        snapToken: null,
        error:
          "Pesanan sudah tercatat, tapi halaman pembayaran gagal dibuka. " +
          "Tunjukkan kode " + kode + " ke kasir.",
        detail: String(e?.message ?? e),
      },
      { status: 502 }
    );
  }
}

/**
 * PATCH /api/orders — dua aksi kasir, id order dikirim di body.
 *
 *   { id, aksi: "status_kerja", nilai: "diproses" | "selesai" | "baru" }
 *   { id, aksi: "tandai_lunas", catatan?: string }
 *
 * Sengaja TIDAK memakai segmen dinamis /api/orders/[id]. Folder berkurung
 * siku sempat membuat pengecekan tipe gagal saat build di Vercel padahal
 * lolos di mesin lokal. Menaruh id di body menghilangkan seluruh kelas
 * masalah itu tanpa mengubah apa pun yang dirasakan pemakai.
 *
 * "tandai_lunas" adalah jalur cadangan yang diminta §4 PRD: dipakai kalau
 * pembayaran gagal di sistem tapi berhasil di dunia nyata, atau kalau
 * customer akhirnya bayar tunai. Kolom ditandai_manual dipisah dari
 * status_bayar supaya di laporan tetap kelihatan mana yang lunas lewat
 * Midtrans dan mana yang diputuskan orang.
 */
export async function PATCH(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON yang sah." }, { status: 400 });
  }

  const id = String(body?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "Sertakan id order." }, { status: 400 });
  }

  if (body?.aksi === "status_kerja") {
    if (!["baru", "diproses", "selesai"].includes(body?.nilai)) {
      return NextResponse.json({ error: "Status kerja tidak dikenal." }, { status: 400 });
    }
    const { error } = await db
      .from("orders")
      .update({ status_kerja: body.nilai })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body?.aksi === "tandai_lunas") {
    const { data, error } = await db
      .from("orders")
      .update({
        status_bayar: "sudah_bayar",
        ditandai_manual: true,
        catatan_manual:
          typeof body?.catatan === "string" ? body.catatan.slice(0, 200) : null,
        dibayar_pada: new Date().toISOString(),
      })
      .eq("id", id)
      .select("kode")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, kode: data?.kode });
  }

  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
