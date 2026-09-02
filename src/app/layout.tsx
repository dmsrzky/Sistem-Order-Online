import type { Metadata, Viewport } from "next";
import { brand } from "@/config/brand";
import "./globals.css";

/**
 * Sengaja TIDAK memakai next/font/google.
 *
 * Dua alasan. Pertama, next/font mengunduh font saat build — artinya deploy
 * bisa gagal kalau jaringan build tidak bisa menjangkau Google, dan pesan
 * errornya tidak jelas. Kedua, font sistem langsung tampil tanpa satu pun
 * permintaan jaringan; di wifi cafe yang lambat itu selisih yang terasa.
 *
 * Kalau nanti mau font khusus, taruh file .woff2 di /public/fonts dan pakai
 * next/font/local — tetap tanpa jaringan saat build.
 */

export const metadata: Metadata = {
  title: `${brand.namaOutlet} — pesan dari meja`,
  description: brand.tagline,
  robots: { index: false, follow: false },
};

/**
 * viewportFit + maximumScale=1 mencegah iOS Safari memperbesar halaman
 * otomatis saat orang menyentuh tombol. Tanpa ini, halaman melompat-lompat
 * saat dipakai dari HP — dan itu langsung terlihat sebagai sistem murahan.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF8F5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
