# Panel Admin Tandur

Folder ini berdiri sendiri — tidak ada tautan ke sini dari `index.html`
atau halaman publik lain. Untuk masuk, buka langsung:

```
/admin/login.html
```

Dari situ akan diarahkan otomatis ke `dashboard.html` setelah login
berhasil sebagai admin.

## Isi

- `login.html` — form login (email + kata sandi).
- `dashboard.html` — ringkasan: total kelompok tani, total petani, total
  limbah terkumpul, kelompok tani teratas, dan setoran terbaru.
- `riwayat-timbang.html` — daftar per kelompok tani (bisa dicari/di-expand),
  berisi nama petani anggota beserta total limbah (kg) masing-masing, dan
  ringkasan total limbah kelompok tersebut.
- `admin-auth.js` — penjaga akses: harus login **dan** `profiles.role = 'ops_admin'`.
- `admin-data.js` — pengambilan & agregasi data dari Supabase.
- `admin.css` — gaya bersama (sidebar, kartu, tabel), responsif.
- `tandur_admin_schema.sql` — skema tabel Supabase yang dibutuhkan.

## Setup sekali di awal

1. Buka Supabase Dashboard → **SQL Editor**, jalankan isi
   `tandur_admin_schema.sql`. Ini membuat tabel `kelompok_tani`, `petani`,
   `setoran_timbang`, plus RLS yang membatasi akses hanya untuk akun
   dengan `role = 'ops_admin'`.
2. Buat akun untuk tim admin: Supabase Dashboard → **Authentication → Users
   → Add user** (isi email + kata sandi).
3. Jadikan akun itu admin — jalankan di SQL Editor (ganti emailnya):
   ```sql
   update public.profiles set role = 'ops_admin' where id = (
     select id from auth.users where email = 'email-admin-anda@contoh.com'
   );
   ```
4. Isi data `kelompok_tani`, `petani`, dan `setoran_timbang` lewat
   Supabase **Table Editor** (klik "Insert row"). Halaman admin ini murni
   untuk **melihat/memantau** — belum ada form input di UI-nya.

## Keamanan

- Guard di `admin-auth.js` hanya untuk pengalaman UI (langsung dilempar
  ke halaman login kalau belum berhak). Lapisan keamanan sesungguhnya
  ada di RLS Supabase, jadi data tetap aman meski seseorang mencoba
  mengakses tabelnya langsung.
- `/admin/` dikecualikan lewat `robots.txt` di root situs supaya tidak
  muncul di hasil pencarian.
- Untuk keamanan tambahan, pertimbangkan mengaktifkan 2FA untuk akun
  admin lewat Supabase Auth.
