import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { tandaTanganValid, petakanStatus } from "@/lib/midtrans";

export const dynamic = "force-dynamic";

/**
 * POST /api/midtrans/webhook
 *
 * Dipanggil oleh server Midtrans, bukan oleh browser. Alamat ini harus
 * didaftarkan di dashboard Midtrans > Settings > Configuration >
 * Payment Notification URL. Sebelum di-deploy ke URL publik, webhook
 * tidak akan pernah sampai — itu sebabnya deploy dikerjakan sebelum
 * menyambungkan pembayaran.
 *
 * Yang boleh dilakukan di sini HANYA mengubah status. Webhook tidak
 * pernah membuat order baru. Order sudah dibuat lebih dulu di
 * POST /api/orders, jadi kalau notifikasi ini tidak pernah datang,
 * ordernya tetap ada di dashboard sebagai "belum bayar".
 */
export async function POST(req: NextRequest) {
  let n: any;
  try {
    n = await req.json();
  } catch {
    return NextResponse.json({ ok: false, alasan: "bukan json" }, { status: 400 });
  }

  if (!tandaTanganValid(n)) {
    // Selalu balas 200. Membalas 4xx membuat Midtrans mencoba lagi
    // berulang kali untuk permintaan palsu yang memang tidak diinginkan.
    console.warn("[webhook] tanda tangan tidak cocok untuk", n?.order_id);
    return NextResponse.json({ ok: false, alasan: "tanda tangan tidak cocok" });
  }

  const orderId: string = n.order_id;
  const status = petakanStatus(n.transaction_status, n.fraud_status);

  const { data: order } = await db
    .from("orders")
    .select("id, status_bayar, ditandai_manual")
    .eq("midtrans_order_id", orderId)
    .single();

  if (!order) {
    console.warn("[webhook] order tidak ditemukan:", orderId);
    return NextResponse.json({ ok: false, alasan: "order tidak ditemukan" });
  }

  // Kalau kasir sudah menandai lunas manual, jangan ditimpa. Uangnya
  // sudah diterima di dunia nyata; notifikasi "expire" yang datang
  // belakangan tidak boleh membatalkan keputusan orang.
  if (order.ditandai_manual) {
    return NextResponse.json({ ok: true, dilewati: "sudah ditandai manual" });
  }

  // Order yang sudah lunas tidak boleh turun statusnya. Midtrans bisa
  // mengirim notifikasi lebih dari sekali dan tidak dijamin urut.
  if (order.status_bayar === "sudah_bayar" && status !== "sudah_bayar") {
    return NextResponse.json({ ok: true, dilewati: "sudah lunas" });
  }

  const { error } = await db
    .from("orders")
    .update({
      status_bayar: status,
      dibayar_pada: status === "sudah_bayar" ? new Date().toISOString() : null,
    })
    .eq("id", order.id);

  if (error) {
    // Balas 500 supaya Midtrans mencoba mengirim ulang.
    console.error("[webhook] gagal menyimpan:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}

/** Membuka alamat ini di browser membantu memastikan deploy-nya hidup. */
export async function GET() {
  return NextResponse.json({
    pesan: "Webhook aktif. Daftarkan alamat ini di Midtrans sebagai Payment Notification URL.",
  });
}
