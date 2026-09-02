-- =====================================================================
-- Sistem QR Order — skema + data awal
-- Jalankan seluruh isi file ini di Supabase > SQL Editor > New query.
-- Aman dijalankan ulang: semua tabel di-drop dulu.
-- =====================================================================

drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists menu_items cascade;
drop table if exists menu_categories cascade;
drop table if exists tables cascade;

-- ---------------------------------------------------------------------
-- Master
-- ---------------------------------------------------------------------

create table tables (
  id      serial primary key,
  nomor   text not null unique,   -- disimpan sebagai teks: "01".."08"
  aktif   boolean not null default true
);

create table menu_categories (
  id      serial primary key,
  nama    text not null,
  urutan  int  not null default 0
);

create table menu_items (
  id           serial primary key,
  category_id  int  not null references menu_categories(id) on delete cascade,
  nama         text not null,
  deskripsi    text,
  harga        int  not null,          -- rupiah penuh, tanpa desimal
  photo_url    text not null,
  tersedia     boolean not null default true,
  urutan       int  not null default 0
);

-- ---------------------------------------------------------------------
-- Transaksi
--
-- status_bayar dan status_kerja sengaja DIPISAH.
-- Keduanya digerakkan pihak berbeda: status_bayar oleh webhook Midtrans,
-- status_kerja oleh kasir. Order yang gagal bayar tapi sudah terlanjur
-- dimasak adalah kondisi nyata; satu kolom akan menghapus salah satunya.
-- ---------------------------------------------------------------------

create table orders (
  id                 uuid primary key default gen_random_uuid(),
  kode               text not null unique,        -- KS-0001, ditunjukkan ke customer
  nomor_meja         text not null,
  total              int  not null,
  status_bayar       text not null default 'belum_bayar'
                     check (status_bayar in ('belum_bayar','sudah_bayar','gagal')),
  status_kerja       text not null default 'baru'
                     check (status_kerja in ('baru','diproses','selesai')),
  ditandai_manual    boolean not null default false,
  catatan_manual     text,
  midtrans_order_id  text unique,
  dibuat_pada        timestamptz not null default now(),
  dibayar_pada       timestamptz
);

create table order_items (
  id          serial primary key,
  order_id    uuid not null references orders(id) on delete cascade,
  menu_id     int  references menu_items(id) on delete set null,
  nama        text not null,   -- SALINAN nama saat dipesan
  harga       int  not null,   -- SALINAN harga saat dipesan
  qty         int  not null check (qty > 0)
);

-- Salinan nama dan harga di order_items itu disengaja.
-- Kalau harga menu diubah bulan depan, laporan bulan ini tidak ikut berubah.

create index orders_dibuat_pada_idx on orders (dibuat_pada desc);
create index order_items_order_id_idx on order_items (order_id);

-- ---------------------------------------------------------------------
-- Nomor urut kode order
-- ---------------------------------------------------------------------

create sequence order_kode_seq start 1;

create or replace function next_order_kode() returns text as $$
  select 'KS-' || lpad(nextval('order_kode_seq')::text, 4, '0');
$$ language sql;

-- ---------------------------------------------------------------------
-- Data awal
-- ---------------------------------------------------------------------

insert into tables (nomor) values
  ('01'),('02'),('03'),('04'),('05'),('06'),('07'),('08');

insert into menu_categories (id, nama, urutan) values
  (1, 'Makanan', 1),
  (2, 'Minuman', 2);
select setval('menu_categories_id_seq', 2);

insert into menu_items (category_id, nama, deskripsi, harga, photo_url, urutan) values
  (1, 'Nasi Goreng Kampung', 'Nasi goreng terasi, telur mata sapi, kerupuk',        26000, '/menu/nasi-goreng.jpg',   1),
  (1, 'Mie Ayam Pangsit',    'Mie ayam kecap, pangsit goreng, sawi',                24000, '/menu/mie-ayam.jpg',      2),
  (1, 'Ayam Geprek Sambal',  'Ayam krispi, sambal bawang, lalapan',                 28000, '/menu/ayam-geprek.jpg',   3),
  (1, 'Pisang Goreng Keju',  'Pisang raja, keju parut, susu kental',                18000, '/menu/pisang-goreng.jpg', 4),
  (2, 'Kopi Susu Gula Aren', 'Espresso, susu segar, gula aren cair',                22000, '/menu/kopi-susu.jpg',     1),
  (2, 'Americano Dingin',    'Espresso ganda, air, es batu',                        20000, '/menu/americano.jpg',     2),
  (2, 'Matcha Latte',        'Matcha kelas upacara, susu segar',                    26000, '/menu/matcha-latte.jpg',  3),
  (2, 'Es Teh Manis',        'Teh tubruk, gula batu, es',                            8000, '/menu/es-teh.jpg',        4);

-- ---------------------------------------------------------------------
-- Keamanan
--
-- Seluruh akses database dilakukan dari server memakai service role key.
-- Browser tidak pernah menyentuh Supabase secara langsung. RLS dinyalakan
-- supaya kalau anon key bocor, tidak ada satu baris pun yang bisa dibaca.
-- Service role key memang melewati RLS — itu perilaku yang diinginkan.
-- ---------------------------------------------------------------------

alter table tables          enable row level security;
alter table menu_categories enable row level security;
alter table menu_items      enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
