"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { brand } from "@/config/brand";
import { rupiah, normalkanMeja } from "@/lib/format";
import { useKeranjang } from "@/lib/keranjang";
import type { MenuKategori } from "@/lib/types";

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
  const keranjang = useKeranjang();

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
          <div className="min-w-0">
            <p className="truncate text-base font-bold leading-tight">{brand.namaOutlet}</p>
            <p className="truncate text-xs text-muted">{brand.tagline}</p>
          </div>
          <span
            className="ml-3 shrink-0 rounded-full px-3 py-1.5 text-sm font-bold text-ink"
            style={{ backgroundColor: brand.warnaAksen }}
          >
            Meja {meja}
          </span>
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

      {kategori.map((k) => (
        <section key={k.id} id={`kat-${k.id}`} className="scroll-mt-32 px-4 pt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            {k.nama}
          </h2>
          <div className="space-y-3">
            {k.items.map((item) => {
              const diKeranjang = keranjang.items.find((i) => i.menuId === item.id);
              return (
                <article
                  key={item.id}
                  className="flex gap-3 rounded-card border border-line bg-white p-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.photo_url}
                    alt={item.nama}
                    className="h-20 w-20 shrink-0 rounded-lg bg-line object-cover"
                    loading="lazy"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-[15px] font-semibold leading-snug">{item.nama}</p>
                    {item.deskripsi && (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">
                        {item.deskripsi}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="text-sm font-bold">{rupiah(item.harga)}</span>
                      {diKeranjang ? (
                        <div className="flex items-center gap-3">
                          <button
                            aria-label={`Kurangi ${item.nama}`}
                            onClick={() => keranjang.ubahQty(item.id, -1)}
                            className="h-9 w-9 rounded-full border border-line text-lg leading-none"
                          >
                            −
                          </button>
                          <span className="w-4 text-center text-sm font-bold">
                            {diKeranjang.qty}
                          </span>
                          <button
                            aria-label={`Tambah ${item.nama}`}
                            onClick={() => keranjang.ubahQty(item.id, 1)}
                            className="h-9 w-9 rounded-full bg-ink text-lg leading-none text-white"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            keranjang.tambah({
                              menuId: item.id,
                              nama: item.nama,
                              harga: item.harga,
                              photo_url: item.photo_url,
                            })
                          }
                          className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white"
                        >
                          Tambah
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
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
