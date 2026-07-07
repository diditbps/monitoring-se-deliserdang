import { useState, useCallback } from 'react';
import styles from './UploadZone.module.css';
import { parseJsonFile } from '../../utils/helpers';

export default function UploadZone({ onUpload }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadType, setUploadType] = useState('pencacah');
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);
  const [stagedFiles, setStagedFiles] = useState([]);
  
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictGroups, setConflictGroups] = useState([]);
  const [safeItems, setSafeItems] = useState([]);
  const [pendingStats, setPendingStats] = useState({ valid: 0, error: 0 });

  const handleFiles = useCallback((files) => {
    setError('');
    const validFiles = [];
    for (const file of files) {
      if (!file.name.endsWith('.json')) {
        setError(`"${file.name}" bukan file JSON yang valid.`);
        return;
      }
      validFiles.push(file);
    }
    setStagedFiles(prev => [...prev, ...validFiles]);
  }, []);

  const doUpload = async () => {
    if (stagedFiles.length === 0) {
      setError('Pilih file terlebih dahulu.');
      return;
    }
    if (!uploadDate) {
      setError('Pilih tanggal upload.');
      return;
    }
    setLoading(true);
    const results = [];
    let validCount = 0;
    let errorCount = 0;
    
    for (const file of stagedFiles) {
      try {
        const text = await file.text();
        const raw = JSON.parse(text);
        const items = Array.isArray(raw) ? raw : [raw];
        
        const validItems = [];
        items.forEach(item => {
          // Simple validation: must be object and ideally has some data
          if (item && typeof item === 'object' && (item.email || item.username || item.userId || item._fetch_label)) {
            validItems.push(item);
          } else {
            errorCount++;
          }
        });
        
        const parsed = parseJsonFile(validItems, file.name, uploadType, uploadDate);
        results.push(...parsed);
        validCount += parsed.length;
      } catch (err) {
        console.error("Upload Error:", err);
        setError(`Gagal mem-parse "${file.name}": ${err.message}. Pastikan format JSON valid.`);
        setLoading(false);
        return;
      }
    }
    
    // Check for duplicates
    const groups = {};
    results.forEach(item => {
      const fetchLabelClean = item.fetchLabel ? String(item.fetchLabel).replace(/[^a-zA-Z0-9]/g, '') : '';
      const emailOrId = item.email !== '-' ? item.email : (item.userId || 'unknown');
      const key = `${emailOrId}_${fetchLabelClean}`;
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    
    const safe = [];
    const conflicts = [];
    
    for (const key in groups) {
      if (groups[key].length > 1) {
        // Auto-select all by default, or auto-select only first if exact duplicate?
        // Let's select only the FIRST item by default if there are multiple, to prevent inflating counts by accident,
        // unless they are distinct roles, but let's just select the first one as a safe default.
        const selectedIndices = [0]; 
        conflicts.push({ key, items: groups[key], selectedIndices });
      } else {
        safe.push(groups[key][0]);
      }
    }
    
    if (conflicts.length > 0) {
      setSafeItems(safe);
      setConflictGroups(conflicts);
      setPendingStats({ valid: validCount, error: errorCount });
      setShowConflictModal(true);
      setLoading(false);
      return;
    }

    setLoading(false);
    if (results.length > 0) onUpload(results, uploadDate, uploadType, { valid: validCount, error: errorCount });
    else if (errorCount > 0) setError(`Tidak ada data yang valid untuk diupload. ${errorCount} baris dilewati.`);
    setStagedFiles([]);
  };

  const handleResolveConflicts = () => {
    const resolvedItems = [];
    conflictGroups.forEach(group => {
      group.selectedIndices.forEach(idx => {
        resolvedItems.push(group.items[idx]);
      });
    });
    
    const finalResults = [...safeItems, ...resolvedItems];
    setShowConflictModal(false);
    
    if (finalResults.length > 0) {
      const discarded = conflictGroups.reduce((acc, g) => acc + (g.items.length - g.selectedIndices.length), 0);
      onUpload(finalResults, uploadDate, uploadType, { 
        valid: pendingStats.valid - discarded, 
        error: pendingStats.error 
      });
    }
    setStagedFiles([]);
  };

  const toggleSelection = (groupIndex, itemIndex) => {
    const newGroups = [...conflictGroups];
    const group = newGroups[groupIndex];
    const selected = new Set(group.selectedIndices);
    if (selected.has(itemIndex)) selected.delete(itemIndex);
    else selected.add(itemIndex);
    group.selectedIndices = Array.from(selected);
    setConflictGroups(newGroups);
  };

  const toggleGroupAll = (groupIndex, isSelectAll) => {
    const newGroups = [...conflictGroups];
    if (isSelectAll) {
      newGroups[groupIndex].selectedIndices = newGroups[groupIndex].items.map((_, i) => i);
    } else {
      newGroups[groupIndex].selectedIndices = [];
    }
    setConflictGroups(newGroups);
  };

  const handleCheckAllGlobal = () => {
    const newGroups = conflictGroups.map(g => ({
      ...g,
      selectedIndices: g.items.map((_, i) => i)
    }));
    setConflictGroups(newGroups);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles([...e.dataTransfer.files]);
  }, [handleFiles]);

  const onFileInput = (e) => {
    handleFiles([...e.target.files]);
    e.target.value = '';
  };

  return (
    <div className={styles.uploadContainer}>
      <div className={styles.typeSelector}>
        <p className={styles.typeSelectorTitle}>Pilih Tipe Data:</p>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input 
              type="radio" 
              name="uploadType" 
              value="pencacah" 
              checked={uploadType === 'pencacah'} 
              onChange={(e) => setUploadType(e.target.value)} 
            />
            Data Pencacah
          </label>
          <label className={styles.radioLabel}>
            <input 
              type="radio" 
              name="uploadType" 
              value="pengawas" 
              checked={uploadType === 'pengawas'} 
              onChange={(e) => setUploadType(e.target.value)} 
            />
            Data Pengawas
          </label>
        </div>
      </div>
      <div className={styles.typeSelector} style={{ marginTop: '10px' }}>
        <p className={styles.typeSelectorTitle}>Pilih Tanggal Data:</p>
        <input 
          type="date" 
          value={uploadDate} 
          onChange={(e) => setUploadDate(e.target.value)} 
          className={styles.dateInput}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
      </div>
      <div
        className={`${styles.zone} ${dragging ? styles.dragging : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className={styles.icon}>
          {loading ? (
            <div className={styles.spinner} />
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V8M12 8l-3 3M12 8l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 15c0 2.8 2.2 5 5 5h8c2.8 0 5-2.2 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M3 9a5 5 0 0 1 9-3 4 4 0 0 1 7 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
        </div>

        <h3 className={styles.title}>
          {loading ? 'Memproses file…' : 'Upload File JSON'}
        </h3>
        <p className={styles.sub}>
          Drag & drop file JSON ke sini, atau klik tombol di bawah
        </p>
        <p className={styles.hint}>Mendukung satu atau beberapa file .json sekaligus</p>
        
        {stagedFiles.length > 0 && (
          <div style={{ marginTop: '10px', fontSize: '14px', color: '#10b981', fontWeight: 'bold' }}>
            {stagedFiles.length} file dipilih.
          </div>
        )}

        {error && (
          <div className={styles.errorMsg} role="alert">
            <span>⚠️</span> {error}
          </div>
        )}

        <label className={styles.btn} htmlFor="file-input">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Pilih File JSON
          <input
            id="file-input"
            type="file"
            accept=".json"
            multiple
            className={styles.fileInput}
            onChange={onFileInput}
          />
        </label>
        
        {stagedFiles.length > 0 && (
          <button 
            onClick={doUpload} 
            disabled={loading} 
            style={{ position: 'relative', zIndex: 10, marginTop: '15px', padding: '10px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {loading ? 'Mengunggah...' : 'Upload Data'}
          </button>
        )}
      </div>

      {showConflictModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto', color: '#f8fafc', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h2 style={{ margin: 0, color: '#f97316', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>⚠️</span> Konfirmasi Duplikat Ditemukan
              </h2>
              <button 
                onClick={handleCheckAllGlobal} 
                style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
              >
                Centang Semua Grup
              </button>
            </div>
            <p style={{ marginBottom: '20px', fontSize: '15px', color: '#cbd5e1' }}>
              Ditemukan <strong>{conflictGroups.length} grup</strong> data dengan email dan wilayah yang sama. 
              <br/>
              Secara *default*, sistem hanya memilih baris pertama agar tidak terjadi penggandaan (seperti kasus 50 duplikat). 
              <br/>
              Tetapi, Anda bebas mencentang kotak <strong>"Simpan?"</strong> untuk mengizinkan baris tersebut tetap masuk jika memang diperlukan (seperti kasus 13 perbedaan pada tanggal 4 Juli).
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {conflictGroups.map((group, gIdx) => (
                <div key={gIdx} style={{ backgroundColor: '#334155', padding: '15px', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
                    <h4 style={{ margin: 0, color: '#38bdf8' }}>{group.key} <span style={{color: '#94a3b8', fontSize: '13px', fontWeight: 'normal'}}>({group.items.length} baris)</span></h4>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => toggleGroupAll(gIdx, true)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Centang Semua</button>
                      <button onClick={() => toggleGroupAll(gIdx, false)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Kosongkan Semua</button>
                    </div>
                  </div>
                  
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', whiteSpace: 'nowrap' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #475569', textAlign: 'left', color: '#94a3b8' }}>
                          <th style={{ padding: '8px 10px', width: '60px', textAlign: 'center' }}>Simpan?</th>
                          <th style={{ padding: '8px 10px' }}>Peran</th>
                          <th style={{ padding: '8px 10px' }}>Kode Wilayah</th>
                          <th style={{ padding: '8px 10px' }}>Beban Tugas</th>
                          <th style={{ padding: '8px 10px' }}>No. Urut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item, iIdx) => {
                          // Extract region codes safely
                          let codes = '-';
                          if (Array.isArray(item.regionSummary)) {
                            codes = item.regionSummary.map(r => r.regionCode).filter(Boolean).join(', ');
                          }
                          return (
                          <tr key={iIdx} style={{ borderBottom: '1px solid #475569', backgroundColor: group.selectedIndices.includes(iIdx) ? 'rgba(56, 189, 248, 0.1)' : 'transparent' }}>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={group.selectedIndices.includes(iIdx)} 
                                onChange={() => toggleSelection(gIdx, iIdx)}
                                style={{ transform: 'scale(1.3)', cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px' }}>{item.roleName}</td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'normal', maxWidth: '300px' }} title={codes}>
                              {codes}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#10b981' }}>{item.total}</td>
                            <td style={{ padding: '8px 10px' }}>{item.roleSequence}</td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '25px', position: 'sticky', bottom: '-20px', backgroundColor: '#1e293b', padding: '15px 0', borderTop: '1px solid #334155' }}>
              <button 
                onClick={() => { setShowConflictModal(false); setStagedFiles([]); }}
                style={{ backgroundColor: '#64748b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Batal
              </button>
              <button 
                onClick={handleResolveConflicts}
                style={{ backgroundColor: '#f97316', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Simpan & Lanjutkan Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
