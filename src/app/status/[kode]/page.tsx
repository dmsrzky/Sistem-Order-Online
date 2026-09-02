import Link from "next/link";
import { db } from "@/lib/supabase";
import { brand } from "@/config/brand";
import { rupiah, jam } from "@/lib/format";
import type { StatusBayar } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Halaman yang dilihat customer setelah keluar dari Midtrans.
 *
 * Tiga kondisi, tiga pesan berbeda — dan tidak satu pun yang berbunyi
 * "pesanan hilang". Selama order ada di database, customer diberi kode
 * yang bisa ditunjukkan ke kasir. Itu satu-satunya hal yang benar-benar
 * dia butuhkan saat pembayaran bermasalah.
 */
export default async function Status({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;

  const { data: order } = await db
    .from("orders")
    .select("kode, nomor_meja, total, status_bayar, dibuat_pada, order_items(nama, harga, qty)")
    .eq("kode", kode)
    .single();

  if (!order) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold">Pesanan tidak ditemukan</p>
        <p className="mt-2 text-sm text-muted">
          Kode {kode} tidak ada di sistem. Tunjukkan layar ini ke kasir.
        </p>
      </main>
    );
  }

  const items = (order as any).order_items ?? [];
  const tampilan = TAMPILAN[order.status_bayar as StatusBayar];

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div
        className="rounded-card border p-6 text-center"
        style={{ borderColor: tampilan.garis, backgroundColor: tampilan.latar }}
      >
        <p className="text-4xl leading-none">{tampilan.ikon}</p>
        <p className="mt-3 text-lg font-bold" style={{ color: tampilan.teks }}>
          {tampilan.judul}
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: tampilan.teks }}>
          {tampilan.pesan}
        </p>
      </div>

      <div className="mt-4 rounded-card border border-line bg-white p-5">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <span className="text-xs uppercase tracking-wide text-muted">Kode pesanan</span>
          <span className="font-mono text-lg font-bold">{order.kode}</span>
        </div>

        <div className="flex justify-between py-2 text-sm">
          <span className="text-muted">Meja</span>
          <span className="font-semibold">{order.nomor_meja}</span>
        </div>
        <div className="flex justify-between pb-3 text-sm">
          <span className="text-muted">Jam</span>
          <span className="font-semibold">
            {jam(order.dibuat_pada)} {brand.labelZonaWaktu}
          </span>
        </div>

        <div className="border-t border-line pt-3">
          {items.map((i: any, n: number) => (
            <div key={n} className="flex justify-between py-1 text-sm">
              <span>
                {i.qty}× {i.nama}
              </span>
              <span className="text-muted">{rupiah(i.harga * i.qty)}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-between border-t border-line pt-3">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-lg font-bold">{rupiah(order.total)}</span>
        </div>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        Simpan atau screenshot layar ini. Kode di atas adalah bukti pesananmu
        di sistem {brand.namaSingkat}.
      </p>

      <Link
        href={`/menu?meja=${order.nomor_meja}`}
        className="mt-4 block rounded-full border border-line bg-white py-3 text-center text-sm font-semibold"
      >
        Pesan lagi
      </Link>
    </main>
  );
}

const TAMPILAN: Record<
  StatusBayar,
  { ikon: string; judul: string; pesan: string; latar: string; garis: string; teks: string }
> = {
  sudah_bayar: {
    ikon: "✓",
    judul: "Pembayaran diterima",
    pesan: "Pesananmu sudah masuk ke kasir dan sedang disiapkan. Tunggu di meja.",
    latar: "#EAF6EF",
    garis: "#BFE3CE",
    teks: "#155F3B",
  },
  belum_bayar: {
    ikon: "•",
    judul: "Menunggu pembayaran",
    pesan:
      "Pesananmu sudah tercatat di kasir. Kalau kamu merasa sudah membayar, " +
      "tunjukkan kode di bawah ke kasir — pesananmu tidak hilang.",
    latar: "#FDF6E3",
    garis: "#EFD9A3",
    teks: "#7A5405",
  },
  gagal: {
    ikon: "!",
    judul: "Pembayaran tidak berhasil",
    pesan:
      "Pesananmu tetap tercatat di kasir. Tunjukkan kode di bawah untuk " +
      "membayar langsung, atau minta kasir mengulang pembayaran.",
    latar: "#FCEDEC",
    garis: "#F0C4C1",
    teks: "#8C1D18",
  },
};
