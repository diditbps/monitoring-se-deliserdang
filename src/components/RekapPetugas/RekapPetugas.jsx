import { useState, useMemo } from 'react';
import styles from './RekapPetugas.module.css';

export default function RekapPetugas({ entries, officers, wilayahs, ignoredEmails = [], verifiedKecamatans = [], onToggleIgnore, onToggleVerifyKecamatan, isAdmin }) {
  const [filterKecamatan, setFilterKecamatan] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentDupPage, setCurrentDupPage] = useState(1);
  const DUP_ITEMS_PER_PAGE = 10;

  const kecamatanData = useMemo(() => {
    const map = new Map();

    entries.forEach(entry => {
      const isPencacah = entry.roleName?.toLowerCase().includes('pencacah');
      const isPengawas = entry.roleName?.toLowerCase().includes('pengawas');

      entry.regionSummary?.forEach(reg => {
        const kdkec = reg.regionCode.substring(4, 7);
        const wil = wilayahs?.find(w => w.kdkec === kdkec);
        const kecName = wil ? wil.nmkec : (entry.fetchLabel || '-');

        if (!map.has(kecName)) {
          map.set(kecName, { kdkec: wil ? kdkec : '-', kecName, pencacah: new Set(), pengawas: new Set() });
        }

        const data = map.get(kecName);
        if (isPencacah) data.pencacah.add(entry.email);
        if (isPengawas) data.pengawas.add(entry.email);
      });
    });

    let result = Array.from(map.values()).map(d => ({
      kdkec: d.kdkec,
      kecName: d.kecName,
      pencacahCount: d.pencacah.size,
      pengawasCount: d.pengawas.size,
    }));

    if (filterKecamatan) {
      result = result.filter(r => r.kecName === filterKecamatan);
    }

    result.sort((a, b) => {
      const aVal = a.kdkec;
      const bVal = b.kdkec;
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [entries, wilayahs, filterKecamatan, sortOrder]);

  const totals = useMemo(() => {
    return kecamatanData.reduce((acc, curr) => {
      acc.pencacah += curr.pencacahCount;
      acc.pengawas += curr.pengawasCount;
      return acc;
    }, { pencacah: 0, pengawas: 0 });
  }, [kecamatanData]);

  const duplicates = useMemo(() => {
    const nameToEmails = new Map();
    const emailToData = new Map();

    entries.forEach(entry => {
      const officer = officers.find(o => o.email.toLowerCase() === entry.email.toLowerCase());
      const name = officer?.Nama || entry.email;
      const lowerName = name.toLowerCase();
      
      if (!nameToEmails.has(lowerName)) {
        nameToEmails.set(lowerName, new Set());
      }
      nameToEmails.get(lowerName).add(entry.email);

      if (!emailToData.has(entry.email)) {
        emailToData.set(entry.email, {
          name,
          email: entry.email,
          roles: new Set(),
          kecamatans: new Set()
        });
      }
      
      const data = emailToData.get(entry.email);
      data.roles.add(entry.roleName);
      data.kecamatans.add(entry.fetchLabel);
    });

    const results = [];

    nameToEmails.forEach((emailsSet, lowerName) => {
      if (emailsSet.size > 1) {
        emailsSet.forEach(email => {
          const d = emailToData.get(email);
          results.push({
            name: d.name, // Use the original cased name from data
            email,
            reason: 'Nama sama dengan email berbeda',
            roles: Array.from(d.roles).join(', '),
            kecamatans: Array.from(d.kecamatans).join(', ')
          });
        });
      } else {
        const email = Array.from(emailsSet)[0];
        const d = emailToData.get(email);
        if (d.kecamatans.size > 1) {
          results.push({
            name: d.name,
            email,
            reason: 'Terdaftar di lebih dari 1 Kecamatan',
            roles: Array.from(d.roles).join(', '),
            kecamatans: Array.from(d.kecamatans).join(', ')
          });
        }
      }
    });

    // Sort by name so duplicates appear together
    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }, [entries, officers]);

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

  const totalDupPages = Math.ceil(duplicates.length / DUP_ITEMS_PER_PAGE);
  const paginatedDuplicates = duplicates.slice((currentDupPage - 1) * DUP_ITEMS_PER_PAGE, currentDupPage * DUP_ITEMS_PER_PAGE);

  const getDupPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalDupPages; i++) {
      if (i === 1 || i === totalDupPages || (i >= currentDupPage - 1 && i <= currentDupPage + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <h2>Rekapitulasi Petugas per Kecamatan</h2>
        <select 
          className={styles.filterSelect}
          value={filterKecamatan}
          onChange={(e) => setFilterKecamatan(e.target.value)}
        >
          <option value="">Semua Kecamatan</option>
          {allKecamatans.map(kec => (
            <option key={kec} value={kec}>{kec}</option>
          ))}
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th 
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                title="Urutkan berdasarkan Kode Kecamatan"
              >
                Kode Kecamatan {sortOrder === 'asc' ? '▲' : '▼'}
              </th>
              <th>Kecamatan</th>
              <th>Jumlah Pencacah</th>
              <th>Jumlah Pengawas</th>
              <th>Total Petugas</th>
              <th>Status Kesesuaian</th>
            </tr>
          </thead>
          <tbody>
            {kecamatanData.length > 0 ? (
              <>
                {kecamatanData.map((data, idx) => {
                  const isVerified = verifiedKecamatans.includes(data.kdkec);
                  return (
                    <tr key={data.kecName}>
                      <td>{data.kdkec}</td>
                      <td>{data.kecName}</td>
                      <td>{data.pencacahCount}</td>
                      <td>{data.pengawasCount}</td>
                      <td>{data.pencacahCount + data.pengawasCount}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {isVerified ? (
                            <span className={styles.badge} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>Sudah Sesuai</span>
                          ) : (
                            <span className={styles.badge} style={{ background: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af' }}>Belum Sesuai</span>
                          )}
                          {isAdmin && (
                            <div className={styles.actionBtns}>
                              {!isVerified ? (
                                <button 
                                  className={`${styles.actionBtn} ${styles.actionBtnActive}`}
                                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                  onClick={() => onToggleVerifyKecamatan && onToggleVerifyKecamatan(data.kdkec, true)}
                                >
                                  ✔ Sesuai
                                </button>
                              ) : (
                                <button 
                                  className={styles.actionBtn}
                                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                  onClick={() => onToggleVerifyKecamatan && onToggleVerifyKecamatan(data.kdkec, false)}
                                >
                                  Batal
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 'bold', background: 'var(--gray-700)' }}>
                  <td colSpan="2" style={{ textAlign: 'center' }}>Total Deli Serdang</td>
                  <td>{totals.pencacah}</td>
                  <td>{totals.pengawas}</td>
                  <td>{totals.pencacah + totals.pengawas}</td>
                  <td></td>
                </tr>
              </>
            ) : (
              <tr>
                <td colSpan="6" className={styles.emptyState}>Tidak ada data rekapitulasi.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {duplicates.length > 0 && (
        <div className={styles.duplicateSection}>
          <h3 className={styles.duplicateTitle}>
            <span>⚠️</span> Indikasi Data Petugas Bermasalah / Duplikat
          </h3>
          <div className={styles.tableWrapper} style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nama Petugas</th>
                  <th>Email / Username</th>
                  <th>Role</th>
                  <th>Kecamatan</th>
                  <th>Keterangan</th>
                  {isAdmin && <th>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedDuplicates.map((dup, idx) => {
                  const isIgnored = ignoredEmails.includes(dup.email);
                  return (
                    <tr key={`${dup.email}-${idx}`} style={{ opacity: isIgnored ? 0.6 : 1, background: isIgnored ? 'rgba(0,0,0,0.2)' : 'transparent' }}>
                      <td>
                        <strong>{dup.name}</strong>
                        {isIgnored && <span className={styles.badge} style={{ marginLeft: '8px' }}>Diabaikan</span>}
                      </td>
                      <td>{dup.email}</td>
                      <td>{dup.roles}</td>
                      <td>{dup.kecamatans}</td>
                      <td><span className={styles.badge}>{dup.reason}</span></td>
                      {isAdmin && (
                        <td>
                          <div className={styles.actionBtns}>
                            <button 
                              className={`${styles.actionBtn} ${!isIgnored ? styles.actionBtnActive : ''}`}
                              onClick={() => onToggleIgnore && onToggleIgnore(dup.email, false)}
                            >
                              Digunakan
                            </button>
                            <button 
                              className={`${styles.actionBtn} ${styles.actionBtnDanger} ${isIgnored ? styles.actionBtnDangerActive : ''}`}
                              onClick={() => onToggleIgnore && onToggleIgnore(dup.email, true)}
                            >
                              Tidak Digunakan
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalDupPages > 1 && (
            <div className={styles.pagination}>
              <button 
                className={styles.pageBtn} 
                disabled={currentDupPage === 1}
                onClick={() => setCurrentDupPage(p => Math.max(1, p - 1))}
              >
                Sebelumnya
              </button>
              
              <div className={styles.pageNumbers}>
                {getDupPageNumbers().map((num, i) => (
                  <button
                    key={i}
                    className={`${styles.numBtn} ${num === currentDupPage ? styles.activePage : ''} ${num === '...' ? styles.dots : ''}`}
                    disabled={num === '...'}
                    onClick={() => num !== '...' && setCurrentDupPage(num)}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <button 
                className={styles.pageBtn} 
                disabled={currentDupPage === totalDupPages}
                onClick={() => setCurrentDupPage(p => Math.min(totalDupPages, p + 1))}
              >
                Selanjutnya
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
