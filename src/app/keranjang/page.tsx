"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brand } from "@/config/brand";
import { rupiah } from "@/lib/format";
import { useKeranjang } from "@/lib/keranjang";

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        opsi: {
          onSuccess?: () => void;
          onPending?: () => void;
          onError?: () => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

export default function Keranjang() {
  const keranjang = useKeranjang();
  const router = useRouter();
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [snapSiap, setSnapSiap] = useState(false);

  // Skrip Snap dimuat sekali di sini, bukan di layout, supaya halaman menu
  // tidak ikut menunggu skrip pihak ketiga. Menu adalah halaman pertama yang
  // dilihat orang; kecepatannya menentukan kesan awal.
  useEffect(() => {
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
    if (!clientKey) return;

    // Sandbox atau produksi dinyatakan eksplisit lewat env var, TIDAK ditebak
    // dari awalan client key. Sebagian akun Midtrans memakai format kunci lama
    // yang sandbox-nya juga berawalan "Mid-" tanpa "SB-", jadi menebak dari
    // awalan bisa memuat skrip Snap produksi sementara server memakai sandbox.
    // Gejalanya: pembayaran gagal dengan pesan yang tidak menjelaskan apa pun.
    const produksi = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";

    const src = produksi
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";

    if (document.querySelector(`script[src="${src}"]`)) {
      setSnapSiap(true);
      return;
    }

    const s = document.createElement("script");
    s.src = src;
    s.setAttribute("data-client-key", clientKey);
    s.onload = () => setSnapSiap(true);
    document.body.appendChild(s);
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

      // Bahkan saat Midtrans gagal, kode order sudah ada. Bawa customer ke
      // halaman status supaya dia punya kode untuk ditunjukkan ke kasir —
      // jangan tinggalkan dia di layar error tanpa pegangan.
      if (!data?.kode) {
        setGalat(data?.error ?? "Pesanan gagal dibuat. Coba lagi.");
        setProses(false);
        return;
      }

      const kode: string = data.kode;

      if (!data.snapToken || !window.snap) {
        keranjang.kosongkan();
        router.push(`/status?kode=${encodeURIComponent(kode)}`);
        return;
      }

      window.snap.pay(data.snapToken, {
        onSuccess: () => {
          keranjang.kosongkan();
          router.push(`/status?kode=${encodeURIComponent(kode)}`);
        },
        onPending: () => {
          keranjang.kosongkan();
          router.push(`/status?kode=${encodeURIComponent(kode)}`);
        },
        onError: () => {
          keranjang.kosongkan();
          router.push(`/status?kode=${encodeURIComponent(kode)}`);
        },
        // onClose = orang menutup jendela pembayaran. Pesanannya tetap ada.
        // Ini persis skenario "uang keluar tapi pesanan hilang" yang sistem
        // ini dibangun untuk mencegah, jadi jangan diam-diam dibuang.
        onClose: () => {
          keranjang.kosongkan();
          router.push(`/status?kode=${encodeURIComponent(kode)}`);
        },
      });
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
