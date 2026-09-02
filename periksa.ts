/**
 * Pemeriksaan cepat logika yang tidak butuh database.
 * Jalankan: npx tsx periksa.ts
 * File ini boleh dihapus; tidak dipakai aplikasi.
 */
import crypto from "crypto";
import { rentangHariIni, normalkanMeja, rupiah } from "./src/lib/format";
import { petakanStatus, tandaTanganValid } from "./src/lib/midtrans";

let gagal = 0;
function cek(nama: string, aktual: unknown, harap: unknown) {
  const ok = JSON.stringify(aktual) === JSON.stringify(harap);
  if (!ok) gagal++;
  console.log(`${ok ? "OK  " : "GAGAL"} ${nama}${ok ? "" : ` → dapat ${JSON.stringify(aktual)}, harap ${JSON.stringify(harap)}`}`);
}

console.log("\n-- nomor meja dari URL --");
cek("angka biasa", normalkanMeja("7"), "07");
cek("sudah berimbuhan nol", normalkanMeja("07"), "07");
cek("ada teks", normalkanMeja("meja 3"), "03");
cek("kosong ditolak", normalkanMeja(""), null);
cek("bukan angka ditolak", normalkanMeja("abc"), null);
cek("di luar rentang ditolak", normalkanMeja("0"), null);

console.log("\n-- rupiah --");
cek("ribuan", rupiah(26000), "Rp 26.000");
cek("pecahan dibulatkan", rupiah(1999.6), "Rp 2.000");

console.log("\n-- pemetaan status Midtrans --");
cek("settlement", petakanStatus("settlement"), "sudah_bayar");
cek("capture biasa", petakanStatus("capture", "accept"), "sudah_bayar");
cek("capture ditahan", petakanStatus("capture", "challenge"), "belum_bayar");
cek("expire", petakanStatus("expire"), "gagal");
cek("deny", petakanStatus("deny"), "gagal");
cek("pending", petakanStatus("pending"), "belum_bayar");
cek("status asing dianggap belum bayar", petakanStatus("entah-apa"), "belum_bayar");

console.log("\n-- tanda tangan webhook --");
const serverKey = process.env.MIDTRANS_SERVER_KEY!;
const n = { order_id: "KS-0001", status_code: "200", gross_amount: "26000.00" };
const sah = crypto
  .createHash("sha512")
  .update(`${n.order_id}${n.status_code}${n.gross_amount}${serverKey}`)
  .digest("hex");
cek("tanda tangan benar diterima", tandaTanganValid({ ...n, signature_key: sah }), true);
cek("tanda tangan salah ditolak", tandaTanganValid({ ...n, signature_key: "a".repeat(128) }), false);
cek("tanpa tanda tangan ditolak", tandaTanganValid(n), false);
cek("nominal diubah ditolak", tandaTanganValid({ ...n, gross_amount: "1.00", signature_key: sah }), false);

console.log("\n-- batas hari WIB --");
const r = rentangHariIni();
const mulai = new Date(r.mulai);
const jamJakarta = mulai.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false });
cek("hari dimulai tengah malam Jakarta", jamJakarta, "00:00:00");
const panjangJam = (new Date(r.selesai).getTime() - mulai.getTime()) / 3600000;
cek("rentangnya 24 jam", panjangJam, 24);
console.log(`     info: sekarang UTC ${new Date().toISOString()}, rentang mulai ${r.mulai}`);

console.log(gagal === 0 ? "\nSemua pemeriksaan lolos.\n" : `\n${gagal} pemeriksaan GAGAL.\n`);
process.exit(gagal === 0 ? 0 : 1);
