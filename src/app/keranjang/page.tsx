"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brand } from "@/config/brand";
import { rupiah } from "@/lib/format";
import { useKeranjang } from "@/lib/keranjang";
import { muatSnap, simpanToken } from "@/lib/snap";

export default function Keranjang() {
  const keranjang = useKeranjang();
  const router = useRouter();
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [snapSiap, setSnapSiap] = useState(false);

  // Skrip Snap dimuat lebih awal di sini supaya popup di halaman status nanti
  // tidak perlu menunggu unduhan. Halaman menu sengaja tidak ikut memuatnya —
  // menu adalah halaman pertama yang dilihat orang, kecepatannya menentukan
  // kesan awal.
  useEffect(() => {
    muatSnap().then(setSnapSiap);
  }, []);

  async function bayar() {
    if (proses) return;
    setProses(true);
    setGalat(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meja: keranjang.meja,
          items: keranjang.items.map((i) => ({ menuId: i.menuId, qty: i.qty })),
        }),
      });

      const data = await res.json();

      if (!data?.kode) {
        setGalat(data?.error ?? "Pesanan gagal dibuat. Coba lagi.");
        setProses(false);
        return;
      }

      const kode: string = data.kode;

      // URUTAN INI DISENGAJA: pindah ke halaman status DULU, popup pembayaran
      // dibuka dari sana.
      //
      // Versi sebelumnya membuka popup di halaman ini dan baru berpindah saat
      // Snap memanggil onSuccess. Untuk QRIS itu tidak bisa diandalkan — popup
      // sering diam di layar "menunggu pembayaran" walaupun uangnya sudah
      // masuk, jadi callbacknya tidak pernah dipanggil dan pelanggan terjebak.
      //
      // Dengan urutan sekarang, apa pun yang terjadi pada popup — hang, ditutup,
      // gagal dimuat — pelanggan sudah berada di halaman status, dan halaman
      // itu menyegarkan sendiri tiap 4 detik.
      if (data.snapToken) simpanToken(kode, data.snapToken);
      keranjang.kosongkan();
      router.push(`/status?kode=${encodeURIComponent(kode)}`);
    } catch {
      setGalat("Jaringan bermasalah. Periksa koneksi lalu coba lagi.");
      setProses(false);
    }
  }

  if (!keranjang.siap) {
    return <div className="p-6 text-sm text-muted">Memuat…</div>;
  }

  if (keranjang.items.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold">Keranjang masih kosong</p>
        <p className="mt-2 text-sm text-muted">Pilih menu dulu untuk mulai memesan.</p>
        <Link
          href={`/menu?meja=${keranjang.meja ?? ""}`}
          className="mt-6 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white"
        >
          Lihat menu
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md pb-40">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <Link
          href={`/menu?meja=${keranjang.meja ?? ""}`}
          aria-label="Kembali ke menu"
          className="text-xl leading-none"
        >
          ←
        </Link>
        <div>
          <p className="text-base font-bold leading-tight">Keranjang</p>
          <p className="text-xs text-muted">
            {brand.namaOutlet} · Meja {keranjang.meja}
          </p>
        </div>
      </header>

      <div className="space-y-3 px-4 pt-4">
        {keranjang.items.map((i) => (
          <article key={i.menuId} className="flex gap-3 rounded-card border border-line bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={i.photo_url}
              alt={i.nama}
              className="h-16 w-16 shrink-0 rounded-lg bg-line object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[15px] font-semibold leading-snug">{i.nama}</p>
                <button
                  onClick={() => keranjang.hapus(i.menuId)}
                  className="shrink-0 text-xs text-muted underline"
                >
                  Hapus
                </button>
              </div>
              <div className="mt-auto flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <button
                    aria-label={`Kurangi ${i.nama}`}
                    onClick={() => keranjang.ubahQty(i.menuId, -1)}
                    className="h-9 w-9 rounded-full border border-line text-lg leading-none"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-sm font-bold">{i.qty}</span>
                  <button
                    aria-label={`Tambah ${i.nama}`}
                    onClick={() => keranjang.ubahQty(i.menuId, 1)}
                    className="h-9 w-9 rounded-full bg-ink text-lg leading-none text-white"
                  >
                    +
                  </button>
                </div>
                <span className="text-sm font-bold">{rupiah(i.harga * i.qty)}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {galat && (
        <p className="mx-4 mt-4 rounded-card border border-gagal/30 bg-gagal/5 p-4 text-sm text-gagal">
          {galat}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-line bg-paper p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted">Total</span>
          <span className="text-xl font-bold">{rupiah(keranjang.total)}</span>
        </div>
        <button
          onClick={bayar}
          disabled={proses}
          className="w-full rounded-full bg-ink py-4 text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {proses ? "Menyiapkan pembayaran…" : "Pesan & bayar"}
        </button>
        <p className="mt-2 text-center text-xs text-muted">
          Pesanan langsung tercatat di kasir sebelum kamu membayar.
        </p>
        {!snapSiap && (
          <p className="mt-1 text-center text-[11px] text-muted">Menyiapkan pembayaran…</p>
        )}
      </div>
    </main>
  );
}
