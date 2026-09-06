import crypto from "crypto";
import type { StatusBayar } from "./types";

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";

const SNAP_URL = isProduction
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";

export type ItemSnap = { id: string; nama: string; harga: number; qty: number };

/**
 * Minta token Snap ke Midtrans.
 *
 * gross_amount HARUS sama persis dengan jumlah item_details, kalau tidak
 * Midtrans menolak dengan error 400 yang pesannya tidak membantu. Karena
 * itu total dihitung ulang di sini dari item, bukan dipercaya dari luar.
 */
export async function buatTransaksiSnap(opts: {
  orderId: string;
  items: ItemSnap[];
  nomorMeja: string;
  baseUrl: string;
}): Promise<{ token: string; redirect_url: string }> {
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY belum diisi di environment variables.");
  }

  const total = opts.items.reduce((n, i) => n + i.harga * i.qty, 0);

  /**
   * Batasi metode pembayaran yang ditampilkan Snap.
   *
   * Diisi lewat env var supaya bisa berbeda per klien tanpa mengubah kode.
   * Kosongkan untuk menampilkan semua metode yang aktif di akun Midtrans.
   *
   * Untuk QRIS saja: MIDTRANS_ENABLED_PAYMENTS=other_qris
   *
   * CATATAN: nama kanal di Midtrans bisa berubah dan aku belum memverifikasi
   * "other_qris" pada akun sandbox-mu. Kalau setelah diisi daftar metodenya
   * jadi kosong, kosongkan env var ini dan atur lewat dashboard Midtrans di
   * Settings > Snap Preferences — itu sumber yang pasti benar.
   */
  const kanal = (process.env.MIDTRANS_ENABLED_PAYMENTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const body: Record<string, unknown> = {
    transaction_details: {
      order_id: opts.orderId,
      gross_amount: total,
    },
    item_details: opts.items.map((i) => ({
      id: i.id,
      name: i.nama.slice(0, 50), // Midtrans memotong di 50 karakter
      price: i.harga,
      quantity: i.qty,
    })),
    customer_details: {
      first_name: `Meja ${opts.nomorMeja}`,
    },
    callbacks: {
      finish: `${opts.baseUrl}/status?kode=${encodeURIComponent(opts.orderId)}`,
    },
    expiry: {
      unit: "minutes",
      duration: 30,
    },
  };

  if (kanal.length > 0) body.enabled_payments = kanal;

  const auth = Buffer.from(`${serverKey}:`).toString("base64");

  const res = await fetch(SNAP_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const pesan = Array.isArray(data?.error_messages)
      ? data.error_messages.join("; ")
      : JSON.stringify(data);
    throw new Error(`Midtrans menolak permintaan (${res.status}): ${pesan}`);
  }

  return { token: data.token, redirect_url: data.redirect_url };
}

/**
 * Verifikasi bahwa notifikasi benar-benar datang dari Midtrans.
 *
 * Tanpa ini, siapa pun yang tahu alamat webhook bisa mengirim JSON palsu
 * dan menandai order mana pun sebagai lunas. URL webhook itu publik —
 * tidak rahasia. Tanda tangan inilah satu-satunya pengaman.
 */
export function tandaTanganValid(n: {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
}): boolean {
  if (!serverKey || !n.signature_key) return false;

  const bahan = `${n.order_id}${n.status_code}${n.gross_amount}${serverKey}`;
  const hitung = crypto.createHash("sha512").update(bahan).digest("hex");

  // Perbandingan waktu-tetap. Perbandingan biasa membocorkan informasi
  // lewat lama waktu eksekusi.
  const a = Buffer.from(hitung);
  const b = Buffer.from(n.signature_key);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Terjemahkan status Midtrans ke tiga status yang dipakai sistem ini.
 * Status apa pun yang tidak dikenali dianggap belum_bayar — sengaja
 * memilih sisi yang aman, karena "belum bayar" masih bisa diperbaiki
 * kasir, sedangkan salah menandai lunas berarti kehilangan uang.
 */
export function petakanStatus(
  transactionStatus?: string,
  fraudStatus?: string
): StatusBayar {
  switch (transactionStatus) {
    case "settlement":
      return "sudah_bayar";
    case "capture":
      return fraudStatus === "challenge" ? "belum_bayar" : "sudah_bayar";
    case "deny":
    case "cancel":
    case "expire":
    case "failure":
      return "gagal";
    case "pending":
    default:
      return "belum_bayar";
  }
}
