/**
 * Pemuat skrip Midtrans Snap.
 *
 * Dipisah ke file sendiri karena sekarang dipakai dua halaman: keranjang
 * (memuat lebih awal supaya tidak menunggu) dan status (yang benar-benar
 * membuka popupnya).
 */

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        opsi: {
          onSuccess?: () => void;
          onPending?: () => void;
          onError?: () => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

const KUNCI_TOKEN = "ks_snap_token";

/**
 * Sandbox atau produksi dinyatakan eksplisit lewat env var, TIDAK ditebak dari
 * awalan client key. Sebagian akun Midtrans memakai format lama yang kunci
 * sandbox-nya juga berawalan "Mid-" tanpa "SB-" — menebak dari awalan akan
 * memuat skrip produksi sementara server menembak sandbox.
 */
function sumberSkrip(): string {
  const produksi = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true";
  return produksi
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";
}

export function muatSnap(): Promise<boolean> {
  return new Promise((selesai) => {
    if (typeof window === "undefined") return selesai(false);
    if (window.snap) return selesai(true);

    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;
    if (!clientKey) return selesai(false);

    const src = sumberSkrip();
    const adaSebelumnya = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`
    );

    if (adaSebelumnya) {
      adaSebelumnya.addEventListener("load", () => selesai(Boolean(window.snap)));
      // Kalau skripnya sudah selesai dimuat sebelum listener terpasang,
      // event "load" tidak akan datang lagi.
      if (window.snap) selesai(true);
      return;
    }

    const s = document.createElement("script");
    s.src = src;
    s.setAttribute("data-client-key", clientKey);
    s.onload = () => selesai(Boolean(window.snap));
    s.onerror = () => selesai(false);
    document.body.appendChild(s);
  });
}

/**
 * Token Snap dititipkan lewat sessionStorage saat berpindah dari keranjang
 * ke halaman status. sessionStorage dipilih, bukan localStorage, supaya token
 * ikut hilang saat tab ditutup — token ini hanya berlaku 30 menit dan tidak
 * ada gunanya bertahan lebih lama.
 */
export function simpanToken(kode: string, token: string) {
  try {
    sessionStorage.setItem(KUNCI_TOKEN, JSON.stringify({ kode, token }));
  } catch {
    // Mode penyamaran bisa melarang penulisan. Popup tidak terbuka otomatis,
    // tapi pelanggan tetap mendarat di halaman status dengan kode ordernya.
  }
}

export function ambilToken(kode: string): string | null {
  try {
    const mentah = sessionStorage.getItem(KUNCI_TOKEN);
    if (!mentah) return null;
    const data = JSON.parse(mentah);
    return data?.kode === kode && typeof data?.token === "string" ? data.token : null;
  } catch {
    return null;
  }
}

export function hapusToken() {
  try {
    sessionStorage.removeItem(KUNCI_TOKEN);
  } catch {
    /* abaikan */
  }
}
