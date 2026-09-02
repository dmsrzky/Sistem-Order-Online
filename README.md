# Sistem QR Order

Pelanggan scan QR di meja → pilih menu → bayar → pesanan masuk ke layar kasir → laporan penjualan harian.

Next.js 16 · Supabase (Postgres) · Midtrans Snap · Tailwind.

---

## Yang sudah diuji dan yang belum

Jujur soal ini, supaya kamu tahu di mana harus berhati-hati.

**Sudah diuji:**
- Build produksi lolos tanpa error
- Semua halaman merespons 200
- Tanda tangan webhook: yang benar diterima, yang palsu ditolak, nominal yang diubah ditolak
- Pemetaan status Midtrans termasuk status tak dikenal
- Batas hari WIB benar meski server jalan di UTC
- Validasi order: tanpa meja, keranjang kosong, meja ngawur — semua ditolak dengan pesan jelas

**BELUM diuji, harus kamu uji sendiri:**
- Koneksi ke Supabase sungguhan (di sini pakai kredensial palsu)
- Transaksi Midtrans sungguhan dan webhook yang benar-benar sampai
- Tampilan di HP asli

Jalankan `npx tsx periksa.ts` untuk mengulang pemeriksaan logika kapan saja.

---

## Urutan setup

Kerjakan berurutan. Langkah 4 harus setelah langkah 3, karena webhook butuh alamat publik.

### 1 · Database

