import { useState, useMemo, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import styles from './App.module.css';
import UploadZone from './components/UploadZone/UploadZone';
import UploadOfficers from './components/UploadOfficers/UploadOfficers';
import UploadWilayah from './components/UploadWilayah/UploadWilayah';
import FilterBar from './components/FilterBar/FilterBar';
import SECard from './components/SECard/SECard';
import SummaryStats from './components/SummaryStats/SummaryStats';

import AlokasiPetugas from './components/AlokasiPetugas/AlokasiPetugas';
import RekapPetugas from './components/RekapPetugas/RekapPetugas';
import DaftarPetugas from './components/DaftarPetugas/DaftarPetugas';
import BebanKerja from './components/BebanKerja/BebanKerja';
import EvaluasiAffirmasi from './components/EvaluasiAffirmasi/EvaluasiAffirmasi';
import { getRegionName } from './utils/helpers';

const DEFAULT_FILTERS = {
  search: '',
  role: '',
  status: '',
  kecamatan: '',
  desa: '',
  mitraType: '',
  sort: 'uploadedAt-desc',
};

export default function App() {
  const [entries, setEntries] = useState([]);
  const [yesterdayEntries, setYesterdayEntries] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [ignoredEmails, setIgnoredEmails] = useState([]);
  const [verifiedKecamatans, setVerifiedKecamatans] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [wilayahs, setWilayahs] = useState([]);
  const [affirmasi, setAffirmasi] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showUpload, setShowUpload] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isAdminLoggedIn') === 'true');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [isAdministrasiLoggedIn, setIsAdministrasiLoggedIn] = useState(() => localStorage.getItem('isAdministrasiLoggedIn') === 'true');
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminLoginInput, setAdminLoginInput] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [intendedTab, setIntendedTab] = useState('');

  const ITEMS_PER_PAGE = 20;

  const handleAdministrasiNav = (tabId) => {
    if (isAdministrasiLoggedIn) {
      setActiveTab(tabId);
    } else {
      setIntendedTab(tabId);
      setShowAdminLoginModal(false); // reset state to force re-render if needed
      setTimeout(() => setShowAdminLoginModal(true), 0);
    }
  };

  const handleAdminLoginSubmit = (e) => {
    e.preventDefault();
    if (adminLoginInput === 'se2026') {
      setIsAdministrasiLoggedIn(true);
      localStorage.setItem('isAdministrasiLoggedIn', 'true');
      setShowAdminLoginModal(false);
      setAdminLoginError('');
      setAdminLoginInput('');
      if (intendedTab) setActiveTab(intendedTab);
    } else {
      setAdminLoginError('Username tidak valid.');
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginForm.username === 'admin' && loginForm.password === 'password') {
      setIsLoggedIn(true);
      localStorage.setItem('isAdminLoggedIn', 'true');
      setLoginError('');
    } else {
      setLoginError('Username atau password salah.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isAdminLoggedIn');
  };

  const apiUrl = `api.php`;

  // Load initial global data and available dates
  useEffect(() => {
    fetch(`${apiUrl}?type=dates`)
      .then(res => res.json())
      .then(dates => {
        if (Array.isArray(dates) && dates.length > 0) {
          setAvailableDates(dates);
          setSelectedDate(dates[0]); // Trigger data fetch via next useEffect
        } else {
          setIsLoaded(true);
        }
      })
      .catch((err) => {
        console.error('Failed to load dates:', err);
        setIsLoaded(true);
      });

    fetch(`${apiUrl}?type=ignored`)
      .then(res => res.json())
      .then(saved => {
        if (Array.isArray(saved)) setIgnoredEmails(saved);
      })
      .catch((err) => console.error('Failed to load ignored emails:', err));

    fetch(`${apiUrl}?type=verified_kecamatan`)
      .then(res => res.json())
      .then(saved => {
        if (Array.isArray(saved)) setVerifiedKecamatans(saved);
      })
      .catch((err) => console.error('Failed to load verified kecamatans:', err));

    fetch(`${apiUrl}?type=officers`)
      .then(res => res.json())
      .then(saved => {
        if (Array.isArray(saved)) setOfficers(saved);
      })
      .catch((err) => console.error('Failed to load officers:', err));

    fetch(`${apiUrl}?type=wilayah`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setWilayahs(data);
      })
      .catch(err => console.error('Failed to load wilayah:', err));

    fetch(`${apiUrl}?type=affirmasi`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAffirmasi(data);
      })
      .catch(err => console.error('Failed to load affirmasi:', err));
  }, [apiUrl]);

  const [deleteDate, setDeleteDate] = useState('');
  
  // Fetch entries when selectedDate changes
  useEffect(() => {
    if (!selectedDate) return;
    setIsLoaded(false);
    
    const currIndex = availableDates.indexOf(selectedDate);
    // If we have an older date in the array, use it as yesterday.
    // The dates are assumed to be sorted descending (latest first).
    const prevDate = currIndex >= 0 && currIndex + 1 < availableDates.length 
      ? availableDates[currIndex + 1] 
      : null;

    const p1 = fetch(`${apiUrl}?type=data&date=${selectedDate}`).then(r => r.json());
    const p2 = prevDate ? fetch(`${apiUrl}?type=data&date=${prevDate}`).then(r => r.json()) : Promise.resolve([]);

    Promise.all([p1, p2])
      .then(([latest, prev]) => {
        if (Array.isArray(latest)) setEntries(latest);
        if (Array.isArray(prev)) setYesterdayEntries(prev);
      })
      .catch((err) => console.error('Failed to load entries for date:', err))
      .finally(() => setIsLoaded(true));
  }, [selectedDate, availableDates, apiUrl]);


  const handleClearData = useCallback(async () => {
    if (!window.confirm("Peringatan: Tindakan ini akan menghapus SELURUH data progress yang telah diupload! Apakah Anda yakin?")) {
      return;
    }
    try {
      const res = await fetch(`${apiUrl}?type=clear_all_data`, { method: 'DELETE' });
      const json = await res.json();
      if (json.status === 'success') {
        setEntries([]);
        setYesterdayEntries([]);
        setAvailableDates([]);
        setIgnoredEmails([]);
        setVerifiedKecamatans([]);
        alert("Semua data progress berhasil dihapus.");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat menghapus data.");
    }
  }, [apiUrl]);

  const handleDeleteByDate = useCallback(async () => {
    if (!deleteDate) {
      alert("Pilih tanggal terlebih dahulu.");
      return;
    }
    if (!window.confirm(`Peringatan: Anda akan menghapus data progress untuk tanggal ${deleteDate}! Apakah Anda yakin?`)) {
      return;
    }
    try {
      const res = await fetch(`${apiUrl}?type=delete_by_date&date=${deleteDate}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.status === 'success') {
        alert(`Data progress untuk tanggal ${deleteDate} berhasil dihapus.`);
        window.location.reload();
      } else {
        alert(`Gagal menghapus data: ${json.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat menghapus data.");
    }
  }, [apiUrl, deleteDate]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  /* ---------- Upload handler ---------- */
  const handleUpload = useCallback((newEntries, uploadDate, uploadType = 'pencacah', stats = {}) => {
    fetch(`${apiUrl}?type=data&date=${uploadDate}&uploadType=${uploadType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEntries)
    }).then(() => {
      let msg = `Data berhasil disimpan untuk tanggal ${uploadDate}.`;
      if (stats.valid !== undefined) {
        msg += `\n\nRingkasan Upload:\n✅ Berhasil: ${stats.valid} baris\n❌ Error/Dilewati: ${stats.error} baris`;
      }
      alert(msg);
      window.location.reload();
    }).catch(err => console.error('Failed to save data:', err));
  }, [apiUrl]);

  const handleUploadOfficers = useCallback((newOfficers) => {
    setOfficers(newOfficers);
    fetch(`${apiUrl}?type=officers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOfficers)
    }).catch(err => console.error('Failed to save officers:', err));
    alert('Data petugas berhasil disimpan!');
  }, [apiUrl]);

  const handleUploadWilayah = useCallback((newWilayahs) => {
    setWilayahs(newWilayahs);
    fetch(`${apiUrl}?type=wilayah`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newWilayahs)
    }).catch(err => console.error('Failed to save wilayahs:', err));
    alert('Master Wilayah berhasil disimpan!');
  }, [apiUrl]);

  const handleUploadAffirmasi = useCallback((newAffirmasi) => {
    setAffirmasi(newAffirmasi);
    fetch(`${apiUrl}?type=affirmasi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAffirmasi)
    }).catch(err => console.error('Failed to save affirmasi:', err));
    alert('Data Mitra Affirmasi berhasil disimpan!');
  }, [apiUrl]);

  const handleToggleAffirmasi = useCallback((email, nama, kecamatan, role) => {
    let newAffirmasi;
    if (affirmasi.some(a => a.email === email)) {
      newAffirmasi = affirmasi.filter(a => a.email !== email);
    } else {
      newAffirmasi = [...affirmasi, { email, nama, kecamatan, role }];
    }
    setAffirmasi(newAffirmasi);
    fetch(`${apiUrl}?type=affirmasi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAffirmasi)
    }).catch(err => console.error('Failed to save affirmasi:', err));
  }, [affirmasi, apiUrl]);

  /* ---------- Pagination Helpers ---------- */
  const handleRemove = useCallback((id) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  /* ---------- Update Officer Tags ---------- */
  const handleUpdateOfficerTags = useCallback((email, tags) => {
    setOfficers(prev => {
      const newOfficers = [...prev];
      const index = newOfficers.findIndex(o => o.email.toLowerCase() === email.toLowerCase());
      if (index !== -1) {
        newOfficers[index] = { ...newOfficers[index], tags };
      } else {
        newOfficers.push({ email, tags });
      }

      fetch(`${apiUrl}?type=officers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOfficers)
      }).catch(err => console.error('Failed to save officers tags:', err));

      return newOfficers;
    });
  }, [apiUrl]);

  /* ---------- Ignore Officer ---------- */
  const handleToggleIgnore = useCallback((email, isIgnored) => {
    setIgnoredEmails(prev => {
      let newIgnored;
      if (isIgnored) {
        newIgnored = [...prev, email];
      } else {
        newIgnored = prev.filter(e => e !== email);
      }
      fetch(`${apiUrl}?type=ignored`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newIgnored)
      }).catch(err => console.error('Failed to save ignored emails:', err));
      return newIgnored;
    });
  }, [apiUrl]);

  /* ---------- Verify Kecamatan ---------- */
  const handleToggleVerifyKecamatan = useCallback((kdkec, isVerified) => {
    setVerifiedKecamatans(prev => {
      let newVerified;
      if (isVerified) {
        newVerified = [...prev, kdkec];
      } else {
        newVerified = prev.filter(k => k !== kdkec);
      }
      fetch(`${apiUrl}?type=verified_kecamatan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVerified)
      }).catch(err => console.error('Failed to save verified kecamatans:', err));
      return newVerified;
    });
  }, [apiUrl]);

  /* ---------- Filter change ---------- */
  const handleFilterChange = useCallback((key, val) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: val };
      if (key === 'kecamatan') {
        newFilters.desa = ''; // reset desa when kecamatan changes
      }
      return newFilters;
    });
  }, []);

  /* ---------- Filtered + Sorted entries ---------- */
  const activeEntries = useMemo(() => {
    return entries.filter(e => !ignoredEmails.includes(e.email));
  }, [entries, ignoredEmails]);

  const activeYesterdayEntries = useMemo(() => {
    return yesterdayEntries.filter(e => !ignoredEmails.includes(e.email));
  }, [yesterdayEntries, ignoredEmails]);

  const displayed = useMemo(() => {
    let result = [...activeEntries];

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter(e => {
        const officer = officers.find(o => (o.email || '').toLowerCase() === (e.email || '').toLowerCase());
        const mappedName = officer ? (officer.Nama || '').toLowerCase() : '';
        
        return (e.fetchLabel || '').toLowerCase().includes(q) ||
               (e.email || '').toLowerCase().includes(q) ||
               (e.roleName || '').toLowerCase().includes(q) ||
               mappedName.includes(q) ||
               (e.regionSummary || []).some(r => (r.regionCode || '').toLowerCase().includes(q));
      });
    }

    if (filters.kecamatan) {
      result = result.filter(e => e.fetchLabel === filters.kecamatan);
    }

    if (filters.desa) {
      result = result.filter(e => 
        e.regionSummary.some(r => {
          if (r.regionCode && r.regionCode.length >= 10) {
            return r.regionCode.substring(7, 10) === filters.desa;
          }
          return false;
        })
      );
    }

    if (filters.role) {
      result = result.filter(e =>
        e.roleName.toLowerCase().includes(filters.role.toLowerCase())
      );
    }

    if (filters.status) {
      result = result.filter(e =>
        e.regionSummary.some(r =>
          r.statusBreakdown.some(s =>
            s.status.toLowerCase().includes(filters.status.toLowerCase())
          )
        )
      );
    }

    if (filters.mitraType) {
      result = result.filter(e => {
        const isAffirmasi = affirmasi.some(a => a.email.toLowerCase() === e.email.toLowerCase());
        return filters.mitraType === 'Affirmasi' ? isAffirmasi : !isAffirmasi;
      });
    }

    const [sortField, sortDir] = filters.sort.split('-');
    result.sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'fetchLabel') {
        aVal = a.fetchLabel.toLowerCase();
        bVal = b.fetchLabel.toLowerCase();
      } else if (sortField === 'total') {
        aVal = a.total;
        bVal = b.total;
      } else if (sortField === 'progress') {
        const getProgress = e => {
          const done = e.regionSummary.reduce((acc, r) =>
            acc + r.statusBreakdown
              .filter(s => !s.status.toLowerCase().includes('open'))
              .reduce((a, s) => a + s.count, 0), 0);
          return e.total > 0 ? done / e.total : 0;
        };
        aVal = getProgress(a);
        bVal = getProgress(b);
      } else {
        aVal = new Date(a.uploadedAt).getTime();
        bVal = new Date(b.uploadedAt).getTime();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [activeEntries, filters, officers]);

  const downloadExcelDaftarSE = useCallback(() => {
    const wsData = displayed.map((d, index) => {
      const stats = { draft: 0, open: 0, submitted: 0, approved: 0, rejected: 0 };
      d.regionSummary?.forEach(r => {
        r.statusBreakdown?.forEach(s => {
          const st = s.status.toLowerCase();
          if (st.includes('draft')) stats.draft += s.count;
          else if (st.includes('open')) stats.open += s.count;
          else if (st.includes('submitted')) stats.submitted += s.count;
          else if (st.includes('approved')) stats.approved += s.count;
          else if (st.includes('rejected')) stats.rejected += s.count;
        });
      });

      const done = stats.submitted + stats.approved + stats.rejected;
      const progress = d.total > 0 ? ((done / d.total) * 100).toFixed(2) : 0;
      
      let yTotalDone = 0;
      if (activeYesterdayEntries && activeYesterdayEntries.length > 0) {
        const yData = activeYesterdayEntries.find(e => e.id === d.id || (e.email === d.email && e.roleName === d.roleName));
        if (yData) {
          yData.regionSummary?.forEach(r => {
            r.statusBreakdown?.forEach(s => {
              const st = s.status.toLowerCase();
              if (st.includes('submitted') || st.includes('approved') || st.includes('rejected')) {
                yTotalDone += s.count;
              }
            });
          });
        }
      }
      const selisih = activeYesterdayEntries.length > 0 ? (done - yTotalDone) : 0;
      
      const officer = officers.find(o => o.email.toLowerCase() === d.email.toLowerCase());
      const namaPetugas = officer ? officer.Nama : '-';
      
      const isAffirmasi = affirmasi.some(a => a.email.toLowerCase() === d.email.toLowerCase());
      const mitraType = isAffirmasi ? 'Mitra Affirmasi' : 'Mitra Umum';

      return {
        'No': index + 1,
        'Kecamatan / Label': d.fetchLabel,
        'Role': d.roleName,
        'Nama Petugas': namaPetugas,
        'Email': d.email,
        'Jenis Mitra': mitraType,
        'Total Sampel': d.total,
        'Draft': stats.draft,
        'Open': stats.open,
        'Submitted': stats.submitted,
        'Approved': stats.approved,
        'Rejected': stats.rejected,
        'Total Selesai': done,
        'Tambahan Selesai dari Kemarin': selisih,
        'Progress (%)': Number(progress),
        'Tanggal Upload': new Date(d.uploadedAt).toLocaleString('id-ID')
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar SE");
    XLSX.writeFile(wb, "Daftar_SE.xlsx");
  }, [displayed]);

  const kecamatanOptions = useMemo(() => {
    const labels = new Set(activeEntries.map(e => e.fetchLabel).filter(Boolean));
    return Array.from(labels).sort();
  }, [activeEntries]);

  const desaOptions = useMemo(() => {
    if (!filters.kecamatan) return [];
    
    const desasMap = new Map();
    activeEntries.forEach(e => {
      if (e.fetchLabel === filters.kecamatan) {
        e.regionSummary?.forEach(r => {
          if (r.regionCode && r.regionCode.length >= 10) {
            const kecCode = r.regionCode.substring(4, 7);
            const desaCode = r.regionCode.substring(7, 10);
            
            let nmdesa = '';
            const matchedDesa = wilayahs.find(w => w.kdkec === kecCode && w.kddesa === desaCode);
            if (matchedDesa && matchedDesa.nmdesa) {
              nmdesa = matchedDesa.nmdesa;
            } else {
              // Fallback jika tidak match dengan kdkec
              const matchedDesaOnly = wilayahs.find(w => w.kddesa === desaCode);
              if (matchedDesaOnly && matchedDesaOnly.nmdesa) {
                nmdesa = matchedDesaOnly.nmdesa;
              }
            }
            
            if (!nmdesa && r.nmdesa) {
              nmdesa = r.nmdesa;
            }
            
            if (!desasMap.has(desaCode)) {
              desasMap.set(desaCode, { code: desaCode, name: nmdesa || `Desa ${desaCode}` });
            }
          }
        });
      }
    });
    return Array.from(desasMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [activeEntries, filters.kecamatan, wilayahs]);

  const lastUpdated = useMemo(() => {
    if (activeEntries.length === 0) return null;
    return activeEntries.reduce((latest, current) => {
      if (!latest || new Date(current.uploadedAt) > new Date(latest)) {
        return current.uploadedAt;
      }
      return latest;
    }, null);
  }, [activeEntries]);

  const hasData = entries.length > 0;
  
  const totalPages = Math.ceil(displayed.length / ITEMS_PER_PAGE);
  const paginatedEntries = displayed.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  return (
    <div className={styles.app}>
      {/* ===== HEADER ===== */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <div className={styles.logo}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" fill="currentColor" opacity="0.4"/>
                <path d="M5 5h3v3H5V5zm11 0h3v3h-3V5zM5 16h3v3H5v-3zm11 0h3v3h-3v-3z" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <h1 className={styles.brandTitle}>Monitoring SE</h1>
              <p className={styles.brandSub}>BPS Kabupaten Deli Serdang</p>
            </div>
          </div>
          <div className={styles.navTabs}>
            <button 
              className={`${styles.navTab} ${activeTab === 'dashboard' ? styles.navTabActive : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button 
              className={`${styles.navTab} ${activeTab === 'alokasi' ? styles.navTabActive : ''}`}
              onClick={() => setActiveTab('alokasi')}
            >
              Alokasi Petugas
            </button>
            <button 
              className={`${styles.navTab} ${activeTab === 'rekap' ? styles.navTabActive : ''}`}
              onClick={() => setActiveTab('rekap')}
            >
              Rekap Petugas
            </button>
            <div className={styles.dropdown}>
              <button className={`${styles.navTab} ${['daftar-petugas', 'beban-kerja', 'evaluasi-affirmasi'].includes(activeTab) ? styles.navTabActive : ''}`}>
                Administrasi ▾
              </button>
              <div className={styles.dropdownContent}>
                <button 
                  className={`${styles.dropdownItem} ${activeTab === 'daftar-petugas' ? styles.dropdownItemActive : ''}`}
                  onClick={() => handleAdministrasiNav('daftar-petugas')}
                >
                  Daftar Petugas
                </button>
                <button 
                  className={`${styles.dropdownItem} ${activeTab === 'beban-kerja' ? styles.dropdownItemActive : ''}`}
                  onClick={() => handleAdministrasiNav('beban-kerja')}
                >
                  Beban Kerja
                </button>
                <button 
                  className={`${styles.dropdownItem} ${activeTab === 'evaluasi-affirmasi' ? styles.dropdownItemActive : ''}`}
                  onClick={() => handleAdministrasiNav('evaluasi-affirmasi')}
                >
                  Evaluasi Affirmasi
                </button>
              </div>
            </div>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.liveIndicator}>
              <span className={styles.liveDot} />
              <span>Live Monitoring</span>
            </div>
            
            <div className={styles.globalDateFilter}>
              <select 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className={styles.globalDateSelect}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--gray-600)',
                  backgroundColor: 'var(--gray-800)',
                  color: 'var(--gray-100)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: 'pointer',
                  marginLeft: '12px'
                }}
              >
                {availableDates.length > 0 ? (
                  availableDates.map(dateStr => (
                    <option key={dateStr} value={dateStr}>
                      {new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </option>
                  ))
                ) : (
                  <option value="">Tidak ada data</option>
                )}
              </select>
            </div>

            <button className={styles.uploadToggleBtn} onClick={() => setShowUpload(v => !v)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{showUpload ? 'Tutup Upload' : 'Upload File'}</span>
            </button>

          </div>
        </div>
      </header>

      {showAdminLoginModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Login Administrasi</h3>
            <form onSubmit={handleAdminLoginSubmit}>
              <input 
                type="text" 
                placeholder="Masukkan Username" 
                className={styles.modalInput}
                value={adminLoginInput}
                onChange={(e) => setAdminLoginInput(e.target.value)}
                autoFocus
              />
              {adminLoginError && <p style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.85rem' }}>{adminLoginError}</p>}
              <div className={styles.modalActions}>
                <button type="button" className={`${styles.modalBtn} ${styles.modalBtnSecondary}`} onClick={() => {setShowAdminLoginModal(false); setAdminLoginError(''); setAdminLoginInput('');}}>Batal</button>
                <button type="submit" className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}>Login</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== MAIN ===== */}
      <main className={styles.main}>
        {showUpload && (
          <section className={styles.section}>
              {isLoggedIn && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <button 
                    className={styles.clearDataBtn}
                    onClick={handleClearData}
                    style={{ backgroundColor: '#ef4444', color: 'white', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                  >
                    🗑️ Hapus Seluruh Data
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: 'var(--gray-800)', padding: '4px', borderRadius: '6px' }}>
                    <input 
                      type="date" 
                      value={deleteDate} 
                      onChange={(e) => setDeleteDate(e.target.value)} 
                      style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--gray-700)', backgroundColor: 'var(--gray-900)', color: 'var(--gray-100)' }}
                    />
                    <button 
                      onClick={handleDeleteByDate}
                      style={{ backgroundColor: '#f97316', color: 'white', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                    >
                      Hapus Data Tanggal Ini
                    </button>
                  </div>
                  <button 
                    onClick={handleLogout}
                    style={{ marginLeft: 'auto', backgroundColor: 'var(--gray-700)', color: 'white', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                  >
                    🚪 Logout Admin
                  </button>
                </div>
              )}
              {isLoggedIn ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                  <UploadZone onUpload={handleUpload} />
                  <UploadOfficers onUpload={handleUploadOfficers} />
                  <UploadWilayah onUpload={handleUploadWilayah} />
                </div>
              ) : (
                <div className={styles.loginCard}>
                  <h3 className={styles.loginTitle}>🔑 Admin Login</h3>
                  <form className={styles.loginForm} onSubmit={handleLogin}>
                    <input
                      type="text"
                      placeholder="Username"
                      value={loginForm.username}
                      onChange={e => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                      className={styles.loginInput}
                      required
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={loginForm.password}
                      onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                      className={styles.loginInput}
                      required
                    />
                    {loginError && <p className={styles.loginError}>{loginError}</p>}
                    <button type="submit" className={styles.loginBtn}>Login</button>
                  </form>
                </div>
              )}
          </section>
        )}

        {activeTab === 'alokasi' && hasData && (
          <section className={styles.section}>
            <AlokasiPetugas 
              entries={activeEntries} 
              yesterdayEntries={activeYesterdayEntries}
              officers={officers} 
              wilayahs={wilayahs}
              onUpdateTags={handleUpdateOfficerTags} 
              isAdmin={isLoggedIn}
            />
          </section>
        )}

        {activeTab === 'rekap' && hasData && (
          <section className={styles.section}>
            <RekapPetugas 
              entries={entries}
              officers={officers}
              wilayahs={wilayahs}
              ignoredEmails={ignoredEmails}
              verifiedKecamatans={verifiedKecamatans}
              onToggleIgnore={handleToggleIgnore}
              onToggleVerifyKecamatan={handleToggleVerifyKecamatan}
              isAdmin={isLoggedIn}
            />
          </section>
        )}

        {activeTab === 'daftar-petugas' && hasData && (
          <section className={styles.section}>
            <DaftarPetugas
              entries={entries}
              officers={officers}
              wilayahs={wilayahs}
              affirmasi={affirmasi}
              onToggleAffirmasi={handleToggleAffirmasi}
            />
          </section>
        )}

        {activeTab === 'beban-kerja' && (
          <section className={styles.section}>
            <BebanKerja 
              entries={activeEntries} 
              officers={officers}
              wilayahs={wilayahs}
            />
          </section>
        )}

        {activeTab === 'evaluasi-affirmasi' && (
          <section className={styles.section}>
            <EvaluasiAffirmasi
              entries={entries}
              yesterdayEntries={activeYesterdayEntries}
              officers={officers}
              affirmasi={affirmasi}
              onUploadAffirmasi={handleUploadAffirmasi}
            />
          </section>
        )}

        {activeTab === 'dashboard' && hasData && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.titleIcon}>📊</span>
                Ringkasan
              </h2>
            </div>
            <SummaryStats entries={displayed} yesterdayEntries={activeYesterdayEntries} filters={filters} />
          </section>
        )}



        {activeTab === 'dashboard' && hasData && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.titleIcon}>👤</span>
                Daftar SE
              </h2>
              <button className={styles.downloadExcelBtn} onClick={downloadExcelDaftarSE}>
                <span>📥</span> Download Excel
              </button>
            </div>
            <FilterBar
              filters={filters}
              onFilterChange={handleFilterChange}
              totalShown={displayed.length}
              totalAll={activeEntries.length}
              kecamatanOptions={kecamatanOptions}
              desaOptions={desaOptions}
              lastUpdated={lastUpdated}
            />
            {displayed.length === 0 ? (
              <div className={styles.emptySearch}>
                <div className={styles.emptyIcon}>🔍</div>
                <p>Tidak ada data yang cocok dengan filter.</p>
                <button className={styles.resetFilterBtn} onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className={styles.listContainer}>
                <div className={styles.cardGrid}>
                  {paginatedEntries.map(entry => (
                    <SECard key={entry.id} data={entry} onRemove={handleRemove} officers={officers} yesterdayEntries={activeYesterdayEntries} wilayahs={wilayahs} affirmasi={affirmasi} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button 
                      className={styles.pageBtn} 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                      Sebelumnya
                    </button>
                    
                    <div className={styles.pageNumbers}>
                      {getPageNumbers().map((num, i) => (
                        <button
                          key={i}
                          className={`${styles.numBtn} ${num === currentPage ? styles.activePage : ''} ${num === '...' ? styles.dots : ''}`}
                          disabled={num === '...'}
                          onClick={() => num !== '...' && setCurrentPage(num)}
                        >
                          {num}
                        </button>
                      ))}
                    </div>

                    <button 
                      className={styles.pageBtn} 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    >
                      Selanjutnya
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {!hasData && (
          <div className={styles.emptyState}>
            <div className={styles.emptyHero}>
              <div className={styles.emptyGlow} />
              <div className={styles.emptyEmoji}>📁</div>
              <h2>Belum Ada Data</h2>
              <p>Upload file JSON hasil monitoring SE untuk mulai memantau progress pencacahan.</p>
            </div>
            <div className={styles.featureList}>
              {[
                { icon: '⬆️', text: 'Upload beberapa file JSON sekaligus' },
                { icon: '🔍', text: 'Filter berdasarkan nama, role, atau status' },
                { icon: '↕️', text: 'Sort berdasarkan progress atau total sampel' },
                { icon: '📊', text: 'Ringkasan statistik keseluruhan' },
                { icon: '🗺️', text: 'Detail breakdown per wilayah' },
              ].map(f => (
                <div key={f.text} className={styles.featureItem}>
                  <span>{f.icon}</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <p>© 2025 BPS Kabupaten Deli Serdang · Monitoring Survei Ekonomi</p>
      </footer>
    </div>
  );
}
