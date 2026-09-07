"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { brand } from "@/config/brand";
import { rupiah, jam } from "@/lib/format";
import { bacaRiwayat } from "@/lib/riwayat";
import type { Order, StatusBayar, StatusKerja } from "@/lib/types";

/**
 * "Pesanan saya" — daftar pesanan yang pernah dibuat dari HP ini.
 *
 * Menyegarkan diri tiap 5 detik supaya keadaan pengerjaan ikut berubah saat
 * kasir menggesernya, tanpa pelanggan perlu memuat ulang halaman.
 */
export default function Pesanan() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selesaiMuat, setSelesaiMuat] = useState(false);
  const [meja, setMeja] = useState<string | null>(null);

  useEffect(() => {
    const riwayat = bacaRiwayat();
    setMeja(riwayat[0]?.meja ?? null);

    if (riwayat.length === 0) {
      setSelesaiMuat(true);
      return;
    }

    const kodes = riwayat.map((r) => r.kode).join(",");
    let hidup = true;

    const ambil = async () => {
      try {
        const res = await fetch(`/api/orders?kodes=${encodeURIComponent(kodes)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (hidup && Array.isArray(data.orders)) setOrders(data.orders);
      } catch {
        // Pertahankan tampilan terakhir kalau jaringan sedang bermasalah.
      } finally {
        if (hidup) setSelesaiMuat(true);
      }
    };

    ambil();
    const t = window.setInterval(ambil, 5000);
    return () => {
      hidup = false;
      window.clearInterval(t);
    };
  }, []);

  if (!selesaiMuat) {
    return <p className="p-8 text-center text-sm text-muted">Memuat pesanan…</p>;
  }

  return (
    <main className="mx-auto max-w-md px-4 py-5">
      <header className="mb-4 flex items-center gap-3 border-b border-line pb-4">
        <Link
          href={`/menu?meja=${meja ?? ""}`}
          aria-label="Kembali ke menu"
          className="text-xl leading-none"
        >
          ←
        </Link>
        <div>
          <h1 className="text-lg font-bold leading-tight">Pesanan saya</h1>
          <p className="text-xs text-muted">{brand.namaOutlet}</p>
        </div>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-card border border-dashed border-line py-14 text-center">
          <p className="text-base font-semibold">Belum ada pesanan</p>
          <p className="mt-1 px-6 text-sm leading-relaxed text-muted">
            Pesanan yang kamu buat dari HP ini akan tersimpan di sini.
          </p>
          <Link
            href={`/menu?meja=${meja ?? ""}`}
            className="mt-5 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white"
          >
            Lihat menu
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link
              key={o.kode}
              href={`/status?kode=${encodeURIComponent(o.kode)}`}
              className="block rounded-card border border-line bg-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm font-bold">{o.kode}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Meja {o.nomor_meja} · {jam(o.dibuat_pada)} {brand.labelZonaWaktu}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={GAYA_BAYAR[o.status_bayar]}
                >
                  {o.ditandai_manual ? "Lunas" : LABEL_BAYAR_SINGKAT[o.status_bayar]}
                </span>
              </div>

              <p className="mt-2 line-clamp-2 text-sm text-muted">
                {o.items.map((i) => `${i.qty}× ${i.nama}`).join(", ")}
              </p>

              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <span className="text-xs font-semibold">{LABEL_KERJA[o.status_kerja]}</span>
                <span className="text-sm font-bold">{rupiah(o.total)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

const LABEL_BAYAR_SINGKAT: Record<StatusBayar, string> = {
  sudah_bayar: "Lunas",
  belum_bayar: "Belum bayar",
  gagal: "Gagal",
};

/** Keadaan dapur ditulis dari sudut pandang pelanggan, bukan istilah kasir. */
const LABEL_KERJA: Record<StatusKerja, string> = {
  baru: "Diterima dapur",
  diproses: "Sedang disiapkan",
  selesai: "Sudah siap",
};

const GAYA_BAYAR: Record<StatusBayar, { backgroundColor: string; color: string }> = {
  sudah_bayar: { backgroundColor: "#EAF6EF", color: "#155F3B" },
  belum_bayar: { backgroundColor: "#FDF6E3", color: "#7A5405" },
  gagal: { backgroundColor: "#FCEDEC", color: "#8C1D18" },
};
