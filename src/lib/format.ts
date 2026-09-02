import { brand } from "@/config/brand";

export function rupiah(nilai: number): string {
  return "Rp " + Math.round(nilai).toLocaleString("id-ID");
}

/** Jam:menit dalam zona waktu outlet, bukan zona waktu server. */
export function jam(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: brand.zonaWaktu,
  });
}

export function tanggalPanjang(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: brand.zonaWaktu,
  });
}

/**
 * Awal dan akhir "hari ini" menurut jam dinding outlet.
 *
 * Ini bukan detail sepele. Server Vercel jalan di UTC. Kalau batas hari
 * dihitung pakai UTC, laporan penjualan akan berganti hari jam 7 pagi WIB —
 * transaksi sarapan masuk ke tanggal kemarin, dan angkanya tidak akan pernah
 * cocok dengan uang di laci.
 *
 * Cara kerjanya: cari tahu tanggal berapa "sekarang" di Jakarta, lalu ubah
 * tengah malam Jakarta itu kembali ke UTC untuk dipakai query.
 */
export function rentangHariIni(): { mulai: string; selesai: string; tanggal: string } {
  const sekarang = new Date();

  // "2026-08-29" menurut jam Jakarta
  const tanggal = new Intl.DateTimeFormat("en-CA", {
    timeZone: brand.zonaWaktu,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(sekarang);

  const offset = offsetZona(sekarang);
  const mulai = new Date(`${tanggal}T00:00:00${offset}`);
  const selesai = new Date(mulai.getTime() + 24 * 60 * 60 * 1000);

  return {
    mulai: mulai.toISOString(),
    selesai: selesai.toISOString(),
    tanggal: mulai.toISOString(),
  };
}

/** Offset zona outlet dalam bentuk "+07:00". Dihitung, tidak dihardcode. */
function offsetZona(pada: Date): string {
  const utc = new Date(pada.toLocaleString("en-US", { timeZone: "UTC" }));
  const lokal = new Date(pada.toLocaleString("en-US", { timeZone: brand.zonaWaktu }));
  const menit = Math.round((lokal.getTime() - utc.getTime()) / 60000);
  const tanda = menit >= 0 ? "+" : "-";
  const abs = Math.abs(menit);
  const jj = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${tanda}${jj}:${mm}`;
}

/** "07" dari "7", "7 " atau "meja 7". Nomor meja datang dari URL, jadi kotor. */
export function normalkanMeja(mentah: string | null | undefined): string | null {
  if (!mentah) return null;
  const angka = mentah.replace(/\D/g, "");
  if (!angka) return null;
  const n = parseInt(angka, 10);
  if (!Number.isFinite(n) || n < 1 || n > 99) return null;
  return String(n).padStart(2, "0");
}
