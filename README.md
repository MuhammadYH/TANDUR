# Panel Admin Tandur

Folder ini berdiri sendiri — tidak ada tautan ke sini dari `index.html`
atau halaman publik lain. Untuk masuk, buka langsung:

```
/admin/dashboard.html
```

**MVP: tidak ada mekanisme login.** Siapa pun yang tahu URL di atas
langsung masuk ke dashboard, tanpa email/password dan tanpa cek role
apa pun — sengaja dibuat begini supaya akses cepat selama tahap MVP.

## Isi

- `dashboard.html` — ringkasan: total kelompok tani, total petani, total
  limbah terkumpul, kelompok tani teratas, dan setoran terbaru.
- `riwayat-timbang.html` — daftar per kelompok tani (bisa dicari/di-expand),
  berisi nama petani anggota beserta total limbah (kg) masing-masing, dan
  ringkasan total limbah kelompok tersebut.
- `admin-data.js` — pengambilan & agregasi data dari Supabase.
- `admin.css` — gaya bersama (sidebar, kartu, tabel), responsif.
- `tandur_admin_schema.sql` — skema tabel Supabase yang dibutuhkan.

## Setup sekali di awal

1. Buka Supabase Dashboard → **SQL Editor**, jalankan isi
   `tandur_admin_schema.sql`. Ini membuat tabel `kelompok_tani`, `petani`,
   `setoran_timbang`, plus RLS yang mengizinkan **SELECT terbuka** (tanpa
   login) supaya dashboard bisa langsung baca data — lihat catatan
   ⚠️ di dalam file SQL-nya.
2. Isi data `kelompok_tani`, `petani`, dan `setoran_timbang` lewat
   Supabase **Table Editor** (klik "Insert row"). Halaman admin ini murni
   untuk **melihat/memantau** — belum ada form input di UI-nya.

## Keamanan (baca sebelum go-live)

- **Tidak ada login sama sekali** di versi MVP ini — siapa pun dengan
  link `/admin/dashboard.html` bisa melihat isinya, dan siapa pun yang
  tahu URL + anon key Supabase project ini (yang memang publik lewat
  kode frontend) bisa membaca ketiga tabel admin langsung lewat REST
  API, tanpa perlu buka halaman admin sama sekali.
- `/admin/` dikecualikan lewat `robots.txt` di root situs supaya tidak
  muncul di hasil pencarian — ini cuma menyembunyikan dari mesin
  pencari, bukan lapisan keamanan.
- **Sebelum situs ini publik/produksi**, tambahkan kembali mekanisme
  login (email magic-link seperti di `index.html`, misalnya) plus RLS
  yang mensyaratkan `profiles.role = 'ops_admin'`, supaya data
  kelompok tani/petani/setoran tidak bisa dibaca sembarang orang.
