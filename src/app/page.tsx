import Link from "next/link";
import { brand } from "@/config/brand";

/**
 * Halaman depan. Bukan bagian dari 5 layar produk — ini pintu masuk demo,
 * supaya link yang dikirim ke calon klien tidak mendarat di halaman 404.
 * Saat dijual ke klien, halaman ini diganti atau dialihkan ke /menu.
 */
export default function Beranda() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-muted">Demo sistem</p>
      <h1 className="mt-2 text-3xl font-bold leading-tight">{brand.namaOutlet}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{brand.tagline}</p>

      <div className="mt-8 space-y-3">
        <Link
          href="/menu?meja=07"
          className="block rounded-card bg-ink px-5 py-4 text-white"
        >
          <span className="block text-[15px] font-semibold">Buka sebagai pelanggan</span>
          <span className="mt-0.5 block text-xs opacity-70">
            Sama dengan hasil scan QR di meja 07
          </span>
        </Link>

        <Link
          href="/dashboard"
          className="block rounded-card border border-line bg-white px-5 py-4"
        >
          <span className="block text-[15px] font-semibold">Buka sebagai kasir</span>
          <span className="mt-0.5 block text-xs text-muted">
            Pesanan masuk otomatis tanpa perlu refresh
          </span>
        </Link>

        <Link
          href="/laporan"
          className="block rounded-card border border-line bg-white px-5 py-4"
        >
          <span className="block text-[15px] font-semibold">Lihat laporan penjualan</span>
          <span className="mt-0.5 block text-xs text-muted">
            Penjualan, porsi terjual, dan menu terlaris hari ini
          </span>
        </Link>
      </div>

      <p className="mt-10 text-xs leading-relaxed text-muted">
        Buka halaman pelanggan di HP dan halaman kasir di laptop secara
        bersamaan untuk melihat pesanan masuk secara langsung.
      </p>
    </main>
  );
}
