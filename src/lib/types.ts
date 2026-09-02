export type StatusBayar = "belum_bayar" | "sudah_bayar" | "gagal";
export type StatusKerja = "baru" | "diproses" | "selesai";

export type MenuItem = {
  id: number;
  nama: string;
  deskripsi: string | null;
  harga: number;
  photo_url: string;
  tersedia: boolean;
};

export type MenuKategori = {
  id: number;
  nama: string;
  items: MenuItem[];
};

export type OrderItem = {
  nama: string;
  harga: number;
  qty: number;
};

export type Order = {
  id: string;
  kode: string;
  nomor_meja: string;
  total: number;
  status_bayar: StatusBayar;
  status_kerja: StatusKerja;
  ditandai_manual: boolean;
  dibuat_pada: string;
  dibayar_pada: string | null;
  items: OrderItem[];
};

/** Isi keranjang di sisi customer. Disimpan di localStorage. */
export type ItemKeranjang = {
  menuId: number;
  nama: string;
  harga: number;
  qty: number;
  photo_url: string;
};

export const LABEL_BAYAR: Record<StatusBayar, string> = {
  belum_bayar: "Belum bayar",
  sudah_bayar: "Sudah bayar",
  gagal: "Gagal",
};

export const LABEL_KERJA: Record<StatusKerja, string> = {
  baru: "Baru",
  diproses: "Diproses",
  selesai: "Selesai",
};
