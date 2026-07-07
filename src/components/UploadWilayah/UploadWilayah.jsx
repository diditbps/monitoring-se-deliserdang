import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import styles from './UploadWilayah.module.css';

export default function UploadWilayah({ onUpload }) {
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

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      setError(`"${file.name}" bukan file Excel/CSV yang valid.`);
      setLoading(false);
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);
      
      const wilayahs = jsonData.map(row => {
        const getVal = (keyName) => {
          const key = Object.keys(row).find(k => k.toLowerCase() === keyName.toLowerCase());
          return key ? String(row[key]) : '';
        };

        return {
          kdkab: getVal('kdkab').padStart(4, '0'),
          nmkab: getVal('nmkab'),
          kdkec: getVal('kdkec').padStart(3, '0'),
          nmkec: getVal('nmkec'),
          kddesa: getVal('kddesa').padStart(3, '0'),
          nmdesa: getVal('nmdesa'),
          kdsls: getVal('kdsls').padStart(4, '0'),
          nmsls: getVal('nmsls'),
          kdsubsls: getVal('kdsubsls').padStart(2, '0')
        };
      }).filter(w => w.kdkab && w.kdkab !== '0000'); // Filter out empty rows

      if (wilayahs.length === 0) {
        setError('Tidak ada data yang valid. Pastikan header sesuai (kdkab, nmkab, kdkec, nmkec, kddesa, nmdesa, kdsls, nmsls, kdsubsls).');
        setLoading(false);
        return;
      }

      onUpload(wilayahs);
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
      <h3 className={styles.title}>Upload Master Wilayah</h3>
      <p className={styles.sub}>
        Format kolom: <strong>kdkab, nmkab, kdkec, nmkec, kddesa, nmdesa, kdsls, nmsls, kdsubsls</strong>
      </p>
      
      {error && (
        <div className={styles.errorMsg} role="alert">
          <span>⚠️</span> {error}
        </div>
      )}

      <label className={styles.btn} htmlFor="wilayah-file-input">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {loading ? 'Memproses...' : 'Pilih File Master Wilayah'}
        <input
          id="wilayah-file-input"
          type="file"
          accept=".xlsx, .xls, .csv"
          className={styles.fileInput}
          onChange={onFileInput}
          disabled={loading}
        />
      </label>
    </div>
  );
}
