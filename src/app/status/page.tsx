"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { brand } from "@/config/brand";
import { rupiah, jam } from "@/lib/format";
import type { Order, StatusBayar } from "@/lib/types";

export default function Halaman() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Memuat…</div>}>
      <Status />
    </Suspense>
  );
}

/**
 * Halaman yang dilihat customer setelah keluar dari Midtrans.
 *
 * Alamatnya /status?kode=KS-0001, bukan /status/KS-0001 — segmen dinamis
 * dihindari karena sempat menggagalkan pengecekan tipe saat build.
 *
 * Tiga kondisi, tiga pesan berbeda, dan tidak satu pun berbunyi "pesanan
 * hilang". Selama order ada di database, customer diberi kode yang bisa
 * ditunjukkan ke kasir. Itu satu-satunya hal yang benar-benar dia butuhkan
 * saat pembayaran bermasalah.
 *
 * Halaman ini menyegarkan diri tiap 4 detik selama status masih menggantung,
 * supaya customer melihat "Pembayaran diterima" begitu webhook sampai —
 * tanpa harus me-refresh sendiri.
 */
function Status() {
  const kode = useSearchParams().get("kode") ?? "";
  const [order, setOrder] = useState<Order | null>(null);
  const [selesaiMuat, setSelesaiMuat] = useState(false);

  useEffect(() => {
    if (!kode) {
      setSelesaiMuat(true);
      return;
    }

    let hidup = true;

    const ambil = async () => {
      try {
        const res = await fetch(`/api/orders?kode=${encodeURIComponent(kode)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!hidup) return;
        if (data.order) setOrder(data.order);
      } catch {
        // Biarkan tampilan terakhir. Jangan tampilkan error hanya karena
        // satu permintaan gagal — customer sedang menunggu kepastian.
      } finally {
        if (hidup) setSelesaiMuat(true);
      }
    };

    ambil();
    const t = window.setInterval(ambil, 4000);
    return () => {
      hidup = false;
      window.clearInterval(t);
    };
  }, [kode]);

  if (!selesaiMuat) {
    return <div className="p-8 text-center text-sm text-muted">Memuat pesanan…</div>;
  }

  if (!order) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold">Pesanan tidak ditemukan</p>
        <p className="mt-2 text-sm text-muted">
          {kode ? `Kode ${kode} tidak ada di sistem.` : "Kode pesanan tidak terbaca."}{" "}
          Tunjukkan layar ini ke kasir.
        </p>
      </main>
    );
  }

  const t = TAMPILAN[order.status_bayar as StatusBayar];

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div
        className="rounded-card border p-6 text-center"
        style={{ borderColor: t.garis, backgroundColor: t.latar }}
      >
        <p className="text-4xl leading-none">{t.ikon}</p>
        <p className="mt-3 text-lg font-bold" style={{ color: t.teks }}>
          {order.ditandai_manual ? "Sudah diselesaikan kasir" : t.judul}
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: t.teks }}>
          {t.pesan}
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
          {order.items.map((i, n) => (
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
