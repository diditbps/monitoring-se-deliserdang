import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import styles from './UploadOfficers.module.css';

export default function UploadOfficers({ onUpload }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = useCallback(async (files) => {
    setError('');
    setLoading(true);

    const file = files[0];
    if (!file) {
      setLoading(false);
      return;
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError(`"${file.name}" bukan file Excel yang valid.`);
      setLoading(false);
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);
      
      // Filter required columns: Jabatan, email, Nama
      const officers = jsonData.map(row => {
        // Handle potential case-insensitivity in column headers by checking keys
        const getVal = (keyName) => {
          const key = Object.keys(row).find(k => k.toLowerCase() === keyName.toLowerCase());
          return key ? row[key] : '';
        };

        return {
          Jabatan: getVal('jabatan'),
          email: getVal('email'),
          Nama: getVal('nama')
        };
      }).filter(o => o.email); // Only keep rows that have an email

      if (officers.length === 0) {
        setError('Tidak ada data yang valid ditemukan. Pastikan ada kolom "email", "Nama", dan "Jabatan".');
        setLoading(false);
        return;
      }

      onUpload(officers);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(`Gagal mem-parse "${file.name}". Pastikan format file benar.`);
      setLoading(false);
    }
  }, [onUpload]);

  const onFileInput = (e) => {
    handleFiles([...e.target.files]);
    e.target.value = '';
  };

  return (
    <div className={styles.uploadContainer}>
      <h3 className={styles.title}>Upload Data Petugas (Excel)</h3>
      <p className={styles.sub}>
        Format kolom yang didukung: <strong>Jabatan</strong>, <strong>email</strong>, <strong>Nama</strong>
      </p>
      
      {error && (
        <div className={styles.errorMsg} role="alert">
          <span>⚠️</span> {error}
        </div>
      )}

      <label className={styles.btn} htmlFor="officer-file-input">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {loading ? 'Memproses...' : 'Pilih File Excel'}
        <input
          id="officer-file-input"
          type="file"
          accept=".xlsx, .xls"
          className={styles.fileInput}
          onChange={onFileInput}
          disabled={loading}
        />
      </label>
    </div>
  );
}
