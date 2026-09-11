// =====================================================================
// Guard akses halaman admin — dipakai bareng oleh dashboard.html &
// riwayat-timbang.html (dan login.html untuk cek sesi yang sudah ada).
// =====================================================================
// Aturannya dua lapis:
//   1) Harus ada sesi Supabase yang aktif (sudah login).
//   2) Baris profiles miliknya harus role = 'ops_admin'.
// Kalau salah satu gagal, langsung dilempar ke login.html. RLS di sisi
// Supabase (lihat tandur_admin_schema.sql) tetap jadi lapisan keamanan
// utama — guard ini hanya untuk pengalaman UI (supaya tidak sempat
// menampilkan data sebelum dicek).
import { supabase } from '../supabase-client.js';

export async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirectToLogin();
    return null;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', session.user.id)
    .single();

  if (error || !profile || profile.role !== 'ops_admin') {
    await supabase.auth.signOut();
    redirectToLogin('Akun ini tidak memiliki akses admin.');
    return null;
  }

  return { ...profile, email: session.user.email };
}

export async function adminLogout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

function redirectToLogin(message) {
  const q = message ? ('?msg=' + encodeURIComponent(message)) : '';
  window.location.href = 'login.html' + q;
}

export { supabase };
