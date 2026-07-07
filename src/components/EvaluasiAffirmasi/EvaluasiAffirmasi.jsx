import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import styles from './EvaluasiAffirmasi.module.css';

export default function EvaluasiAffirmasi({ entries, yesterdayEntries, officers, affirmasi, onUploadAffirmasi }) {
  const [previewData, setPreviewData] = useState([]);
  const [hasFile, setHasFile] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Parse Excel
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const parsed = data.map((row) => {
        const getVal = (keyStr) => {
          const key = Object.keys(row).find(k => k.toLowerCase().includes(keyStr));
          return key ? row[key] : '';
        };

        const nama = getVal('nama');
        const kecamatan = getVal('kecamatan');
        
        const officerMatch = officers.find(o => String(o.Nama).trim().toLowerCase() === String(nama).trim().toLowerCase());
        
        return {
          nama: nama || '-',
          kecamatan: kecamatan || '-',
          matchedEmail: officerMatch ? officerMatch.email : null,
          role: officerMatch ? officerMatch.Jabatan : null
        };
      });

      setPreviewData(parsed);
      setHasFile(true);
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // reset
  };

  const handleSave = () => {
    const matched = previewData.filter(d => d.matchedEmail).map(d => ({
      email: d.matchedEmail,
      nama: d.nama,
      kecamatan: d.kecamatan,
      role: d.role
    }));
    
    if (matched.length === 0) {
      alert("Tidak ada nama yang cocok dengan data petugas di sistem. Tidak ada yang disimpan.");
      return;
    }
    
    // Combine with existing instead of overwriting completely?
    // User requested: "tambahkan input manual untuk menandakan label mitra affirmasi"
    // Usually Excel upload replaces everything in current logic. We'll just replace.
    onUploadAffirmasi(matched);
    setPreviewData([]);
    setHasFile(false);
  };

  const handleManualAdd = () => {
    if (!selectedOfficer) return;
    const officer = officers.find(o => o.email === selectedOfficer);
    if (!officer) return;

    if (affirmasi.some(a => a.email === officer.email)) {
      alert("Petugas ini sudah terdaftar sebagai Mitra Affirmasi.");
      return;
    }

    const newAffirmasi = [...affirmasi, {
      email: officer.email,
      nama: officer.Nama,
      kecamatan: '-', 
      role: officer.Jabatan
    }];

    onUploadAffirmasi(newAffirmasi);
    setSelectedOfficer('');
  };

  const handleRemoveAffirmasi = (email) => {
    if (window.confirm("Hapus petugas ini dari daftar Mitra Affirmasi?")) {
      const newAffirmasi = affirmasi.filter(a => a.email !== email);
      onUploadAffirmasi(newAffirmasi);
    }
  };

  // --- STATS CALCULATION ---
  const affirmasiEmails = useMemo(() => affirmasi.map(a => a.email.toLowerCase()), [affirmasi]);

  const { affirmasiStats, nonAffirmasiStats } = useMemo(() => {
    let affTotal = 0;
    let affDone = 0;
    let nonAffTotal = 0;
    let nonAffDone = 0;

    (entries || []).forEach(e => {
      let eTotal = e.total || 0;
      let eDone = 0;
      
      if (e.regionSummary && Array.isArray(e.regionSummary)) {
        e.regionSummary.forEach(r => {
          if (r.statusBreakdown && Array.isArray(r.statusBreakdown)) {
            r.statusBreakdown.forEach(s => {
              const st = s.status.toLowerCase();
              if (st.includes('submitted') || st.includes('approved') || st.includes('rejected')) {
                eDone += s.count;
              }
            });
          }
        });
      }

      if (e.email && affirmasiEmails.includes(e.email.toLowerCase())) {
        affTotal += eTotal;
        affDone += eDone;
      } else {
        nonAffTotal += eTotal;
        nonAffDone += eDone;
      }
    });

    return {
      affirmasiStats: { total: affTotal / 2, done: affDone / 2 },
      nonAffirmasiStats: { total: nonAffTotal / 2, done: nonAffDone / 2 }
    };
  }, [entries, affirmasiEmails]);

  const affPct = affirmasiStats.total > 0 ? ((affirmasiStats.done / affirmasiStats.total) * 100).toFixed(2) : "0.00";
  const nonAffPct = nonAffirmasiStats.total > 0 ? ((nonAffirmasiStats.done / nonAffirmasiStats.total) * 100).toFixed(2) : "0.00";

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>
        <span>🌟</span> Evaluasi Mitra Affirmasi
      </h2>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '32px' }}>
        {/* Upload Excel */}
        <div className={styles.uploadSection} style={{ flex: '1 1 300px', marginBottom: 0 }}>
          <h3 style={{ color: 'var(--gray-300)', marginBottom: '8px' }}>Upload Data (Excel)</h3>
          <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', marginBottom: '16px' }}>Format: No, Nama, Kecamatan.</p>
          <label className={styles.uploadLabel}>
            Pilih File Excel
            <input type="file" accept=".xlsx, .xls" className={styles.uploadInput} onChange={handleFileUpload} />
          </label>
        </div>

        {/* Input Manual */}
        <div className={styles.uploadSection} style={{ flex: '1 1 300px', marginBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ color: 'var(--gray-300)', marginBottom: '8px' }}>Input Manual</h3>
          <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', marginBottom: '16px' }}>Pilih nama petugas dari daftar untuk ditandai.</p>
          <input 
            type="text" 
            placeholder="Cari nama/email..." 
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ width: '100%', maxWidth: '300px', marginBottom: '8px', padding: '8px', borderRadius: '4px', backgroundColor: 'var(--gray-800)', color: 'white', border: '1px solid var(--gray-600)' }}
          />
          <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '300px' }}>
            <select 
              value={selectedOfficer} 
              onChange={(e) => setSelectedOfficer(e.target.value)}
              style={{ flex: 1, padding: '8px', borderRadius: '4px', backgroundColor: 'var(--gray-700)', color: 'white', border: '1px solid var(--gray-600)' }}
            >
              <option value="">-- Pilih Petugas --</option>
              {officers
                .filter(o => 
                  o.Nama.toLowerCase().includes(searchKeyword.toLowerCase()) || 
                  o.email.toLowerCase().includes(searchKeyword.toLowerCase())
                )
                .sort((a, b) => a.Nama.localeCompare(b.Nama))
                .map(o => (
                <option key={o.email} value={o.email}>{o.Nama} ({o.Jabatan})</option>
              ))}
            </select>
            <button 
              onClick={handleManualAdd}
              style={{ padding: '8px 16px', backgroundColor: 'var(--primary-500)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Tambah
            </button>
          </div>
        </div>
      </div>

      {hasFile && previewData.length > 0 && (
        <div className={styles.previewTableWrapper}>
          <h3 style={{ color: 'var(--gray-200)', marginBottom: '8px' }}>Preview Pencocokan Data (Upload)</h3>
          <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>Peringatan: Menyimpan dari file excel akan menggantikan seluruh daftar Mitra Affirmasi saat ini.</p>
          
          <table className={styles.table}>
            <thead>
              <tr>
                <th>No</th>
                <th>Nama (di Excel)</th>
                <th>Kecamatan</th>
                <th>Status di Sistem</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {previewData.map((row, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{row.nama}</td>
                  <td>{row.kecamatan}</td>
                  <td>
                    {row.matchedEmail ? (
                      <span className={styles.matchFound}>✓ Ditemukan ({row.matchedEmail})</span>
                    ) : (
                      <span className={styles.matchNotFound}>✗ Tidak Ditemukan</span>
                    )}
                  </td>
                  <td>{row.role || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button className={styles.saveBtn} onClick={handleSave}>Konfirmasi & Simpan (Timpa Semua)</button>
        </div>
      )}

      {!hasFile && (
        <div className={styles.statsSection}>
          <h3 style={{ color: 'var(--gray-100)', marginBottom: '8px' }}>Perbandingan Kinerja Keseluruhan</h3>
          <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', marginBottom: '24px' }}>Membandingkan persentase penyelesaian antara Mitra Affirmasi ({affirmasi.length} orang) dan Mitra Non-Affirmasi.</p>
          
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h4 className={styles.statCardTitle}>Mitra Affirmasi</h4>
              <div className={`${styles.statValue} ${styles.affirmasi}`}>{affPct}%</div>
              <div className={styles.statDetail}>
                Diselesaikan: {Math.round(affirmasiStats.done)} dari {Math.round(affirmasiStats.total)} target
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${affPct}%`, backgroundColor: 'var(--primary-500)' }}></div>
              </div>
            </div>

            <div className={styles.statCard}>
              <h4 className={styles.statCardTitle}>Mitra Non-Affirmasi</h4>
              <div className={`${styles.statValue} ${styles.nonAffirmasi}`}>{nonAffPct}%</div>
              <div className={styles.statDetail}>
                Diselesaikan: {Math.round(nonAffirmasiStats.done)} dari {Math.round(nonAffirmasiStats.total)} target
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${nonAffPct}%`, backgroundColor: 'var(--accent-orange)' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!hasFile && affirmasi.length > 0 && (
        <div className={styles.previewTableWrapper} style={{ marginTop: '40px' }}>
          <h3 style={{ color: 'var(--gray-200)', marginBottom: '8px' }}>Daftar Mitra Affirmasi Tersimpan</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>No</th>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {affirmasi.map((a, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{a.nama}</td>
                  <td>{a.email}</td>
                  <td>{a.role}</td>
                  <td>
                    <button 
                      onClick={() => handleRemoveAffirmasi(a.email)}
                      style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
