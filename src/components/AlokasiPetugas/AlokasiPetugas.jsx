import { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import styles from './AlokasiPetugas.module.css';

const ITEMS_PER_PAGE = 20;

export default function AlokasiPetugas({ entries, yesterdayEntries = [], officers, wilayahs, onUpdateTags, isAdmin }) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState('regionCode');
  const [sortDirection, setSortDirection] = useState('asc');
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  const regionData = useMemo(() => {
    const regionMap = {};

    const yDoneMap = new Map();
    if (yesterdayEntries) {
      yesterdayEntries.forEach(y => {
        let yDone = 0;
        y.regionSummary?.forEach(reg => {
          reg.statusBreakdown?.forEach(st => {
            const s = st.status.toLowerCase();
            if (s.includes('submitted') || s.includes('approved') || s.includes('rejected')) {
              yDone += st.count;
            }
          });
        });
        yDoneMap.set(y.id, yDone);
      });
    }

    entries.forEach(entry => {
      const isPencacah = entry.roleName?.toLowerCase().includes('pencacah');
      const isPengawas = entry.roleName?.toLowerCase().includes('pengawas');
      
      const officer = officers.find(o => o.email.toLowerCase() === entry.email.toLowerCase());
      const officerName = officer?.Nama || entry.email;
      const officerTags = officer?.tags || [];
      
      let officerDone = 0;
      let officerTotal = entry.total || 0;
      entry.regionSummary?.forEach(reg => {
        reg.statusBreakdown?.forEach(st => {
           const s = st.status.toLowerCase();
           if (s.includes('submitted') || s.includes('approved') || s.includes('rejected')) {
             officerDone += st.count;
           }
        });
      });
      const officerProgress = officerTotal > 0 ? Math.round((officerDone / officerTotal) * 100) : 0;
      
      const yDone = yDoneMap.get(entry.id);
      let diff = null;
      if (yDone !== undefined) {
        diff = officerDone - yDone;
      }

      entry.regionSummary?.forEach(reg => {
        if (!regionMap[reg.regionCode]) {
          const kdkab = reg.regionCode.substring(0, 4);
          const kdkec = reg.regionCode.substring(4, 7);
          const kddesa = reg.regionCode.substring(7, 10);
          const kdsls = reg.regionCode.substring(10, 14);
          const kdsubsls = reg.regionCode.substring(14, 16);
          
          let wil = null;
          if (wilayahs && wilayahs.length > 0) {
            wil = wilayahs.find(w => w.kdkec === kdkec && w.kddesa === kddesa && w.kdsls === kdsls && w.kdsubsls === kdsubsls);
          }

          regionMap[reg.regionCode] = {
            regionCode: reg.regionCode,
            namaKecamatan: wil ? wil.nmkec : '-',
            namaDesa: wil ? wil.nmdesa : '-',
            namaSls: wil ? wil.nmsls : '-',
            open: 0,
            draft: 0,
            submitted: 0,
            approved: 0,
            rejected: 0,
            pencacah: [],
            pengawas: []
          };
        }
        
        const rm = regionMap[reg.regionCode];

        if (isPencacah) {
          if (!rm.pencacah.find(p => p.email === entry.email)) {
            rm.pencacah.push({ name: officerName, email: entry.email, tags: officerTags, progress: officerProgress, diff });
          }
          // Sum counts from pencacah entries to avoid double counting from pengawas
          reg.statusBreakdown?.forEach(st => {
            const s = st.status.toLowerCase();
            if (s.includes('open')) rm.open += st.count;
            else if (s.includes('draft')) rm.draft += st.count;
            else if (s.includes('submitted')) rm.submitted += st.count;
            else if (s.includes('approved')) rm.approved += st.count;
            else if (s.includes('rejected')) rm.rejected += st.count;
          });
        } else if (isPengawas) {
          if (!rm.pengawas.find(p => p.email === entry.email)) {
            rm.pengawas.push({ name: officerName, email: entry.email, tags: officerTags, progress: officerProgress, diff });
          }
        }
      });
    });

    let result = Object.values(regionMap);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r => 
        r.regionCode.toLowerCase().includes(q) ||
        r.pencacah.some(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)) ||
        r.pengawas.some(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortColumn === 'regionCode') {
        valA = a.regionCode;
        valB = b.regionCode;
      } else if (sortColumn === 'pencacah') {
        valA = a.pencacah.map(p => p.name).join(', ').toLowerCase();
        valB = b.pencacah.map(p => p.name).join(', ').toLowerCase();
      } else if (sortColumn === 'pengawas') {
        valA = a.pengawas.map(p => p.name).join(', ').toLowerCase();
        valB = b.pengawas.map(p => p.name).join(', ').toLowerCase();
      } else if (sortColumn === 'progressPencacah') {
        valA = a.pencacah[0]?.progress || 0;
        valB = b.pencacah[0]?.progress || 0;
      } else if (sortColumn === 'progressPengawas') {
        valA = a.pengawas[0]?.progress || 0;
        valB = b.pengawas[0]?.progress || 0;
      } else if (sortColumn === 'statusOpen') {
        valA = a.open || 0;
        valB = b.open || 0;
      } else if (sortColumn === 'statusDraft') {
        valA = a.draft || 0;
        valB = b.draft || 0;
      } else if (sortColumn === 'statusSubmitted') {
        valA = a.submitted || 0;
        valB = b.submitted || 0;
      } else if (sortColumn === 'statusApproved') {
        valA = a.approved || 0;
        valB = b.approved || 0;
      } else if (sortColumn === 'namaKecamatan') {
        valA = a.namaKecamatan.toLowerCase();
        valB = b.namaKecamatan.toLowerCase();
      } else if (sortColumn === 'namaDesa') {
        valA = a.namaDesa.toLowerCase();
        valB = b.namaDesa.toLowerCase();
      } else if (sortColumn === 'namaSls') {
        valA = a.namaSls.toLowerCase();
        valB = b.namaSls.toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [entries, yesterdayEntries, officers, wilayahs, search, sortColumn, sortDirection]);

  const totalPages = Math.ceil(regionData.length / ITEMS_PER_PAGE);
  const paginatedData = regionData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleToggleTag = (email, currentTags, tagToToggle) => {
    let newTags = [...(currentTags || [])];
    if (newTags.includes(tagToToggle)) {
      newTags = newTags.filter(t => t !== tagToToggle);
    } else {
      newTags.push(tagToToggle);
    }
    if (onUpdateTags) {
      onUpdateTags(email, newTags);
    }
    setActiveDropdownId(null);
  };

  const getSortIcon = (column) => {
    if (sortColumn !== column) return <span className={styles.sortIcon}>↕</span>;
    return sortDirection === 'asc' ? <span className={styles.sortIconActive}>▲</span> : <span className={styles.sortIconActive}>▼</span>;
  };

  const downloadExcel = useCallback(() => {
    const wsData = regionData.map((reg, index) => {
      const pencacahNames = reg.pencacah.map(p => `${p.name} (${p.email})`).join(', ');
      const pengawasNames = reg.pengawas.map(p => `${p.name} (${p.email})`).join(', ');

      return {
        'No': index + 1,
        'Region Code': reg.regionCode,
        'Kecamatan': reg.namaKecamatan,
        'Desa': reg.namaDesa,
        'SLS': reg.namaSls,
        'Open': reg.open,
        'Draft': reg.draft,
        'Submitted': reg.submitted,
        'Approved': reg.approved,
        'Pencacah': pencacahNames,
        'Pengawas': pengawasNames,
      };
    });

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alokasi Petugas");
    XLSX.writeFile(wb, "Alokasi_Petugas.xlsx");
  }, [regionData]);

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <h2>Alokasi Petugas per Wilayah</h2>
        <div className={styles.topBarActions}>
          <select 
            className={styles.sortSelect}
            value={`${sortColumn}-${sortDirection}`}
            onChange={(e) => {
              const [col, dir] = e.target.value.split('-');
              setSortColumn(col);
              setSortDirection(dir);
            }}
          >
            <option value="regionCode-asc">Region Code (A-Z)</option>
            <option value="regionCode-desc">Region Code (Z-A)</option>
            <option value="namaKecamatan-asc">Kecamatan (A-Z)</option>
            <option value="namaKecamatan-desc">Kecamatan (Z-A)</option>
            <option value="namaDesa-asc">Desa (A-Z)</option>
            <option value="namaDesa-desc">Desa (Z-A)</option>
            <option value="namaSls-asc">SLS (A-Z)</option>
            <option value="namaSls-desc">SLS (Z-A)</option>
            <option value="pencacah-asc">Nama Pencacah (A-Z)</option>
            <option value="progressPencacah-desc">Progress Pencacah (Tinggi-Rendah)</option>
            <option value="progressPencacah-asc">Progress Pencacah (Rendah-Tinggi)</option>
            <option value="pengawas-asc">Nama Pengawas (A-Z)</option>
            <option value="progressPengawas-desc">Progress Pengawas (Tinggi-Rendah)</option>
            <option value="progressPengawas-asc">Progress Pengawas (Rendah-Tinggi)</option>
            <option value="statusOpen-desc">Status OPEN Terbanyak</option>
            <option value="statusOpen-asc">Status OPEN Terendah</option>
            <option value="statusDraft-desc">Status Draft Terbanyak</option>
            <option value="statusDraft-asc">Status Draft Terendah</option>
            <option value="statusSubmitted-desc">Status Submitted Terbanyak</option>
            <option value="statusSubmitted-asc">Status Submitted Terendah</option>
            <option value="statusApproved-desc">Status Approved Terbanyak</option>
            <option value="statusApproved-asc">Status Approved Terendah</option>
          </select>
          <input 
            type="text" 
            placeholder="Cari region atau nama petugas..."
            value={search}
            onChange={handleSearchChange}
            className={styles.searchInput}
          />
          <button className={styles.downloadBtn} onClick={downloadExcel}>
            <span>📥</span> Download Excel
          </button>
        </div>
      </div>

      <div className={styles.tableContainer}>
        {regionData.length === 0 ? (
          <div className={styles.emptyState}>
            Tidak ada data wilayah yang ditemukan.
          </div>
        ) : (
          <>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('regionCode')} className={styles.sortableHeader}>
                      Region Code {getSortIcon('regionCode')}
                    </th>
                    <th onClick={() => handleSort('namaKecamatan')} className={styles.sortableHeader}>
                      Kecamatan {getSortIcon('namaKecamatan')}
                    </th>
                    <th onClick={() => handleSort('namaDesa')} className={styles.sortableHeader}>
                      Desa {getSortIcon('namaDesa')}
                    </th>
                    <th onClick={() => handleSort('namaSls')} className={styles.sortableHeader}>
                      SLS {getSortIcon('namaSls')}
                    </th>
                    <th>Status</th>
                    <th onClick={() => handleSort('pencacah')} className={styles.sortableHeader}>
                      Pencacah {getSortIcon('pencacah')}
                    </th>
                    <th onClick={() => handleSort('pengawas')} className={styles.sortableHeader}>
                      Pengawas {getSortIcon('pengawas')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map(reg => (
                    <tr key={reg.regionCode}>
                      <td className={styles.regionCell}>{reg.regionCode}</td>
                      <td>{reg.namaKecamatan}</td>
                      <td>{reg.namaDesa}</td>
                      <td>{reg.namaSls}</td>
                      <td>
                        <div className={styles.statusGroup}>
                          {reg.open > 0 && <span className={`${styles.statusBadge} ${styles.statusOpen}`}>OPEN: {reg.open}</span>}
                          {reg.draft > 0 && <span className={`${styles.statusBadge} ${styles.statusDraft}`}>Draft: {reg.draft}</span>}
                          {reg.submitted > 0 && <span className={`${styles.statusBadge} ${styles.statusSubmitted}`}>Submitted: {reg.submitted}</span>}
                          {reg.approved > 0 && <span className={`${styles.statusBadge} ${styles.statusApproved}`}>Approved: {reg.approved}</span>}
                          {reg.rejected > 0 && <span className={`${styles.statusBadge} ${styles.statusRejected}`} style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>Rejected: {reg.rejected}</span>}
                        </div>
                      </td>
                      <td>
                        <div className={styles.officerList}>
                          {reg.pencacah.map((p, idx) => (
                            <div key={idx} className={styles.officerInfo}>
                              <div className={styles.officerNameRow}>
                                <span className={styles.officerName}>
                                  {p.name} <span className={styles.progressText}>({p.progress}%)</span>
                                  {p.diff !== undefined && p.diff !== null && (
                                    <span style={{ fontSize: '0.85em', marginLeft: '4px', fontWeight: 'bold', color: p.diff > 0 ? '#10b981' : (p.diff < 0 ? '#ef4444' : '#6b7280') }}>
                                      ({p.diff > 0 ? '+' : ''}{p.diff})
                                    </span>
                                  )}
                                </span>
                                {p.tags && p.tags.map(tag => (
                                  <span key={tag} className={styles.tagBadge}>
                                    {tag}
                                    {isAdmin && (
                                      <span 
                                        className={styles.removeTagIcon}
                                        onClick={() => handleToggleTag(p.email, p.tags, tag)}
                                        title={`Hapus tag ${tag}`}
                                      >
                                        &times;
                                      </span>
                                    )}
                                  </span>
                                ))}
                                {isAdmin && (
                                  <div className={styles.dropdownContainer}>
                                    <button 
                                      className={styles.addTagBtn} 
                                      onClick={() => setActiveDropdownId(activeDropdownId === `pencacah-${reg.regionCode}-${idx}` ? null : `pencacah-${reg.regionCode}-${idx}`)}
                                      title="Tambah Tag"
                                    >
                                      +
                                    </button>
                                    {activeDropdownId === `pencacah-${reg.regionCode}-${idx}` && (
                                      <div className={styles.dropdownMenu}>
                                        {['SP1', 'SP2', 'SP3'].map(tag => (
                                          <button 
                                            key={tag} 
                                            className={`${styles.dropdownItem} ${p.tags?.includes(tag) ? styles.dropdownItemActive : ''}`}
                                            onClick={() => handleToggleTag(p.email, p.tags, tag)}
                                          >
                                            {tag}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span className={styles.officerEmail}>{p.email}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className={styles.officerList}>
                          {reg.pengawas.map((p, idx) => (
                            <div key={idx} className={styles.officerInfo}>
                              <div className={styles.officerNameRow}>
                                <span className={styles.officerName}>
                                  {p.name} <span className={styles.progressText}>({p.progress}%)</span>
                                  {p.diff !== undefined && p.diff !== null && (
                                    <span style={{ fontSize: '0.85em', marginLeft: '4px', fontWeight: 'bold', color: p.diff > 0 ? '#10b981' : (p.diff < 0 ? '#ef4444' : '#6b7280') }}>
                                      ({p.diff > 0 ? '+' : ''}{p.diff})
                                    </span>
                                  )}
                                </span>
                                {p.tags && p.tags.map(tag => (
                                  <span key={tag} className={styles.tagBadge}>
                                    {tag}
                                    {isAdmin && (
                                      <span 
                                        className={styles.removeTagIcon}
                                        onClick={() => handleToggleTag(p.email, p.tags, tag)}
                                        title={`Hapus tag ${tag}`}
                                      >
                                        &times;
                                      </span>
                                    )}
                                  </span>
                                ))}
                                {isAdmin && (
                                  <div className={styles.dropdownContainer}>
                                    <button 
                                      className={styles.addTagBtn} 
                                      onClick={() => setActiveDropdownId(activeDropdownId === `pengawas-${reg.regionCode}-${idx}` ? null : `pengawas-${reg.regionCode}-${idx}`)}
                                      title="Tambah Tag"
                                    >
                                      +
                                    </button>
                                    {activeDropdownId === `pengawas-${reg.regionCode}-${idx}` && (
                                      <div className={styles.dropdownMenu}>
                                        {['SP1', 'SP2', 'SP3'].map(tag => (
                                          <button 
                                            key={tag} 
                                            className={`${styles.dropdownItem} ${p.tags?.includes(tag) ? styles.dropdownItemActive : ''}`}
                                            onClick={() => handleToggleTag(p.email, p.tags, tag)}
                                          >
                                            {tag}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span className={styles.officerEmail}>{p.email}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

                <button 
                  className={styles.pageBtn} 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
