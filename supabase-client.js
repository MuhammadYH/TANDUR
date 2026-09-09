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

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// Sesi user yang sedang login (null kalau belum login).
//
// Dibaca dari sesi yang sudah dipulihkan (getSession) di localStorage,
// BUKAN lewat panggilan jaringan ke auth.getUser() setiap kali. Ini
// dipanggil berkali-kali di banyak halaman (refreshAccountUI, refreshCart,
// checkoutCart, getProfile, dst) — pakai getSession() menghindari round-trip
// jaringan berulang dan menghilangkan "kedipan" status logout sesaat saat
// halaman baru dimuat. Ini tetap aman: setiap query data (orders, designs,
// cart_items, dst) tetap divalidasi ulang oleh Supabase lewat RLS policy
// di sisi server, jadi klaim sesi di sisi client tidak pernah jadi satu-
// satunya lapisan keamanan.
export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

// Promise yang selesai begitu Supabase selesai memulihkan sesi (dari
// localStorage) untuk pertama kali setelah client dibuat. Dipakai halaman
// yang mau menunggu status login "pasti" sebelum merender UI, supaya
// tidak sempat menampilkan tampilan logged-out lalu berkedip jadi
// logged-in begitu sesi selesai dipulihkan.
export const authReady = supabase.auth.getSession().then(() => {});

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
    .select('id, design_id, quantity, size_code, custom_dimensions, added_at, product_types ( id, slug, name, base_price_per_pcs )')
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

// Ubah semua isi keranjang user jadi baris `orders` (satu order per baris
// cart_items), lalu kosongkan keranjang. Dipakai tombol "Lanjut ke
// Checkout" di index.html. shippingAddress mengikuti bentuk kolom
// orders.shipping_address: {recipient, phone, address, city, postal_code}.
export async function checkoutCart({ shippingAddress, notes = null }) {
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Belum login' } };

  const items = await getCartItems();
  if (items.length === 0) return { error: { message: 'Keranjang kosong' } };

  const sizes = await getAllProductSizes();
  const multiplierFor = (productTypeId, sizeCode) => {
    const row = sizes.find(s => s.product_type_id === productTypeId && s.size_code === sizeCode);
    return row ? Number(row.price_multiplier) : 1;
  };

  const orderRows = items.map(item => {
    const pt = item.product_types;
    const basePrice = pt ? Number(pt.base_price_per_pcs) : 0;
    const mult = pt ? multiplierFor(pt.id, item.size_code) : 1;
    const unitPrice = basePrice * mult;
    const totalPrice = unitPrice * item.quantity;
    return {
      order_no: 'TND-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      user_id: user.id,
      design_id: item.design_id || null,
      product_type_id: pt ? pt.id : null,
      size_code: item.size_code,
      custom_dimensions: item.custom_dimensions || null,
      quantity: item.quantity,
      unit_price: unitPrice,
      discount_pct: 0,
      total_price: totalPrice,
      status: 'awaiting_proof',
      shipping_address: shippingAddress,
      notes
    };
  });

  const { data, error } = await supabase.from('orders').insert(orderRows).select();
  if (error) return { error };

  // Checkout berhasil -> kosongkan keranjang (best-effort; kalau ini gagal,
  // order tetap tercatat, jadi tidak menghilang untuk user).
  await supabase.from('cart_items').delete().eq('user_id', user.id);

  return { data, error: null };
}

// Semua baris product_sizes (product_type_id, size_code, price_multiplier),
// dipakai untuk menghitung estimasi harga per item keranjang sesuai ukurannya.
export async function getAllProductSizes() {
  const { data, error } = await supabase.from('product_sizes').select('product_type_id, size_code, price_multiplier');
  if (error || !data) return [];
  return data;
}

// =====================================================================
// Profil (public.profiles, 1:1 dengan auth.users) — dipakai profil.html
// =====================================================================

// Baris profiles milik user yang login. Baris ini otomatis dibuat oleh
// trigger on_auth_user_created saat user pertama kali daftar, jadi
// seharusnya selalu ada begitu user berhasil login.
export async function getProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, company_name, role, created_at')
    .eq('id', user.id)
    .single();
  if (error || !data) return null;
  return data;
}

// Update full_name / phone / company_name milik user sendiri.
// RLS "User lihat & edit profil sendiri" membatasi ini ke auth.uid() = id.
export async function updateProfile({ fullName, phone, companyName }) {
  const user = await getCurrentUser();
  if (!user) return { error: { message: 'Belum login' } };
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, phone, company_name: companyName })
    .eq('id', user.id);
  return { error };
}

// =====================================================================
// Pesanan (public.orders + order_proofs) — dipakai lacak-pesanan.html
// =====================================================================

// Semua order milik user, di-join dengan product_types supaya nama produk
// ikut terbawa. RLS "User lihat order sendiri" sudah membatasi ke
// user_id = auth.uid(), tapi tetap difilter eksplisit dan return [] kalau
// belum login.
export async function getOrders() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_no, size_code, custom_dimensions, quantity, unit_price, total_price, status, shipping_address, notes, created_at, product_types ( name, slug )')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data;
}

// Riwayat proof (revisi desain sebelum cetak) untuk satu order.
// RLS "User lihat proof order sendiri" mengecek lewat order.user_id.
export async function getOrderProofs(orderId) {
  const { data, error } = await supabase
    .from('order_proofs')
    .select('id, version, proof_file_url, status, revision_notes, created_at')
    .eq('order_id', orderId)
    .order('version', { ascending: true });
  if (error || !data) return [];
  return data;
}

// =====================================================================
// Riwayat Desain (public.designs) — dipakai riwayat-desain.html & editor.html
// =====================================================================

// Semua desain tersimpan milik user, terbaru dulu.
export async function getDesigns() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('designs')
    .select('id, name, size_code, custom_dimensions, thumbnail_url, updated_at, product_types ( name, slug )')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return data;
}

export async function deleteDesign(designId) {
  const { error } = await supabase.from('designs').delete().eq('id', designId);
  return { error };
}

export async function renameDesign(designId, name) {
  const { error } = await supabase.from('designs').update({ name }).eq('id', designId);
  return { error };
}
