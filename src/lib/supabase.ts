import { createClient } from "@supabase/supabase-js";

/**
 * Klien Supabase khusus server.
 *
 * Dipakai HANYA di dalam route handler dan server component. Tidak pernah
 * di komponen bertanda "use client" — service role key melewati semua RLS,
 * jadi kalau sampai ikut terkirim ke browser, siapa pun bisa membaca dan
 * mengubah seluruh isi database.
 *
 * Aturan praktisnya: kalau sebuah file punya "use client" di baris pertama,
 * file itu tidak boleh mengimpor file ini.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi. " +
      "Cek Environment Variables di Vercel, atau file .env.local kalau jalan lokal."
  );
}

export const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
