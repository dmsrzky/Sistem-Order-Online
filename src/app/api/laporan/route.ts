import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { rentangHariIni } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * GET /api/laporan — ringkasan hari ini.
 *
 * Aturan angka: yang dihitung sebagai penjualan HANYA order lunas,
 * termasuk yang ditandai lunas manual oleh kasir. Order gagal dan belum
 * bayar tetap dikirim untuk ditampilkan di daftar transaksi, tapi tidak
 * ikut menambah rupiah.
 *
 * Kalau order gagal ikut dihitung, angka laporan akan lebih besar dari
 * uang di laci. Itu hal pertama yang ketahuan pemilik outlet, dan sekali
 * ketahuan, seluruh laporan tidak lagi dipercaya.
 */
export async function GET() {
  const { mulai, selesai, tanggal } = rentangHariIni();

  const { data, error } = await db
    .from("orders")
    .select(
      "id, kode, nomor_meja, total, status_bayar, status_kerja, ditandai_manual, dibuat_pada, order_items(nama, harga, qty)"
    )
    .gte("dibuat_pada", mulai)
    .lt("dibuat_pada", selesai)
    .order("dibuat_pada", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const semua = (data ?? []).map((o: any) => ({
    ...o,
    items: o.order_items ?? [],
    order_items: undefined,
  }));

  const lunas = semua.filter((o) => o.status_bayar === "sudah_bayar");

  const totalPenjualan = lunas.reduce((n, o) => n + o.total, 0);
  const porsiTerjual = lunas.reduce(
    (n, o) => n + o.items.reduce((m: number, i: any) => m + i.qty, 0),
    0
  );

  // Menu terlaris dihitung dari order lunas saja, dengan alasan yang sama.
  const hitung = new Map<string, { nama: string; qty: number; rupiah: number }>();
  for (const o of lunas) {
    for (const i of o.items) {
      const k = hitung.get(i.nama) ?? { nama: i.nama, qty: 0, rupiah: 0 };
      k.qty += i.qty;
      k.rupiah += i.harga * i.qty;
      hitung.set(i.nama, k);
    }
  }
  const terlaris = [...hitung.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  return NextResponse.json({
    tanggal,
    totalPenjualan,
    porsiTerjual,
    jumlahTransaksi: lunas.length,
    jumlahBermasalah: semua.length - lunas.length,
    terlaris,
    transaksi: semua,
  });
}
