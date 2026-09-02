import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * ============================================================
 * PINTU BELAKANG — HAPUS FOLDER INI SEBELUM SERAH TERIMA KLIEN
 * ============================================================
 *
 * POST /api/dev/gagal
 * Body: { "kode": "KS-0007", "token": "isi DEV_FAIL_TOKEN" }
 *
 * Memaksa satu order menjadi berstatus `gagal` tanpa lewat Midtrans.
 * Gunanya cuma satu: bisa memunculkan kondisi order gagal kapan saja
 * saat memeriksa atau merekam tampilan dashboard, tanpa harus benar-benar
 * menggagalkan pembayaran lebih dulu.
 *
 * Yang perlu diingat:
 *
 * 1. Ini BUKAN pengujian. Karena melewati Midtrans, endpoint ini sama
 *    sekali tidak membuktikan jalur webhook bekerja. Webhook tetap harus
 *    diuji dengan transaksi sungguhan di sandbox.
 *
 * 2. Ini utang. Kalau ikut terbawa ke sistem klien dan tokennya bocor,
 *    orang bisa menandai order gagal sembarangan. Hapus seluruh folder
 *    src/app/api/dev/ sebelum menyerahkan sistem.
 *
 * Endpoint mati sendiri kalau DEV_FAIL_TOKEN kosong.
 */
export async function POST(req: NextRequest) {
  const token = process.env.DEV_FAIL_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "Endpoint nonaktif: DEV_FAIL_TOKEN kosong." },
      { status: 404 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON yang sah." }, { status: 400 });
  }

  if (body?.token !== token) {
    return NextResponse.json({ error: "Token salah." }, { status: 401 });
  }

  const kode = String(body?.kode ?? "").trim();
  if (!kode) {
    return NextResponse.json({ error: "Sertakan kode order, contoh KS-0007." }, { status: 400 });
  }

  const { data, error } = await db
    .from("orders")
    .update({ status_bayar: "gagal", dibayar_pada: null })
    .eq("kode", kode)
    .select("kode, nomor_meja, status_bayar")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: `Order ${kode} tidak ditemukan.` }, { status: 404 });
  }

  return NextResponse.json({ ok: true, order: data });
}
