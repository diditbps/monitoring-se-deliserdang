import { useMemo, useState } from 'react';
import styles from './BebanKerja.module.css';
import * as XLSX from 'xlsx';

export default function BebanKerja({ entries, officers, wilayahs }) {
  const tableData = useMemo(() => {
    // 1. Separate Pengawas and Pencacah
    const pengawasEntries = entries.filter(e => e.roleName.toLowerCase() === 'pengawas');
    const pencacahEntries = entries.filter(e => e.roleName.toLowerCase() === 'pencacah');

    const mappedData = [];
    
    // 2. Iterate Pengawas
    pengawasEntries.forEach(pmlEntry => {
      const pmlOfficer = officers.find(o => o.email.toLowerCase() === pmlEntry.email.toLowerCase());
      const namaPML = pmlOfficer ? pmlOfficer.Nama : pmlEntry.email;
      
      const slsByPCL = {};

      // 3. For each SLS supervised by PML
      pmlEntry.regionSummary?.forEach(pmlRegion => {
        const rCode = pmlRegion.regionCode;
        if (!rCode) return;
        
        // Find Pencacah that has this rCode
        const matchedPcl = pencacahEntries.find(pclEntry => 
          pclEntry.regionSummary?.some(pclRegion => pclRegion.regionCode === rCode)
        );
        
        const pclEmail = matchedPcl ? matchedPcl.email : 'Belum Ada PCL';
        const pclOfficer = matchedPcl ? officers.find(o => o.email.toLowerCase() === pclEmail.toLowerCase()) : null;
        const namaPCL = pclOfficer ? pclOfficer.Nama : (matchedPcl ? matchedPcl.email : '-');

        // Group by PCL and Desa (10 digits)
        const desaCode = rCode.length >= 10 ? rCode.substring(0, 10) : rCode;
        const groupKey = `${pclEmail}_${desaCode}`;

        if (!slsByPCL[groupKey]) {
          let namaKec = '';
          let namaDesa = '';
          
          if (rCode.length >= 10) {
             const kecCodeStr = rCode.substring(4, 7);
             const desaCodeStr = rCode.substring(7, 10);
             
             // Try to get from wilayahs
             const w = wilayahs.find(w => w.kdkec === kecCodeStr && w.kddesa === desaCodeStr);
             if (w) {
               namaKec = `[${kecCodeStr}] ${w.nmkec}`;
               namaDesa = `[${desaCodeStr}] ${w.nmdesa}`;
             } else {
               // Fallback from fetchLabel or rCode
               const labelKec = pmlEntry.fetchLabel ? pmlEntry.fetchLabel.split('(')[0].trim() : `Kecamatan ${kecCodeStr}`;
               namaKec = `[${kecCodeStr}] ${labelKec}`;
               namaDesa = `[${desaCodeStr}] ${pmlRegion.nmdesa || `Desa ${desaCodeStr}`}`;
             }
          }
          
          slsByPCL[groupKey] = {
            namaPML,
            namaPCL,
            kecamatan: namaKec,
            desa: namaDesa,
            jumlahSLS: 0,
            targetUsaha: 0,
            realisasiUsaha: 0
          };
        }
        
        slsByPCL[groupKey].jumlahSLS += 1;
        slsByPCL[groupKey].targetUsaha += pmlRegion.total;
        
        const done = (pmlRegion.statusBreakdown || [])
          .filter(s => s.status.toLowerCase().includes('submitted') || s.status.toLowerCase().includes('approved') || s.status.toLowerCase().includes('rejected'))
          .reduce((acc, s) => acc + s.count, 0);
          
        slsByPCL[groupKey].realisasiUsaha += done;
      });
      
      Object.values(slsByPCL).forEach(group => {
        mappedData.push(group);
      });
    });

    return mappedData;
  }, [entries, officers, wilayahs]);

  const totalSLS = tableData.reduce((acc, row) => acc + row.jumlahSLS, 0);
  const totalTargetUsaha = tableData.reduce((acc, row) => acc + row.targetUsaha, 0);
  const totalRealisasiUsaha = tableData.reduce((acc, row) => acc + row.realisasiUsaha, 0);
  const totalPclTermin = tableData.reduce((acc, row) => acc + Math.floor(row.targetUsaha * 0.4), 0);
  const totalPmlTermin = tableData.reduce((acc, row) => acc + Math.floor(row.targetUsaha * 0.4), 0);
  
  const downloadExcel = () => {
    const wsData = tableData.map((d, i) => ({
      'No': i + 1,
      'Nama PML': d.namaPML,
      'Nama PCL': d.namaPCL,
      'Kecamatan/Distrik': d.kecamatan,
      'Desa/Kampung/Nagari': d.desa,
      'Jumlah SLS/sub SLS': d.jumlahSLS,
      'Target Fasih Ruta': 0,
      'Target Fasih Usaha': d.targetUsaha,
      'Realisasi Ruta': 0,
      'Realisasi Usaha': d.realisasiUsaha,
      'PCL Termin I Ruta': 0,
      'PCL Termin I Usaha': Math.floor(d.targetUsaha * 0.4),
      'PML Termin I Ruta': 0,
      'PML Termin I Usaha': Math.floor(d.targetUsaha * 0.4),
      'Keterangan': ''
    }));
    
    wsData.push({
      'No': '',
      'Nama PML': 'Jumlah',
      'Nama PCL': '',
      'Kecamatan/Distrik': '',
      'Desa/Kampung/Nagari': '',
      'Jumlah SLS/sub SLS': totalSLS,
      'Target Fasih Ruta': 0,
      'Target Fasih Usaha': totalTargetUsaha,
      'Realisasi Ruta': 0,
      'Realisasi Usaha': totalRealisasiUsaha,
      'PCL Termin I Ruta': 0,
      'PCL Termin I Usaha': totalPclTermin,
      'PML Termin I Ruta': 0,
      'PML Termin I Usaha': totalPmlTermin,
      'Keterangan': ''
    });

    const ws = XLSX.utils.json_to_sheet(wsData, { origin: "A4" });
    XLSX.utils.sheet_add_aoa(ws, [
      ["Beban Kerja Petugas Lapangan SE2026"],
      ["Kabupaten/Kota Deli Serdang Provinsi Sumatera Utara"],
      []
    ], { origin: "A1" });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Beban Kerja");
    XLSX.writeFile(wb, "Beban_Kerja_Petugas.xlsx");
  };

  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(tableData.length / ITEMS_PER_PAGE);
  const paginatedData = tableData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.tableTitle}>
          <h2>Beban Kerja Petugas Lapangan SE2026</h2>
          <h3>Kabupaten/Kota Deli Serdang Provinsi Sumatera Utara</h3>
        </div>
        <button className={styles.downloadExcelBtn} onClick={downloadExcel}>
          <span>📥</span> Download Excel
        </button>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th rowSpan="2">No</th>
            <th rowSpan="2">Nama PML</th>
            <th rowSpan="2">Nama PCL</th>
            <th rowSpan="2">[Kode]<br/>KECAMATAN/DISTRIK</th>
            <th rowSpan="2">[Kode]<br/>DESA/KAMPUNG/NAGARI</th>
            <th rowSpan="2">Jumlah SLS/sub SLS</th>
            <th colSpan="2">Target Fasih *)</th>
            <th colSpan="2">Realisasi</th>
            <th colSpan="2">PCL Termin I (40%)</th>
            <th colSpan="2">PML Termin I (40%)</th>
            <th rowSpan="2">Keterangan</th>
          </tr>
          <tr>
            <th>Ruta</th>
            <th>Usaha</th>
            <th>Ruta</th>
            <th>Usaha</th>
            <th>Ruta</th>
            <th>Usaha</th>
            <th>Ruta</th>
            <th>Usaha</th>
          </tr>
          <tr className={styles.headerIndex}>
            <th>(1)</th>
            <th>(2)</th>
            <th>(3)</th>
            <th>(4)</th>
            <th>(5)</th>
            <th>(6)</th>
            <th>(7)</th>
            <th>(8)</th>
            <th>(9)</th>
            <th>(10)</th>
            <th>(11)</th>
            <th>(12)</th>
            <th>(13)</th>
            <th>(14)</th>
            <th>(15)</th>
          </tr>
        </thead>
        <tbody>
          {tableData.length === 0 ? (
            <tr>
              <td colSpan="15" className={styles.emptyState}>Tidak ada data yang tersedia.</td>
            </tr>
          ) : (
            paginatedData.map((row, index) => (
              <tr key={index} className={styles.row}>
                <td>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                <td className={styles.textLeft}>{row.namaPML}</td>
                <td className={styles.textLeft}>{row.namaPCL}</td>
                <td className={styles.textLeft}>{row.kecamatan}</td>
                <td className={styles.textLeft}>{row.desa}</td>
                <td>{row.jumlahSLS}</td>
                <td>0</td>
                <td>{row.targetUsaha}</td>
                <td>0</td>
                <td>{row.realisasiUsaha}</td>
                <td>0</td>
                <td>{Math.floor(row.targetUsaha * 0.4)}</td>
                <td style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>0</td>
                <td style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>{Math.floor(row.targetUsaha * 0.4)}</td>
                <td></td>
              </tr>
            ))
          )}
          {tableData.length > 0 && (
            <tr className={styles.totalRow}>
              <td colSpan="5">Jumlah</td>
              <td>{totalSLS}</td>
              <td>0</td>
              <td>{totalTargetUsaha}</td>
              <td>0</td>
              <td>{totalRealisasiUsaha}</td>
              <td>0</td>
              <td>{totalPclTermin}</td>
              <td style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>0</td>
              <td style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>{totalPmlTermin}</td>
              <td></td>
            </tr>
          )}
        </tbody>
      </table>
      
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button 
            className={styles.pageBtn}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Sebelumnya
          </button>
          
          <div className={styles.pageNumbers}>
            {getPageNumbers().map((num, i) => (
              <button
                key={i}
                className={`${styles.numBtn} ${num === currentPage ? styles.activePage : ''} ${num === '...' ? styles.dots : ''}`}
                onClick={() => num !== '...' && setCurrentPage(num)}
                disabled={num === '...'}
              >
                {num}
              </button>
            ))}
          </div>

          <button 
            className={styles.pageBtn}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Selanjutnya
          </button>
        </div>
      )}

      <div style={{ marginTop: '20px', fontSize: '0.85rem', color: 'var(--gray-400)', textAlign: 'left' }}>
        <p>Keterangan:</p>
        <p>*) Target merupakan data prelist yang jumlahnya disesuaikan dengan kondisi lapangan.</p>
        <p>Catatan: Karena keterbatasan field pada raw data, nilai Target/Realisasi gabungan diletakkan pada kolom "Usaha".</p>
      </div>
    </div>
  );
}