1. Buat proyek baru di [supabase.com](https://supabase.com) (paket gratis cukup).
2. Buka **SQL Editor → New query**, tempel seluruh isi `supabase/schema.sql`, jalankan.
3. Buka **Table Editor**, pastikan tabel `menu_items` berisi 8 baris.
4. Catat dari **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

> `service_role` melewati semua aturan keamanan database. Kunci ini **tidak boleh** ditempel di mana pun selain environment variable. Jangan pernah menaruhnya di variabel berawalan `NEXT_PUBLIC_`.

### 2 · Kredensial Midtrans

Dashboard Midtrans → pastikan berada di mode **Sandbox** → **Settings → Access Keys**:

- `Server Key` → `MIDTRANS_SERVER_KEY`
- `Client Key` → `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`

Kunci sandbox **biasanya** berawalan `SB-Mid-`, tapi sebagian akun memakai format lama tanpa awalan itu. Jadi jangan menilai dari awalan kunci — **yang menentukan adalah alamat dashboard tempat kamu menyalinnya**:

- `dashboard.sandbox.midtrans.com` → sandbox
- `dashboard.midtrans.com` → produksi

Karena itu ada dua variabel yang harus diisi dengan nilai sama: `MIDTRANS_IS_PRODUCTION` (dipakai server) dan `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION` (dipakai browser untuk memilih skrip Snap). Kalau keduanya berbeda, pembayaran gagal dengan pesan yang tidak menjelaskan apa pun.

### 3 · Deploy

1. Push repo ini ke GitHub.
2. Import ke Vercel.
3. Isi Environment Variables sesuai `.env.example`. `NEXT_PUBLIC_BASE_URL` diisi alamat Vercel setelah deploy pertama — kalau salah, redirect setelah bayar akan mendarat di alamat yang keliru.
4. Deploy. Buka alamatnya, pastikan menu tampil. Kalau menu kosong, berarti kredensial Supabase salah.

### 4 · Sambungkan webhook

Dashboard Midtrans → **Settings → Configuration** → isi **Payment Notification URL**:

```
https://alamat-kamu.vercel.app/api/midtrans/webhook
```

Cek dulu dengan membuka alamat itu di browser. Harus muncul tulisan "Webhook aktif". Kalau 404, alamatnya salah ketik.

### 5 · QR meja

Buka generator QR gratis mana pun, buat kode untuk tiap meja:

```
https://alamat-kamu.vercel.app/menu?meja=01
https://alamat-kamu.vercel.app/menu?meja=02
...sampai 08
```

Cetak, tempel di meja.

---

## Uji sebelum ditunjukkan ke orang

Dari **HP asli**, bukan emulator. Ukuran layar dan cara jempol menekan tidak bisa ditiru emulator.

1. Scan QR meja 07 → menu terbuka, badge "Meja 07" tampil
2. Tambah beberapa item, ubah jumlah, buka keranjang
3. Tekan "Pesan & bayar" → Midtrans terbuka
4. **Sebelum bayar**, buka dashboard di laptop — order sudah muncul berlabel "Belum bayar"
5. Selesaikan pembayaran → dalam ≤5 detik label berubah jadi "Sudah bayar" tanpa refresh
6. Buat order lagi, tutup jendela Midtrans tanpa bayar → order tetap ada di dashboard
7. Tekan "Tandai lunas manual" → berubah jadi "Lunas manual"
8. Buka laporan → penjualan, porsi, menu terlaris terisi

Kalau langkah 5 gagal tapi 4 berhasil, masalahnya di webhook, bukan di aplikasi. Cek **Payment Notification URL** dan lihat log Vercel.

---

## Ganti untuk klien baru

Hanya empat hal. Kalau ternyata harus menyentuh yang lain, strukturnya sudah bocor — perbaiki, jangan ditambal.

1. `src/config/brand.ts` — nama outlet, tagline, warna aksen, awalan kode order
2. **Foto**: timpa file di `public/menu/` dengan **nama yang sama persis**. Tidak ada kode yang perlu diubah.
3. **Menu**: edit tabel `menu_items` lewat Table Editor Supabase. Tidak perlu ngoding.
4. **Env vars**: kredensial Supabase dan Midtrans milik klien

---

## Sebelum serah terima ke klien

Daftar wajib. Ini bukan saran.

- [ ] **Hapus folder `src/app/api/dev/`** — pintu belakang pemicu status gagal. Kalau tokennya bocor, orang bisa menandai order gagal sembarangan.
- [ ] Hapus `periksa.ts` dan `DEV_FAIL_TOKEN` dari environment variables
- [ ] **Beri password ke `/dashboard` dan `/laporan`.** Sekarang keduanya terbuka untuk siapa pun yang tahu alamatnya. Untuk demo itu disengaja supaya calon klien bisa langsung mencoba. Untuk outlet sungguhan, ini tidak boleh.
- [ ] Ganti kredensial Midtrans dari sandbox ke produksi, pakai akun **milik klien**
- [ ] Pindahkan proyek Supabase dan Vercel ke akun klien
- [ ] Pastikan tidak ada satu pun kredensial yang tersisa di akun pribadimu

---

## Catatan keputusan teknis

**Order dibuat sebelum pembayaran, bukan sesudah.** `POST /api/orders` menulis order berstatus `belum_bayar` lebih dulu, baru meminta token Snap. Kalau dibalik, pesanan yang pembayarannya tidak selesai tidak akan punya jejak — dan itu persis kegagalan yang sistem ini dibangun untuk mencegah.

Efek sampingnya disengaja: order `belum_bayar` akan menumpuk dari orang yang berubah pikiran. Kasir yang memutuskan nasibnya, bukan sistem yang diam-diam menghapusnya.

**Webhook hanya mengubah status, tidak pernah membuat order.** Jadi webhook yang tidak sampai berarti order tertahan di "belum bayar", bukan hilang.

**Harga diambil ulang dari database saat checkout.** Harga yang dikirim browser diabaikan. Tanpa ini, siapa pun bisa memesan seharga Rp 0 lewat devtools.

**`status_bayar` dan `status_kerja` dipisah** karena digerakkan pihak berbeda — webhook dan kasir. Order gagal bayar yang terlanjur dimasak adalah kondisi nyata; satu kolom akan menghapus salah satunya.

**Nama dan harga disalin ke `order_items`.** Kalau harga menu diubah bulan depan, laporan bulan ini tidak ikut berubah.

**Polling 3 detik, bukan websocket.** Untuk satu outlet dengan satu layar kasir, websocket menambah koneksi yang harus dijaga hidup tanpa manfaat yang terasa.

**Penjualan hanya menghitung order lunas.** Kalau order gagal ikut dihitung, angka laporan akan lebih besar dari uang di laci — dan sekali itu ketahuan, seluruh laporan tidak lagi dipercaya.

**Tidak pakai `next/font/google`.** Font Google diunduh saat build, jadi deploy bisa gagal kalau jaringan build tidak bisa menjangkau Google. Font sistem juga langsung tampil tanpa permintaan jaringan.

---

## Memicu status gagal saat mencoba tampilan

```bash
curl -X POST https://alamat-kamu.vercel.app/api/dev/gagal \
  -H 'Content-Type: application/json' \
  -d '{"kode":"KS-0007","token":"ISI_DEV_FAIL_TOKEN"}'
```

Ini melewati Midtrans, jadi **tidak membuktikan webhook bekerja**. Gunanya cuma memunculkan tampilan order gagal tanpa harus menggagalkan pembayaran sungguhan.

Endpoint mati sendiri kalau `DEV_FAIL_TOKEN` dikosongkan.

---

## Jalan lokal

```bash
npm install
cp .env.example .env.local   # isi kredensialnya
npm run dev
```

Webhook tidak akan sampai ke localhost. Untuk menguji webhook secara lokal, butuh terowongan seperti ngrok — atau lebih gampang, uji langsung di Vercel.
