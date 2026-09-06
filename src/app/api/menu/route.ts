import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** GET /api/menu — kategori beserta itemnya, sudah terurut. */
export async function GET() {
  const { data, error } = await db
    .from("menu_categories")
    .select("id, nama, urutan, menu_items(id, nama, deskripsi, harga, photo_url, tersedia, urutan)")
    .order("urutan", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const kategori = (data ?? []).map((k: any) => ({
    id: k.id,
    nama: k.nama,
    // Item habis TIDAK disaring keluar. Menyembunyikannya membuat pelanggan
    // mencari-cari lalu bertanya ke pelayan — persis pekerjaan yang sistem ini
    // seharusnya kurangi. Ditampilkan abu-abu jauh lebih berguna.
    items: (k.menu_items ?? []).sort((a: any, b: any) => a.urutan - b.urutan),
  }));

  return NextResponse.json({ kategori });
}
