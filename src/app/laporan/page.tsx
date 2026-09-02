"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { brand } from "@/config/brand";
import { rupiah, jam, tanggalPanjang } from "@/lib/format";
import type { Order } from "@/lib/types";
import { LABEL_BAYAR } from "@/lib/types";

type Laporan = {
  tanggal: string;
  totalPenjualan: number;
  porsiTerjual: number;
  jumlahTransaksi: number;
  jumlahBermasalah: number;
  terlaris: Array<{ nama: string; qty: number; rupiah: number }>;
  transaksi: Order[];
};

export default function Halaman() {
  const [data, setData] = useState<Laporan | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    const ambil = () =>
      fetch("/api/laporan", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d.error) throw new Error(d.error);
          setData(d);
        })
        .catch(() => setGalat("Laporan tidak bisa dimuat. Muat ulang halaman."));

    ambil();
    const t = window.setInterval(ambil, 10000);
    return () => window.clearInterval(t);
  }, []);

  if (galat) return <p className="p-8 text-sm text-gagal">{galat}</p>;
  if (!data) return <p className="p-8 text-sm text-muted">Memuat laporan…</p>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-5">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold leading-tight">Laporan hari ini</h1>
          <p className="text-sm text-muted">
            {tanggalPanjang(data.tanggal)} · {brand.labelZonaWaktu}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-full border border-line bg-white px-4 py-1.5 text-sm font-semibold"
        >
          Pesanan masuk
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Angka label="Penjualan" nilai={rupiah(data.totalPenjualan)} besar />
        <Angka label="Porsi terjual" nilai={String(data.porsiTerjual)} />
        <Angka label="Transaksi lunas" nilai={String(data.jumlahTransaksi)} />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted">
        Angka penjualan hanya menghitung pesanan lunas, termasuk yang ditandai
        lunas manual oleh kasir.
        {data.jumlahBermasalah > 0 && (
          <>
            {" "}
            {data.jumlahBermasalah} pesanan belum lunas hari ini dan tidak ikut
            dihitung — bisa dilihat di daftar bawah.
          </>
        )}
      </p>

      {data.terlaris.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
            Menu terlaris
          </h2>
          <div className="overflow-hidden rounded-card border border-line bg-white">
            {data.terlaris.map((m, n) => (
              <div
                key={m.nama}
                className="flex items-center justify-between border-b border-line px-4 py-3 last:border-0"
              >
                <span className="flex items-center gap-3 text-sm">
                  <span className="w-4 text-right font-mono text-xs text-muted">{n + 1}</span>
                  <span className="font-semibold">{m.nama}</span>
                </span>
                <span className="text-sm">
                  <span className="font-bold">{m.qty} porsi</span>
                  <span className="ml-3 text-muted">{rupiah(m.rupiah)}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
          Transaksi hari ini
        </h2>
        {data.transaksi.length === 0 ? (
          <div className="rounded-card border border-dashed border-line py-12 text-center text-sm text-muted">
            Belum ada transaksi hari ini.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-semibold">Kode</th>
                  <th className="px-4 py-3 font-semibold">Meja</th>
                  <th className="px-4 py-3 font-semibold">Jam</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.transaksi.map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{t.kode}</td>
                    <td className="px-4 py-3">{t.nomor_meja}</td>
                    <td className="px-4 py-3">{jam(t.dibuat_pada)}</td>
                    <td
                      className="px-4 py-3 font-semibold"
                      style={{ color: WARNA[t.status_bayar] }}
                    >
                      {t.ditandai_manual ? "Lunas manual" : LABEL_BAYAR[t.status_bayar]}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{rupiah(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Angka({ label, nilai, besar }: { label: string; nilai: string; besar?: boolean }) {
  return (
    <div className="rounded-card border border-line bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-bold ${besar ? "text-2xl" : "text-xl"}`}>{nilai}</p>
    </div>
  );
}

const WARNA: Record<string, string> = {
  sudah_bayar: "#155F3B",
  belum_bayar: "#7A5405",
  gagal: "#8C1D18",
};
