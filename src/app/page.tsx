"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { brand } from "@/config/brand";
import { rupiah, jam } from "@/lib/format";
import type { Order, StatusBayar, StatusKerja } from "@/lib/types";
import { LABEL_BAYAR } from "@/lib/types";

const JEDA_POLLING = 3000;

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [siap, setSiap] = useState(false);
  const [offline, setOffline] = useState(false);
  const [saring, setSaring] = useState<"aktif" | "semua">("aktif");
  const [sibuk, setSibuk] = useState<string | null>(null);

  // Dipakai untuk menandai kartu yang baru muncul. Tanpa penanda, order
  // baru menyelinap masuk di tengah daftar dan kasir tidak sadar ada
  // pesanan masuk — masalah nyata di outlet yang ramai.
  const dikenal = useRef<Set<string>>(new Set());
  const [baru, setBaru] = useState<Set<string>>(new Set());

  const ambil = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const masuk: Order[] = data.orders ?? [];
      setOffline(false);

      if (dikenal.current.size > 0) {
        const barusan = masuk.filter((o) => !dikenal.current.has(o.id)).map((o) => o.id);
        if (barusan.length > 0) {
          setBaru((s) => new Set([...s, ...barusan]));
          window.setTimeout(() => {
            setBaru((s) => {
              const n = new Set(s);
              barusan.forEach((id) => n.delete(id));
              return n;
            });
          }, 2600);
        }
      }
      masuk.forEach((o) => dikenal.current.add(o.id));

      setOrders(masuk);
      setSiap(true);
    } catch {
      // Jangan kosongkan daftar saat jaringan putus. Kasir lebih baik
      // melihat data lama yang ditandai basi daripada layar kosong.
      setOffline(true);
      setSiap(true);
    }
  }, []);

  useEffect(() => {
    ambil();
    const t = window.setInterval(ambil, JEDA_POLLING);
    return () => window.clearInterval(t);
  }, [ambil]);

  async function ubah(id: string, body: Record<string, unknown>) {
    setSibuk(id);
    // Perbarui tampilan lebih dulu supaya tombol terasa langsung merespons.
    // Polling berikutnya akan mengoreksi kalau ternyata gagal.
    setOrders((s) =>
      s.map((o) =>
        o.id !== id
          ? o
          : body.aksi === "tandai_lunas"
          ? { ...o, status_bayar: "sudah_bayar" as StatusBayar, ditandai_manual: true }
          : { ...o, status_kerja: body.nilai as StatusKerja }
      )
    );
    try {
      await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      setSibuk(null);
      ambil();
    }
  }

  const tampil =
    saring === "aktif" ? orders.filter((o) => o.status_kerja !== "selesai") : orders;

  const perluPerhatian = orders.filter(
    (o) => o.status_bayar !== "sudah_bayar" && o.status_kerja !== "selesai"
  ).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-5">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold leading-tight">Pesanan masuk</h1>
          <p className="text-sm text-muted">
            {brand.namaOutlet} · diperbarui otomatis tiap 3 detik
          </p>
        </div>

        <div className="flex items-center gap-2">
          {offline && (
            <span className="rounded-full bg-gagal/10 px-3 py-1.5 text-xs font-semibold text-gagal">
              Koneksi terputus — data mungkin sudah lama
            </span>
          )}
          {perluPerhatian > 0 && (
            <span className="rounded-full bg-belum/10 px-3 py-1.5 text-xs font-semibold text-belum">
              {perluPerhatian} perlu diperiksa
            </span>
          )}
          <Link
            href="/laporan"
            className="rounded-full border border-line bg-white px-4 py-1.5 text-sm font-semibold"
          >
            Laporan
          </Link>
        </div>
      </header>

      <div className="mb-4 flex gap-2">
        {(["aktif", "semua"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSaring(s)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
              saring === s ? "border-ink bg-ink text-white" : "border-line bg-white text-muted"
            }`}
          >
            {s === "aktif" ? "Belum selesai" : "Semua hari ini"}
          </button>
        ))}
      </div>

      {!siap && <p className="py-16 text-center text-sm text-muted">Memuat pesanan…</p>}

      {siap && tampil.length === 0 && (
        <div className="rounded-card border border-dashed border-line py-16 text-center">
          <p className="text-base font-semibold">Belum ada pesanan</p>
          <p className="mt-1 text-sm text-muted">
            Pesanan dari meja akan muncul di sini secara otomatis.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tampil.map((o) => (
          <KartuOrder
            key={o.id}
            order={o}
            baru={baru.has(o.id)}
            sibuk={sibuk === o.id}
            onUbah={ubah}
          />
        ))}
      </div>
    </main>
  );
}

function KartuOrder({
  order,
  baru,
  sibuk,
  onUbah,
}: {
  order: Order;
  baru: boolean;
  sibuk: boolean;
  onUbah: (id: string, body: Record<string, unknown>) => void;
}) {
  const bermasalah = order.status_bayar !== "sudah_bayar";
  const gaya = GAYA_BAYAR[order.status_bayar];

  return (
    <article
      className={`rounded-card border bg-white p-4 ${baru ? "kartu-baru" : ""}`}
      style={{ borderColor: bermasalah ? gaya.garis : "#E8E2DA" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold leading-none">Meja {order.nomor_meja}</p>
          <p className="mt-1 font-mono text-xs text-muted">
            {order.kode} · {jam(order.dibuat_pada)}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ backgroundColor: gaya.latar, color: gaya.teks }}
        >
          {order.ditandai_manual ? "Lunas manual" : LABEL_BAYAR[order.status_bayar]}
        </span>
      </div>

      <ul className="mt-3 space-y-0.5 border-t border-line pt-3 text-sm">
        {order.items.map((i, n) => (
          <li key={n} className="flex justify-between">
            <span>
              <span className="font-semibold">{i.qty}×</span> {i.nama}
            </span>
            <span className="text-muted">{rupiah(i.harga * i.qty)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-2 border-t border-line pt-2 text-right text-base font-bold">
        {rupiah(order.total)}
      </p>

      {bermasalah && (
        <button
          onClick={() => onUbah(order.id, { aksi: "tandai_lunas" })}
          disabled={sibuk}
          className="mt-3 w-full rounded-lg border py-2.5 text-sm font-semibold disabled:opacity-50"
          style={{ borderColor: gaya.garis, color: gaya.teks, backgroundColor: gaya.latar }}
        >
          Tandai lunas manual
        </button>
      )}

      <div className="mt-3 flex gap-2">
        {(["baru", "diproses", "selesai"] as const).map((s) => (
          <button
            key={s}
            onClick={() => onUbah(order.id, { aksi: "status_kerja", nilai: s })}
            disabled={sibuk}
            className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize disabled:opacity-50 ${
              order.status_kerja === s
                ? "border-ink bg-ink text-white"
                : "border-line bg-white text-muted"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </article>
  );
}

const GAYA_BAYAR: Record<StatusBayar, { latar: string; garis: string; teks: string }> = {
  sudah_bayar: { latar: "#EAF6EF", garis: "#BFE3CE", teks: "#155F3B" },
  belum_bayar: { latar: "#FDF6E3", garis: "#EFD9A3", teks: "#7A5405" },
  gagal: { latar: "#FCEDEC", garis: "#E8A9A4", teks: "#8C1D18" },
};
