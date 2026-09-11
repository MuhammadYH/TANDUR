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
-- RLS — MVP, akses cepat tanpa login.
--
-- Halaman admin (dashboard.html, riwayat-timbang.html) sekarang diakses
-- langsung tanpa mekanisme login sama sekali, jadi query dari halaman
-- itu jalan pakai anon key TANPA sesi Supabase Auth apa pun. Policy
-- yang mensyaratkan auth.uid() + profiles.role = 'ops_admin' (versi
-- sebelumnya) tidak akan pernah cocok tanpa login — hasilnya dashboard
-- kosong. Jadi untuk MVP ini, SELECT dibuka untuk siapa saja yang
-- pegang anon key (yang memang sudah publik lewat kode frontend).
--
-- ⚠️ Konsekuensi: siapa pun yang tahu URL Supabase project + anon key
-- bisa membaca ketiga tabel ini (kelompok_tani, petani, setoran_timbang)
-- langsung lewat REST API, tanpa perlu buka halaman admin sama sekali.
-- Untuk MVP/demo internal biasanya ini masih bisa diterima, tapi kalau
-- datanya makin sensitif atau situsnya go-live publik, tambahkan lagi
-- mekanisme login + policy berbasis role sebelum itu terjadi.
--
-- Insert/update/delete SENGAJA tidak diberi policy apa pun di sini —
-- default RLS menolak semuanya kalau tidak ada policy yang cocok, jadi
-- data tetap hanya bisa diubah lewat Supabase Dashboard → Table Editor
-- (yang jalan pakai service role, bukan lewat RLS anon key ini).
-- =====================================================================
alter table public.kelompok_tani enable row level security;
alter table public.petani enable row level security;
alter table public.setoran_timbang enable row level security;

create policy "Publik bisa lihat kelompok_tani (MVP, tanpa login)"
  on public.kelompok_tani for select
  using (true);

create policy "Publik bisa lihat petani (MVP, tanpa login)"
  on public.petani for select
  using (true);

create policy "Publik bisa lihat setoran_timbang (MVP, tanpa login)"
  on public.setoran_timbang for select
  using (true);

-- =====================================================================
-- Isi data kelompok_tani, petani, dan setoran_timbang lewat Supabase
-- Dashboard → Table Editor (klik "Insert row"). Halaman admin ini murni
-- untuk melihat/memantau — belum ada form input di UI-nya.
-- =====================================================================
