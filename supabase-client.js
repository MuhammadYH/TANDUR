// =====================================================================
// Konfigurasi Supabase — dipakai bareng oleh index.html & editor.html
// =====================================================================
// ⚠️ Ganti dua nilai di bawah dengan kredensial project Supabase kamu:
// Supabase Dashboard → Project Settings → API → "Project URL" & "anon public" key.
// Aman dipakai di sisi client — akses data tetap dibatasi oleh RLS
// policy yang sudah didefinisikan di tandur_supabase_schema.sql.
const SUPABASE_URL = 'https://okgqsepctbfatrzikyzp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZ3FzZXBjdGJmYXRyemlreXpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTI2NzcsImV4cCI6MjEwMTU4ODY3N30.r0pky4yJet3rc3hcwXRPV8n3eAAoCAGZLgQmnmHkrSw';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sesi user yang sedang login (null kalau belum login)
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Kirim magic link ke email untuk masuk/daftar (tidak perlu password).
// Dipakai oleh tombol "Masuk" / "Daftar Akun" di index.html.
export async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href }
  });
  return { error };
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Ambil id product_types berdasarkan slug ('box' | 'burger' | 'bakery' | 'tray').
// Dipakai editor.html untuk menautkan desain/order ke baris product_types yang benar.
export async function getProductTypeMap() {
  const { data, error } = await supabase.from('product_types').select('id, slug, base_price_per_pcs');
  if (error || !data) return {};
  const map = {};
  data.forEach(row => { map[row.slug] = row; });
  return map;
}

// =====================================================================
// Keranjang (cart_items) — dipakai oleh dropdown keranjang di navbar
// =====================================================================

// Ambil isi keranjang user yang sedang login, di-join dengan product_types
// supaya nama produk & harga dasar ikut terbawa. RLS di cart_items sudah
// membatasi baris ke user_id = auth.uid(), tapi tetap difilter eksplisit
// dan return [] kalau belum login.
export async function getCartItems() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('cart_items')
    .select('id, quantity, size_code, custom_dimensions, added_at, product_types ( id, slug, name, base_price_per_pcs )')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false });
  if (error || !data) return [];
  return data;
}

// Tambah item ke keranjang (siap dipakai editor.html untuk tombol "Tambah ke Keranjang").
export async function addToCart({ productTypeId, designId = null, sizeCode, customDimensions = null, quantity }) {
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Belum login' } };
  const { error } = await supabase.from('cart_items').insert({
    user_id: user.id,
    product_type_id: productTypeId,
    design_id: designId,
    size_code: sizeCode,
    custom_dimensions: customDimensions,
    quantity
  });
  return { error };
}

export async function removeCartItem(cartItemId) {
  const { error } = await supabase.from('cart_items').delete().eq('id', cartItemId);
  return { error };
}

export async function updateCartItemQuantity(cartItemId, quantity) {
  const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', cartItemId);
  return { error };
}

// Semua baris product_sizes (product_type_id, size_code, price_multiplier),
// dipakai untuk menghitung estimasi harga per item keranjang sesuai ukurannya.
export async function getAllProductSizes() {
  const { data, error } = await supabase.from('product_sizes').select('product_type_id, size_code, price_multiplier');
  if (error || !data) return [];
  return data;
}
