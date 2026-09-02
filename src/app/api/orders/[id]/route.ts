import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/orders/:id
 *
 * Dua aksi kasir, keduanya di sini karena sama-sama mengubah satu baris order:
 *   { aksi: "status_kerja", nilai: "diproses" | "selesai" | "baru" }
 *   { aksi: "tandai_lunas" }
 *
 * "tandai_lunas" adalah jalur cadangan yang diminta §4 PRD. Dipakai kalau
 * pembayaran gagal di sistem tapi berhasil di dunia nyata, atau kalau
 * customer akhirnya bayar tunai ke kasir. Kolom ditandai_manual dipisah
 * dari status_bayar supaya di laporan tetap kelihatan mana yang lunas
 * lewat Midtrans dan mana yang diputuskan orang.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON yang sah." }, { status: 400 });
  }

  const { id } = await params;

  if (body?.aksi === "status_kerja") {
    const nilai = body?.nilai;
    if (!["baru", "diproses", "selesai"].includes(nilai)) {
      return NextResponse.json({ error: "Status kerja tidak dikenal." }, { status: 400 });
    }

    const { error } = await db.from("orders").update({ status_kerja: nilai }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body?.aksi === "tandai_lunas") {
    const { data, error } = await db
      .from("orders")
      .update({
        status_bayar: "sudah_bayar",
        ditandai_manual: true,
        catatan_manual: typeof body?.catatan === "string" ? body.catatan.slice(0, 200) : null,
        dibayar_pada: new Date().toISOString(),
      })
      .eq("id", id)
      .select("kode")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, kode: data?.kode });
  }

  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
