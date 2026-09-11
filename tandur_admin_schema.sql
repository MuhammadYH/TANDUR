-- =====================================================================
-- Skema tambahan untuk fitur Admin: Dashboard & Riwayat Timbang
-- Jalankan file ini di Supabase Dashboard → SQL Editor.
-- Tabel ini terpisah dari skema e-commerce yang sudah ada (orders, designs, dst).
-- =====================================================================

-- ---------- kelompok_tani ----------
create table if not exists public.kelompok_tani (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  lokasi text,
  created_at timestamptz not null default now()
);

-- ---------- petani (anggota kelompok tani) ----------
create table if not exists public.petani (
  id uuid primary key default gen_random_uuid(),
  kelompok_id uuid not null references public.kelompok_tani(id) on delete cascade,
  nama text not null,
  created_at timestamptz not null default now()
);
create index if not exists petani_kelompok_id_idx on public.petani(kelompok_id);

-- ---------- setoran_timbang (satu baris = satu kali timbang/setor limbah) ----------
create table if not exists public.setoran_timbang (
  id uuid primary key default gen_random_uuid(),
  petani_id uuid not null references public.petani(id) on delete cascade,
  berat_kg numeric(10,2) not null check (berat_kg > 0),
  tanggal date not null default current_date,
  catatan text,
  created_at timestamptz not null default now()
);
create index if not exists setoran_timbang_petani_id_idx on public.setoran_timbang(petani_id);
create index if not exists setoran_timbang_tanggal_idx on public.setoran_timbang(tanggal);

-- =====================================================================
-- RLS: hanya user dengan profiles.role = 'ops_admin' yang boleh mengakses.
-- (Tabel `profiles` sudah ada di skema utama dan punya kolom `role`.)
-- =====================================================================
alter table public.kelompok_tani enable row level security;
alter table public.petani enable row level security;
alter table public.setoran_timbang enable row level security;

create policy "Admin akses penuh kelompok_tani"
  on public.kelompok_tani for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'ops_admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'ops_admin'));

create policy "Admin akses penuh petani"
  on public.petani for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'ops_admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'ops_admin'));

create policy "Admin akses penuh setoran_timbang"
  on public.setoran_timbang for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'ops_admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'ops_admin'));

-- =====================================================================
-- Cara menjadikan sebuah akun sebagai admin:
-- 1) Akun harus sudah terdaftar (sign up) lewat situs seperti biasa, ATAU
--    dibuat manual di Supabase Dashboard → Authentication → Users → Add user
--    (isi email + password, supaya bisa dipakai login di halaman admin).
-- 2) Lalu jalankan (ganti email-nya):
--    update public.profiles set role = 'ops_admin' where id = (
--      select id from auth.users where email = 'email-admin-anda@contoh.com'
--    );
-- =====================================================================

-- (Opsional) Contoh data untuk uji coba tampilan — hapus/skip kalau tidak perlu:
-- insert into public.kelompok_tani (nama, lokasi) values
--   ('Kelompok Tani Sumber Makmur', 'Desa Sukorejo, Kec. Wonoasri'),
--   ('Kelompok Tani Tani Jaya', 'Desa Karangrejo, Kec. Pujon');
