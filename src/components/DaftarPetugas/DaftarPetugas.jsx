import { useState, useMemo, useCallback, useEffect } from 'react';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import styles from './DaftarPetugas.module.css';

export default function DaftarPetugas({ entries, officers, wilayahs, affirmasi = [], onToggleAffirmasi }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('daftarPetugasLoggedIn') === 'true';
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  const [filterKecamatan, setFilterKecamatan] = useState('');
  const [currentOfficerPage, setCurrentOfficerPage] = useState(1);
  const [suratData, setSuratData] = useState(new Map());
  const apiUrl = import.meta.env.VITE_API_URL || '/api.php';

  useEffect(() => {
    fetch(`${apiUrl}?type=surat`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSuratData(new Map(data));
        }
      })
      .catch(e => console.error("Gagal memuat suratData", e));
  }, []);

  const OFFICER_ITEMS_PER_PAGE = 20;

  const handleUploadSurat = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      const map = new Map();
      data.forEach(row => {
        const emailKey = Object.keys(row).find(k => k.toLowerCase() === 'email');
        const nomorKey = Object.keys(row).find(k => k.toLowerCase() === 'nomor' || k.toLowerCase().includes('nomor'));
        
        if (emailKey && nomorKey && row[emailKey] && row[nomorKey]) {
          map.set(row[emailKey].toString().trim().toLowerCase(), row[nomorKey].toString().trim());
        }
      });
      setSuratData(map);
      const dataToSave = Array.from(map.entries());
      fetch(`${apiUrl}?type=surat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      }).catch(err => console.error('Gagal menyimpan surat data:', err));

      alert(`Berhasil memuat ${map.size} data nomor surat dari excel dan menyimpannya secara permanen ke server.`);
    };
    reader.readAsBinaryString(file);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginForm.username === 'se2026' && loginForm.password === 'password') {
      setIsLoggedIn(true);
      localStorage.setItem('daftarPetugasLoggedIn', 'true');
      setLoginError('');
    } else {
      setLoginError('Username atau password salah.');
    }
  };

  const allKecamatans = useMemo(() => {
    const set = new Set();
    entries.forEach(e => {
      e.regionSummary?.forEach(reg => {
        const kdkec = reg.regionCode.substring(4, 7);
        const wil = wilayahs?.find(w => w.kdkec === kdkec);
        set.add(wil ? wil.nmkec : (e.fetchLabel || '-'));
      });
    });
    return Array.from(set).sort();
  }, [entries, wilayahs]);

  const allOfficersList = useMemo(() => {
    const map = new Map();
    
    entries.forEach(entry => {
      const entryKecs = new Set();
      entry.regionSummary?.forEach(reg => {
        const kdkec = reg.regionCode.substring(4, 7);
        const wil = wilayahs?.find(w => w.kdkec === kdkec);
        entryKecs.add(wil ? wil.nmkec : (entry.fetchLabel || '-'));
      });

      if (filterKecamatan && !entryKecs.has(filterKecamatan)) return;

      const officer = officers.find(o => o.email.toLowerCase() === entry.email.toLowerCase());
      const name = officer?.Nama || entry.email;
      const lowerEmail = entry.email.toLowerCase();

      if (!map.has(lowerEmail)) {
        map.set(lowerEmail, {
          name,
          email: entry.email,
          roles: new Set(),
          kecamatans: new Set()
        });
      }

      const data = map.get(lowerEmail);
      if (entry.roleName) data.roles.add(entry.roleName);
      entryKecs.forEach(k => data.kecamatans.add(k));
    });

    const result = Array.from(map.values()).map(d => ({
      name: d.name,
      email: d.email,
      roles: Array.from(d.roles).join(', '),
      kecamatans: Array.from(d.kecamatans).sort().join(', ')
    }));

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [entries, officers, wilayahs, filterKecamatan]);

  const totalOfficerPages = Math.ceil(allOfficersList.length / OFFICER_ITEMS_PER_PAGE);
  const paginatedOfficers = allOfficersList.slice((currentOfficerPage - 1) * OFFICER_ITEMS_PER_PAGE, currentOfficerPage * OFFICER_ITEMS_PER_PAGE);

  const getOfficerPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalOfficerPages; i++) {
      if (i === 1 || i === totalOfficerPages || (i >= currentOfficerPage - 1 && i <= currentOfficerPage + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  const getHtmlForOfficer = useCallback((email, rolesStr = "") => {
    const isPencacah = rolesStr.toLowerCase().includes('pencacah') || rolesStr.toLowerCase().includes('ppl');
    const officerEntries = entries.filter(e => e.email.toLowerCase() === email.toLowerCase());
    
    const regionStats = new Map();
    const wilayahKerja = new Map();

    officerEntries.forEach(entry => {
      entry.regionSummary?.forEach(reg => {
        const rcode = reg.regionCode;
        if (!regionStats.has(rcode)) {
          regionStats.set(rcode, { total: 0, done: 0 });
        }
        const stat = regionStats.get(rcode);
        stat.total += reg.statusBreakdown.reduce((acc, s) => acc + s.count, 0);
        
        const done = reg.statusBreakdown
          .filter(s => s.status.toLowerCase().includes('submitted') || s.status.toLowerCase().includes('approved') || s.status.toLowerCase().includes('rejected'))
          .reduce((acc, s) => acc + s.count, 0);
        stat.done += done;
      });
    });

    let count40 = 0;
    let count100 = 0;
    const totalSLS = regionStats.size;

    regionStats.forEach((stat, rcode) => {
      const pct = stat.total > 0 ? (stat.done / stat.total) * 100 : 0;
      if (pct >= 40) count40++;
      if (pct === 100) count100++;

      const kdkec = rcode.substring(4, 7);
      const kddesa = rcode.substring(7, 10);
      
      let pplName = '-';
      if (!isPencacah) {
        const pplEntry = entries.find(e => 
          (e.roleName?.toLowerCase().includes('pencacah') || e.roleName?.toLowerCase().includes('ppl')) &&
          e.regionSummary?.some(r => r.regionCode === rcode)
        );
        if (pplEntry) {
          const pplOfficer = officers.find(o => o.email.toLowerCase() === pplEntry.email.toLowerCase());
          pplName = pplOfficer ? pplOfficer.Nama : pplEntry.email;
        }
      }

      const key = isPencacah ? `${kdkec}_${kddesa}` : `${pplName}_${kdkec}_${kddesa}`;

      if (!wilayahKerja.has(key)) {
        const wil = wilayahs?.find(w => w.kdkec === kdkec && w.kddesa === kddesa);
        wilayahKerja.set(key, {
          pplName,
          kdkec,
          nmkec: wil ? wil.nmkec : '-',
          kddesa,
          nmdesa: wil ? wil.nmdesa : '-',
          slsCount: 0
        });
      }
      wilayahKerja.get(key).slsCount += 1;
    });

    let wilayahHtmlRows = '';
    let idxWil = 1;
    
    const wilayahKerjaArray = Array.from(wilayahKerja.values());
    if (!isPencacah) {
      wilayahKerjaArray.sort((a, b) => a.pplName.localeCompare(b.pplName));
    }

    wilayahKerjaArray.forEach(data => {
      if (isPencacah) {
        wilayahHtmlRows += `
          <tr>
            <td style="padding: 4px;">${idxWil++}.</td>
            <td style="padding: 4px; text-align: left;">[${data.kdkec}] ${data.nmkec}</td>
            <td style="padding: 4px; text-align: left;">[${data.kddesa}] ${data.nmdesa}</td>
            <td style="padding: 4px;">${data.slsCount}</td>
          </tr>
        `;
      } else {
        wilayahHtmlRows += `
          <tr>
            <td style="padding: 4px;">${idxWil++}.</td>
            <td style="padding: 4px; text-align: left;">${data.pplName}</td>
            <td style="padding: 4px; text-align: left;">[${data.kdkec}] ${data.nmkec}</td>
            <td style="padding: 4px; text-align: left;">[${data.kddesa}] ${data.nmdesa}</td>
            <td style="padding: 4px;">${data.slsCount}</td>
          </tr>
        `;
      }
    });

    const nomorSuratExcel = suratData.get(email.toLowerCase());
    const textNomor = nomorSuratExcel ? nomorSuratExcel : '......';

    const judulPetugas = isPencacah ? 'PETUGAS LAPANGAN' : 'PETUGAS PEMERIKSA LAPANGAN';
    const kodeSurat = isPencacah ? 'PPL.SE2026' : 'PML.SE2026';
    
    const teksTugas1 = isPencacah 
      ? '1. Melakukan pendataan lapangan door to door Sensus Ekonomi 2026 termin I' 
      : '1. Melakukan pemeriksaan hasil pendataan Petugas Lapangan door to door Sensus Ekonomi 2026 termin I';
    const teksTugas2 = isPencacah 
      ? '2. Melakukan pendataan lapangan door to door Sensus Ekonomi 2026 termin II' 
      : '2. Melakukan pemeriksaan hasil pendataan Petugas Lapangan door to door Sensus Ekonomi 2026 termin II';
      
    const nilai1 = isPencacah ? 'Rp 4.321.000, 00' : 'Rp 4.552.000, 00';
    const nilai2 = isPencacah ? 'Rp 6.481.500, 00' : 'Rp 6.828.000, 00';
    const nilaiTotal = isPencacah ? 'Rp 10.802.500, 00' : 'Rp 11.380.000, 00';
    
    const terbilang = isPencacah 
      ? 'Sepuluh juta delapan ratus dua ribu lima ratus rupiah' 
      : 'Sebelas juta tiga ratus delapan puluh ribu rupiah';
      
    const waktuTotal = isPencacah ? '15 Juni-31 Agustus 2026' : '15 Juni 2026 - 31 Agustus 2026';
    const volume2 = isPencacah ? `Seluruh ${totalSLS} SLS/sub-SLS` : `${totalSLS} SLS/Sub-SLS`;

    return `
  <div style="text-align: center; font-weight: normal; margin-bottom: 20px;">
    LAMPIRAN<br/>
    PERJANJIAN KERJA ${judulPetugas}<br/>
    SENSUS EKONOMI 2026<br/>
    PADA BADAN PUSAT STATISTIK KABUPATEN DELI SERDANG<br/>
    NOMOR: ${textNomor}/PPK/${kodeSurat}/05/2026
  </div>
  
  <p>I. DAFTAR URAIAN PEKERJAAN, WAKTU PENYELESAIAN, TARGET PEKERJAAN DAN NILAI PERJANJIAN</p>
  
  <table border="1" style="border-collapse: collapse; width: 100%; text-align: center;">
    <thead>
      <tr>
        <th rowspan="2" style="width: 25%;">Uraian Pekerjaan</th>
        <th rowspan="2" style="width: 20%;">Waktu Penyelesaian</th>
        <th colspan="2" style="width: 25%;">Target Pekerjaan</th>
        <th rowspan="2" style="width: 30%;">Nilai Perjanjian</th>
      </tr>
      <tr>
        <th style="width: 10%;">Presentase<br/>kumulatif</th>
        <th style="width: 15%;">Volume</th>
      </tr>
      <tr>
        <td>(1)</td>
        <td>(2)</td>
        <td>(3)</td>
        <td>(4)</td>
        <td>(5)</td>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align: left; padding: 4px;">${teksTugas1}</td>
        <td>Minimal 1 bulan</td>
        <td>40%</td>
        <td>${count40} SLS/Sub-SLS</td>
        <td>${nilai1}</td>
      </tr>
      <tr>
        <td style="text-align: left; padding: 4px;">${teksTugas2}</td>
        <td>31 Agustus 2026</td>
        <td>100%</td>
        <td>${volume2}</td>
        <td>${nilai2}</td>
      </tr>
      <tr>
        <td colspan="1">Total</td>
        <td>${waktuTotal}</td>
        <td colspan="2"></td>
        <td>${nilaiTotal}</td>
      </tr>
      <tr>
        <td colspan="5" style="text-align: left; padding: 4px; font-style: italic;">
          Terbilang: ${terbilang}
        </td>
      </tr>
    </tbody>
  </table>
  
  <br clear="all" style="page-break-before:always" />
  
  ${isPencacah ? `
  <p>II. DAFTAR WILAYAH KERJA</p>
  <table border="1" style="border-collapse: collapse; width: 100%; text-align: center;">
    <thead>
      <tr>
        <th style="padding: 4px;">No</th>
        <th style="padding: 4px;">[Kode]<br/>KECAMATAN/DISTRIK</th>
        <th style="padding: 4px;">[Kode]<br/>DESA/KAMPUNG/NAGARI</th>
        <th style="padding: 4px;">Jumlah SLS/sub-<br/>SLS</th>
      </tr>
      <tr>
        <td style="padding: 4px;">(1)</td>
        <td style="padding: 4px;">(2)</td>
        <td style="padding: 4px;">(3)</td>
        <td style="padding: 4px;">(4)</td>
      </tr>
    </thead>
    <tbody>
      ${wilayahHtmlRows}
    </tbody>
  </table>
  ` : `
  <p>II. DAFTAR PETUGAS DAN WILAYAH KERJA</p>
  <table border="1" style="border-collapse: collapse; width: 100%; text-align: center;">
    <thead>
      <tr>
        <th style="padding: 4px;">No</th>
        <th style="padding: 4px;">Nama Petugas Lapangan<br/>Sensus</th>
        <th style="padding: 4px;">[Kode]<br/>KECAMATAN/DISTRIK</th>
        <th style="padding: 4px;">[Kode]<br/>DESA/KAMPUNG/NAGARI</th>
        <th style="padding: 4px;">Jumlah<br/>SLS/Sub-SLS</th>
      </tr>
      <tr>
        <td style="padding: 4px;">(1)</td>
        <td style="padding: 4px;">(2)</td>
        <td style="padding: 4px;">(3)</td>
        <td style="padding: 4px;">(4)</td>
        <td style="padding: 4px;">(5)</td>
      </tr>
    </thead>
    <tbody>
      ${wilayahHtmlRows}
    </tbody>
  </table>
  `}
`;
  }, [entries, wilayahs, suratData, officers]);

  const handleDownloadWord = useCallback((email, rolesStr = "") => {
    const innerHtml = getHtmlForOfficer(email, rolesStr);
    const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>Perjanjian Kerja</title>
  <style>
    @page Section1 {
      size: 841.9pt 595.3pt;
      mso-page-orientation: landscape;
      margin: 1in 1in 1in 1in;
      mso-header-margin: .5in;
      mso-footer-margin: .5in;
      mso-paper-source: 0;
    }
    div.Section1 { page: Section1; }
  </style>
</head>
<body style="font-family: 'Times New Roman', serif; font-size: 11pt;">
<div class="Section1">
${innerHtml}
</div>
</body>
</html>`;
    const bom = String.fromCharCode(0xFEFF);
    const blob = new Blob([bom, htmlContent], { type: 'application/msword' });
    saveAs(blob, `Perjanjian_Kerja_${email}.doc`);
  }, [getHtmlForOfficer]);

  const handleDownloadAll = useCallback((roleFilter) => {
    const isPencacahFilter = roleFilter === 'pencacah';
    
    const targetOfficers = allOfficersList.filter(o => {
      const isPencacah = o.roles.toLowerCase().includes('pencacah') || o.roles.toLowerCase().includes('ppl');
      return isPencacahFilter ? isPencacah : !isPencacah;
    });

    if (targetOfficers.length === 0) {
      alert(`Tidak ada data petugas untuk peran ${roleFilter}`);
      return;
    }

    const htmlParts = targetOfficers.map((o, idx) => {
      const html = getHtmlForOfficer(o.email, o.roles);
      if (idx < targetOfficers.length - 1) {
        return html + `\n<br clear="all" style="page-break-before:always" />\n`;
      }
      return html;
    });

    const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>Perjanjian Kerja - ${isPencacahFilter ? 'Pencacah' : 'Pengawas'}</title>
  <style>
    @page Section1 {
      size: 841.9pt 595.3pt;
      mso-page-orientation: landscape;
      margin: 1in 1in 1in 1in;
      mso-header-margin: .5in;
      mso-footer-margin: .5in;
      mso-paper-source: 0;
    }
    div.Section1 { page: Section1; }
  </style>
</head>
<body style="font-family: 'Times New Roman', serif; font-size: 11pt;">
<div class="Section1">
${htmlParts.join('')}
</div>
</body>
</html>`;
    const bom = String.fromCharCode(0xFEFF);
    const blob = new Blob([bom, htmlContent], { type: 'application/msword' });
    saveAs(blob, `Perjanjian_Kerja_Semua_${isPencacahFilter ? 'Pencacah' : 'Pengawas'}.doc`);
  }, [allOfficersList, getHtmlForOfficer]);

  if (!isLoggedIn) {
    return (
      <div className={styles.loginContainer}>
        <form onSubmit={handleLogin} className={styles.loginForm}>
          <h3>Login Akses Daftar Petugas</h3>
          {loginError && <p className={styles.error}>{loginError}</p>}
          <input
            type="text"
            placeholder="Username"
            value={loginForm.username}
            onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
            className={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            className={styles.input}
          />
          <button type="submit" className={styles.loginBtn}>Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <h2>Daftar Seluruh Petugas</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className={styles.uploadSuratWrapper} style={{ gap: '10px' }}>
            <button onClick={() => handleDownloadAll('pencacah')} className={styles.exportBtn}>
              <span>📄</span> Export Semua Pencacah
            </button>
            <button onClick={() => handleDownloadAll('pengawas')} className={styles.exportBtn}>
              <span>📄</span> Export Semua Pengawas
            </button>
            <label htmlFor="uploadSurat" className={styles.uploadSuratLabel}>
              <span>📄</span> Upload Nomor Surat (Excel)
            </label>
            <input 
              type="file" 
              id="uploadSurat" 
              accept=".xlsx,.xls" 
              onChange={handleUploadSurat} 
              style={{ display: 'none' }}
            />
          </div>
          <select 
            className={styles.filterSelect}
            value={filterKecamatan}
            onChange={(e) => {
              setFilterKecamatan(e.target.value);
              setCurrentOfficerPage(1);
            }}
          >
            <option value="">Semua Kecamatan</option>
            {allKecamatans.map(kec => (
              <option key={kec} value={kec}>{kec}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Petugas</th>
              <th>Email / Username</th>
              <th>Jabatan</th>
              <th>Kecamatan</th>
              <th>No. Surat</th>
              <th>Jenis Mitra</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {paginatedOfficers.length > 0 ? (
              paginatedOfficers.map((officer, idx) => {
                const isAffirmasi = affirmasi.some(a => a.email.toLowerCase() === officer.email.toLowerCase());
                return (
                <tr key={officer.email}>
                  <td>{(currentOfficerPage - 1) * OFFICER_ITEMS_PER_PAGE + idx + 1}</td>
                  <td><strong>{officer.name}</strong></td>
                  <td>{officer.email}</td>
                  <td>{officer.roles}</td>
                  <td>{officer.kecamatans}</td>
                  <td>
                    {suratData.get(officer.email.toLowerCase()) ? (
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                        {suratData.get(officer.email.toLowerCase())}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--gray-500)' }}>-</span>
                    )}
                  </td>
                  <td>
                    <button 
                      onClick={() => onToggleAffirmasi && onToggleAffirmasi(officer.email, officer.name, officer.kecamatans, officer.roles)}
                      style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        border: isAffirmasi ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(107, 114, 128, 0.4)',
                        backgroundColor: isAffirmasi ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                        color: isAffirmasi ? 'var(--accent-green)' : 'var(--gray-300)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 'bold'
                      }}
                    >
                      {isAffirmasi ? 'Mitra Affirmasi' : 'Mitra Umum'}
                    </button>
                  </td>
                  <td>
                    <button 
                      onClick={() => handleDownloadWord(officer.email, officer.roles)}
                      className={styles.exportBtn}
                    >
                      <span>📄</span> Export Word
                    </button>
                  </td>
                </tr>
              );
            })
            ) : (
              <tr>
                <td colSpan="6" className={styles.emptyState}>Tidak ada data petugas.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalOfficerPages > 1 && (
        <div className={styles.pagination}>
          <button 
            className={styles.pageBtn} 
            disabled={currentOfficerPage === 1}
            onClick={() => setCurrentOfficerPage(p => Math.max(1, p - 1))}
          >
            Sebelumnya
          </button>
          
          <div className={styles.pageNumbers}>
            {getOfficerPageNumbers().map((num, i) => (
              <button
                key={i}
                className={`${styles.numBtn} ${num === currentOfficerPage ? styles.activePage : ''} ${num === '...' ? styles.dots : ''}`}
                disabled={num === '...'}
                onClick={() => num !== '...' && setCurrentOfficerPage(num)}
              >
                {num}
              </button>
            ))}
          </div>

          <button 
            className={styles.pageBtn} 
            disabled={currentOfficerPage === totalOfficerPages}
            onClick={() => setCurrentOfficerPage(p => Math.min(totalOfficerPages, p + 1))}
          >
            Selanjutnya
          </button>
        </div>
      )}
    </div>
  );
}
