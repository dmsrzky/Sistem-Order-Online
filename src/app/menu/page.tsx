"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { brand } from "@/config/brand";
import { rupiah, normalkanMeja } from "@/lib/format";
import { useKeranjang } from "@/lib/keranjang";
import { bacaRiwayat } from "@/lib/riwayat";
import type { MenuItem, MenuKategori } from "@/lib/types";

export default function Halaman() {
  return (
    <Suspense fallback={<Memuat />}>
      <Menu />
    </Suspense>
  );
}

function Memuat() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted">
      Memuat menu…
    </div>
  );
}

function Menu() {
  const params = useSearchParams();
  const mejaUrl = normalkanMeja(params.get("meja"));

  const [kategori, setKategori] = useState<MenuKategori[]>([]);
  const [aktif, setAktif] = useState<number | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [adaRiwayat, setAdaRiwayat] = useState(false);
  const keranjang = useKeranjang();

  useEffect(() => {
    setAdaRiwayat(bacaRiwayat().length > 0);
  }, []);

  useEffect(() => {
    if (mejaUrl) keranjang.setMeja(mejaUrl);
  }, [mejaUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setKategori(d.kategori ?? []);
        setAktif(d.kategori?.[0]?.id ?? null);
      })
      .catch(() => setGalat("Menu tidak bisa dimuat. Periksa koneksi, lalu muat ulang."));
  }, []);

  const meja = mejaUrl ?? keranjang.meja;

  // Tanpa nomor meja, pesanan tidak tahu harus diantar ke mana. Lebih baik
  // berhenti di sini dengan instruksi jelas daripada membuat order yatim.
  if (keranjang.siap && !meja) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-semibold">Nomor meja tidak terbaca</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Scan ulang kode QR yang menempel di meja. Kalau kodenya rusak,
          beri tahu kasir.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md pb-28">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="min-w-0 truncate text-base font-bold leading-tight">
            {brand.namaOutlet}
          </p>
          <div className="ml-3 flex shrink-0 items-center gap-2">
            {adaRiwayat && (
              <Link
                href="/pesanan"
                className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold"
              >
                Pesanan
              </Link>
            )}
            <span
              className="rounded-full px-3 py-1.5 text-sm font-bold text-ink"
              style={{ backgroundColor: brand.warnaAksen }}
            >
              Meja {meja}
            </span>
          </div>
        </div>

        {kategori.length > 0 && (
          <div className="sembunyi-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
            {kategori.map((k) => (
              <button
                key={k.id}
                onClick={() => {
                  setAktif(k.id);
                  document.getElementById(`kat-${k.id}`)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  aktif === k.id
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-muted"
                }`}
              >
                {k.nama}
              </button>
            ))}
          </div>
        )}
      </header>

      {galat && (
        <p className="mx-4 mt-6 rounded-card border border-gagal/30 bg-gagal/5 p-4 text-sm text-gagal">
          {galat}
        </p>
      )}

      {brand.banner && (
        <section className="px-4 pt-4">
          <div className="relative overflow-hidden rounded-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brand.banner.gambar}
              alt=""
              className="aspect-[16/9] w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/80 to-transparent px-3 pb-3 pt-10">
              <p className="text-sm font-bold text-white">{brand.banner.judul}</p>
              <p className="mt-0.5 text-xs leading-snug text-white/80">
                {brand.banner.teks}
              </p>
            </div>
          </div>
        </section>
      )}

      {kategori.map((k) => (
        <section key={k.id} id={`kat-${k.id}`} className="scroll-mt-32 px-4 pt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            {k.nama}
          </h2>
          {/* Grid dua kolom, foto persegi besar. Daftar satu kolom dengan foto
              kecil membuat makanan terlihat murah — dan foto makanan itulah
              yang sebenarnya menjual, bukan tata letaknya. */}
          <div className="grid grid-cols-2 gap-3">
            {k.items.map((item) => (
              <KartuMenu
                key={item.id}
                item={item}
                qty={keranjang.items.find((i) => i.menuId === item.id)?.qty ?? 0}
                onTambah={() =>
                  keranjang.tambah({
                    menuId: item.id,
                    nama: item.nama,
                    harga: item.harga,
                    photo_url: item.photo_url,
                  })
                }
                onUbah={(d) => keranjang.ubahQty(item.id, d)}
              />
            ))}
          </div>
        </section>
      ))}

      {keranjang.jumlahItem > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Link
            href="/keranjang"
            className="flex items-center justify-between rounded-full bg-ink px-6 py-4 text-white shadow-lg"
          >
            <span className="text-sm font-semibold">
              Keranjang · {keranjang.jumlahItem} item
            </span>
            <span className="text-sm font-bold">{rupiah(keranjang.total)}</span>
          </Link>
        </div>
      )}
    </main>
  );
}

function KartuMenu({
  item,
  qty,
  onTambah,
  onUbah,
}: {
  item: MenuItem;
  qty: number;
  onTambah: () => void;
  onUbah: (delta: number) => void;
}) {
  const habis = !item.tersedia;

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-card border border-line bg-white ${
        habis ? "opacity-60" : ""
      }`}
    >
      <div className="relative aspect-square w-full bg-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.photo_url}
          alt={item.nama}
          className={`h-full w-full object-cover ${habis ? "grayscale" : ""}`}
          loading="lazy"
        />
        {habis && (
          <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1 text-center text-[11px] font-bold uppercase tracking-wide text-white">
            Habis hari ini
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="text-[14px] font-semibold leading-snug">{item.nama}</p>
        {item.deskripsi && (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted">
            {item.deskripsi}
          </p>
        )}

        <p className="mt-auto pt-2 text-[15px] font-bold">{rupiah(item.harga)}</p>

        <div className="mt-2">
          {habis ? (
            <p className="py-2 text-center text-xs text-muted">Tidak tersedia</p>
          ) : qty > 0 ? (
            <div className="flex items-center justify-between">
              <button
                aria-label={`Kurangi ${item.nama}`}
                onClick={() => onUbah(-1)}
                className="h-11 w-11 rounded-full border border-line text-lg leading-none"
              >
                −
              </button>
              <span className="text-sm font-bold">{qty}</span>
              <button
                aria-label={`Tambah ${item.nama}`}
                onClick={() => onUbah(1)}
                className="h-11 w-11 rounded-full bg-ink text-lg leading-none text-white"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={onTambah}
              className="w-full rounded-full bg-ink py-3 text-sm font-semibold text-white"
            >
              Tambah
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
