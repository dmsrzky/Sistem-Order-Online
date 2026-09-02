/**
 * Satu-satunya file yang perlu diubah saat ganti klien.
 *
 * Selain file ini, yang berubah hanya:
 *   1. Isi tabel menu_items di Supabase (lewat Table Editor, tanpa ngoding)
 *   2. Foto di /public/menu/ (timpa file dengan nama sama)
 *   3. Env vars (kredensial Supabase & Midtrans milik klien)
 *
 * Tidak ada yang lain. Kalau ternyata harus menyentuh file di luar daftar
 * ini untuk ganti klien, itu tanda strukturnya sudah bocor — perbaiki.
 */

export const brand = {
  namaOutlet: "Kopi Studio",
  tagline: "Pesan dari meja, tanpa antre di kasir",

  /** Dipakai di halaman status & laporan. Ganti sesuai klien. */
  namaSingkat: "Kopi Studio",

  /** Awalan kode order. Ubah agar cocok dengan nama outlet klien. */
  prefixKode: "KS",

  /**
   * Warna aksen. Dipakai untuk badge nomor meja dan kategori aktif.
   * Sengaja hanya satu warna — sisanya hitam-putih supaya foto makanan
   * yang jadi pusat perhatian, bukan antarmukanya.
   */
  warnaAksen: "#E0A32E",

  /** Logo teks. Kalau klien punya file logo, taruh di /public/logo.png. */
  logoUrl: null as string | null,

  /** Zona waktu untuk semua perhitungan "hari ini" di laporan. */
  zonaWaktu: "Asia/Jakarta",
  labelZonaWaktu: "WIB",
};
