// =====================================================================
// Pengambilan data untuk halaman admin (dashboard.html & riwayat-timbang.html)
// Sumber: tabel kelompok_tani, petani, setoran_timbang di Supabase.
// Lihat tandur_admin_schema.sql untuk struktur tabelnya.
// =====================================================================
import { supabase } from '../supabase-client.js';

export async function getKelompokTani() {
  const { data, error } = await supabase
    .from('kelompok_tani')
    .select('id, nama, lokasi')
    .order('nama', { ascending: true });
  if (error || !data) return [];
  return data;
}

export async function getPetani() {
  const { data, error } = await supabase
    .from('petani')
    .select('id, nama, kelompok_id')
    .order('nama', { ascending: true });
  if (error || !data) return [];
  return data;
}

export async function getSetoranTimbang() {
  const { data, error } = await supabase
    .from('setoran_timbang')
    .select('id, petani_id, berat_kg, tanggal')
    .order('tanggal', { ascending: false });
  if (error || !data) return [];
  return data;
}

// Menggabungkan kelompok_tani + petani + setoran_timbang jadi struktur
// siap pakai untuk halaman Riwayat Timbang:
//   [{ id, nama, lokasi, totalKg, jumlahPetani, petani: [{id, nama, totalKg, jumlahSetoran}] }]
// Setiap kelompok diurutkan dari total kg terbesar, begitu juga petani di dalamnya.
export async function getRiwayatTimbangGrouped() {
  const [kelompok, petani, setoran] = await Promise.all([
    getKelompokTani(), getPetani(), getSetoranTimbang()
  ]);

  const totalPerPetani = {};
  const jumlahPerPetani = {};
  setoran.forEach(s => {
    totalPerPetani[s.petani_id] = (totalPerPetani[s.petani_id] || 0) + Number(s.berat_kg || 0);
    jumlahPerPetani[s.petani_id] = (jumlahPerPetani[s.petani_id] || 0) + 1;
  });

  const grouped = kelompok.map(k => {
    const anggota = petani
      .filter(p => p.kelompok_id === k.id)
      .map(p => ({
        id: p.id,
        nama: p.nama,
        totalKg: totalPerPetani[p.id] || 0,
        jumlahSetoran: jumlahPerPetani[p.id] || 0
      }))
      .sort((a, b) => b.totalKg - a.totalKg);

    const totalKg = anggota.reduce((sum, p) => sum + p.totalKg, 0);
    return { id: k.id, nama: k.nama, lokasi: k.lokasi, totalKg, jumlahPetani: anggota.length, petani: anggota };
  });

  return grouped.sort((a, b) => b.totalKg - a.totalKg);
}

// Setoran terbaru lintas kelompok, sudah di-join dengan nama petani &
// nama kelompoknya — dipakai panel "Setoran Terbaru" di dashboard.
export async function getRecentSetoran(limit = 6) {
  const [kelompok, petani, setoran] = await Promise.all([
    getKelompokTani(), getPetani(), getSetoranTimbang()
  ]);
  const kelompokById = Object.fromEntries(kelompok.map(k => [k.id, k]));
  const petaniById = Object.fromEntries(petani.map(p => [p.id, p]));

  return setoran.slice(0, limit).map(s => {
    const p = petaniById[s.petani_id];
    const k = p ? kelompokById[p.kelompok_id] : null;
    return {
      id: s.id,
      tanggal: s.tanggal,
      beratKg: Number(s.berat_kg || 0),
      namaPetani: p ? p.nama : '—',
      namaKelompok: k ? k.nama : '—'
    };
  });
}

// Tren setoran per tanggal (untuk grafik garis di dashboard) — total kg
// dijumlahkan per tanggal, diurutkan dari yang paling lama ke terbaru.
export async function getSetoranTrend() {
  const setoran = await getSetoranTimbang();
  const perTanggal = {};
  setoran.forEach(s => {
    const tgl = s.tanggal;
    if (!tgl) return;
    perTanggal[tgl] = (perTanggal[tgl] || 0) + Number(s.berat_kg || 0);
  });
  return Object.entries(perTanggal)
    .map(([tanggal, totalKg]) => ({ tanggal, totalKg }))
    .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
}

// Ringkasan untuk dashboard: total kg, total petani, total kelompok,
// 5 kelompok dengan setoran terbanyak, setoran terbaru, dan tren tanggal.
export async function getDashboardStats() {
  const grouped = await getRiwayatTimbangGrouped();
  const totalKg = grouped.reduce((s, k) => s + k.totalKg, 0);
  const totalPetani = grouped.reduce((s, k) => s + k.jumlahPetani, 0);
  const totalKelompok = grouped.length;
  const topKelompok = grouped.slice(0, 5);
  const recentSetoran = await getRecentSetoran(6);
  const trend = await getSetoranTrend();
  return { totalKg, totalPetani, totalKelompok, topKelompok, recentSetoran, trend };
}
