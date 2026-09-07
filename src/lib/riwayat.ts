/**
 * Riwayat pesanan pelanggan, disimpan di localStorage.
 *
 * Sistem ini tanpa login, jadi tidak ada cara mengetahui "pesanan siapa"
 * selain menyimpannya di HP orangnya sendiri. Yang disimpan cuma kode order —
 * isinya selalu diambil ulang dari server supaya statusnya tidak basi.
 *
 * Konsekuensi yang perlu diketahui saat menjual: kalau pelanggan menghapus
 * riwayat browser atau berganti HP, riwayatnya hilang. Itu memang batas dari
 * sistem tanpa akun, dan pengganti sebenarnya adalah kasir — yang tetap punya
 * semua data di dashboard.
 */

const KUNCI = "ks_riwayat_v1";
const MAKS = 15;

export type EntriRiwayat = { kode: string; meja: string; waktu: number };

export function bacaRiwayat(): EntriRiwayat[] {
  if (typeof window === "undefined") return [];
  try {
    const mentah = window.localStorage.getItem(KUNCI);
    if (!mentah) return [];
    const data = JSON.parse(mentah);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function catatRiwayat(kode: string, meja: string) {
  try {
    const kini = bacaRiwayat().filter((e) => e.kode !== kode);
    const berikutnya = [{ kode, meja, waktu: Date.now() }, ...kini].slice(0, MAKS);
    window.localStorage.setItem(KUNCI, JSON.stringify(berikutnya));
  } catch {
    // Mode penyamaran bisa melarang penulisan. Pesanannya tetap tercatat di
    // kasir — yang hilang cuma kemudahan pelanggan melihatnya sendiri.
  }
}
