"use client";

import { useCallback, useEffect, useState } from "react";
import type { ItemKeranjang } from "./types";

const KUNCI = "ks_keranjang_v1";

/**
 * Keranjang disimpan di localStorage, bukan di state React saja.
 *
 * Alasannya praktis: customer membuka Midtrans di halaman yang sama, lalu
 * kembali. Kalau keranjang cuma ada di memori, satu kali kembali dari
 * halaman pembayaran sudah cukup untuk menghapus semuanya. Nomor meja
 * ikut disimpan supaya tidak hilang saat berpindah dari menu ke keranjang.
 */

type Isi = { meja: string | null; items: ItemKeranjang[] };

function baca(): Isi {
  if (typeof window === "undefined") return { meja: null, items: [] };
  try {
    const mentah = window.localStorage.getItem(KUNCI);
    if (!mentah) return { meja: null, items: [] };
    const data = JSON.parse(mentah);
    return {
      meja: typeof data?.meja === "string" ? data.meja : null,
      items: Array.isArray(data?.items) ? data.items : [],
    };
  } catch {
    return { meja: null, items: [] };
  }
}

function tulis(isi: Isi) {
  try {
    window.localStorage.setItem(KUNCI, JSON.stringify(isi));
  } catch {
    // Mode penyamaran di iOS bisa melarang penulisan. Keranjang tetap
    // jalan selama satu halaman; itu lebih baik daripada halaman mati.
  }
}

export function useKeranjang() {
  const [isi, setIsi] = useState<Isi>({ meja: null, items: [] });
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    setIsi(baca());
    setSiap(true);
  }, []);

  const simpan = useCallback((berikutnya: Isi) => {
    setIsi(berikutnya);
    tulis(berikutnya);
  }, []);

  const setMeja = useCallback(
    (meja: string) => simpan({ ...baca(), meja }),
    [simpan]
  );

  const tambah = useCallback(
    (item: Omit<ItemKeranjang, "qty">) => {
      const kini = baca();
      const items = [...kini.items];
      const idx = items.findIndex((i) => i.menuId === item.menuId);
      if (idx >= 0) items[idx] = { ...items[idx], qty: items[idx].qty + 1 };
      else items.push({ ...item, qty: 1 });
      simpan({ ...kini, items });
    },
    [simpan]
  );

  const ubahQty = useCallback(
    (menuId: number, delta: number) => {
      const kini = baca();
      const items = kini.items
        .map((i) => (i.menuId === menuId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0);
      simpan({ ...kini, items });
    },
    [simpan]
  );

  const hapus = useCallback(
    (menuId: number) => {
      const kini = baca();
      simpan({ ...kini, items: kini.items.filter((i) => i.menuId !== menuId) });
    },
    [simpan]
  );

  const kosongkan = useCallback(() => {
    const kini = baca();
    simpan({ meja: kini.meja, items: [] });
  }, [simpan]);

  const jumlahItem = isi.items.reduce((n, i) => n + i.qty, 0);
  const total = isi.items.reduce((n, i) => n + i.harga * i.qty, 0);

  return { ...isi, siap, jumlahItem, total, setMeja, tambah, ubahQty, hapus, kosongkan };
}
