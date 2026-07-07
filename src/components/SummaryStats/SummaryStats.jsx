import { useRef, useState, useEffect } from 'react';
import styles from './SummaryStats.module.css';
import { fmtNumber } from '../../utils/helpers';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, ReferenceLine, Label,
  LineChart, Line
} from 'recharts';
import * as XLSX from 'xlsx';
import { toJpeg } from 'html-to-image';

export default function SummaryStats({ entries, yesterdayEntries = [], filters = {} }) {
  const [historyData, setHistoryData] = useState([]);

  useEffect(() => {
    let url = 'api.php?type=history';
    if (filters.kecamatan) url += `&kecamatan=${encodeURIComponent(filters.kecamatan)}`;
    if (filters.desa) url += `&desa=${encodeURIComponent(filters.desa)}`;
    if (filters.mitraType) url += `&mitraType=${encodeURIComponent(filters.mitraType)}`;
    
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setHistoryData(data);
      })
      .catch(console.error);
  }, [filters.kecamatan, filters.desa, filters.mitraType]);

  const totalSampelRaw = entries.reduce((a, e) => a + e.total, 0);
  const totalSampel = Math.round(totalSampelRaw / 2);

  // Yesterday calculation
  // Filter yesterdayEntries to only include those present in current entries (to match search/filters)
  const filteredYesterdayEntries = yesterdayEntries.filter(y => 
    entries.some(e => e.email === y.email && e.roleName === y.roleName)
  );

  const yTotalSampelRaw = filteredYesterdayEntries.reduce((a, e) => a + e.total, 0);
  const yTotalSampel = Math.round(yTotalSampelRaw / 2);
  
  let yTotalDoneRaw = 0;
  filteredYesterdayEntries?.forEach(e => {
    e.regionSummary?.forEach(r => {
      r.statusBreakdown?.forEach(s => {
        const st = s.status.toLowerCase();
        if (st.includes('submitted') || st.includes('approved') || st.includes('rejected')) {
          yTotalDoneRaw += s.count;
        }
      });
    });
  });
  const yTotalDone = Math.round(yTotalDoneRaw / 2);
  const yesterdayOverallPct = yTotalSampel > 0 ? ((yTotalDone / yTotalSampel) * 100).toFixed(2) : "0.00";

  const totalByStatus = { draft: 0, open: 0, submitted: 0, approved: 0, rejected: 0, other: 0 };
  entries?.forEach(e => {
    e.regionSummary?.forEach(r => {
      r.statusBreakdown?.forEach(s => {
        const key = s.status.toLowerCase().includes('draft') ? 'draft'
          : s.status.toLowerCase().includes('open') ? 'open'
          : s.status.toLowerCase().includes('submitted') ? 'submitted'
          : s.status.toLowerCase().includes('approved') ? 'approved'
          : s.status.toLowerCase().includes('rejected') ? 'rejected'
          : 'other';
        totalByStatus[key] = (totalByStatus[key] || 0) + s.count;
      });
    });
  });

  const totalDoneRaw = (totalByStatus.submitted || 0) + (totalByStatus.approved || 0) + (totalByStatus.rejected || 0);
  const totalDraftOpenRaw = (totalByStatus.draft || 0) + (totalByStatus.open || 0);

  const totalDone = Math.round(totalDoneRaw / 2);
  const totalDraftOpen = totalSampel - totalDone;

  const overallPct = totalSampel > 0 ? ((totalDone / totalSampel) * 100).toFixed(2) : "0.00";
  const submittedPct = totalSampel > 0 ? (((totalByStatus.submitted || 0) / 2 / totalSampel) * 100).toFixed(2) : "0.00";
  const approvedPct = totalSampel > 0 ? (((totalByStatus.approved || 0) / 2 / totalSampel) * 100).toFixed(2) : "0.00";
  
  const diffPct = (Number(overallPct) - Number(yesterdayOverallPct)).toFixed(2);
  const isDiffPositive = Number(diffPct) > 0;
  const isDiffNegative = Number(diffPct) < 0;

  const startDate = new Date('2026-06-15T00:00:00');
  const now = new Date();
  const diffTime = Math.max(0, now - startDate);
  const daysRunning = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const targetProgress = Math.min(100, daysRunning * 1.33);
  const isBelowTarget = Number(overallPct) < targetProgress;

  const stats = [
    {
      label: 'Total SE',
      value: entries.length,
      icon: '👥',
      color: 'blue',
    },
    {
      label: 'Total Sampel',
      value: fmtNumber(totalSampel),
      icon: '📋',
      color: 'purple',
    },
    {
      label: 'Sudah Diproses',
      value: fmtNumber(totalDone),
      icon: '✅',
      color: 'green',
    },
    {
      label: 'Belum Diproses',
      value: fmtNumber(totalDraftOpen),
      icon: '⏳',
      color: 'orange',
    },
    {
      label: 'Progress Submitted',
      value: `${submittedPct}%`,
      icon: '📤',
      color: 'blue',
    },
    {
      label: 'Progress Approved',
      value: `${approvedPct}%`,
      icon: '✅',
      color: 'green',
    },
    {
      label: 'Progress Keseluruhan',
      value: `${overallPct}%`,
      icon: '📈',
      color: 'teal',
    },
  ];

  // Prepare Pie Chart Data
  const pieData = [
    { name: 'Selesai (Submitted/Approved/Rejected)', value: totalDone, color: '#10b981' }, // green-500
    { name: 'Belum Selesai (Draft/Open)', value: totalDraftOpen, color: '#f59e0b' }, // amber-500
  ].filter(d => d.value > 0);

  // Prepare Bar Chart Data
  const regionProgressMap = {};
  entries?.forEach(e => {
    const label = e.fetchLabel;
    if (!regionProgressMap[label]) {
      regionProgressMap[label] = { label, total: 0, done: 0 };
    }
    regionProgressMap[label].total += e.total;
    
    const done = (e.regionSummary || []).reduce((acc, r) => 
      acc + (r.statusBreakdown || [])
        .filter(s => s.status.toLowerCase().includes('submitted') || s.status.toLowerCase().includes('approved') || s.status.toLowerCase().includes('rejected'))
        .reduce((a, s) => a + s.count, 0)
    , 0);
    regionProgressMap[label].done += done;
  });

  const allRegions = Object.values(regionProgressMap)
    .map(r => ({
      name: r.label.split('(')[0].trim(), // Ambil nama depan saja misal "GALANG"
      progress: r.total > 0 ? Number(((r.done / r.total) * 100).toFixed(2)) : 0,
      total: r.total
    }))
    .sort((a, b) => {
      // Sort by progress descending, then by total descending
      if (b.progress !== a.progress) return b.progress - a.progress;
      return b.total - a.total;
    });

  let barData = allRegions;

  const yesterdayRegionMap = {};
  filteredYesterdayEntries?.forEach(e => {
    const label = e.fetchLabel;
    if (!yesterdayRegionMap[label]) {
      yesterdayRegionMap[label] = { total: 0, done: 0 };
    }
    yesterdayRegionMap[label].total += e.total;
    const done = (e.regionSummary || []).reduce((acc, r) => 
      acc + (r.statusBreakdown || [])
        .filter(s => s.status.toLowerCase().includes('submitted') || s.status.toLowerCase().includes('approved') || s.status.toLowerCase().includes('rejected'))
        .reduce((a, s) => a + s.count, 0)
    , 0);
    yesterdayRegionMap[label].done += done;
  });

  const lineData = barData.map(d => {
    const yKey = Object.keys(yesterdayRegionMap).find(k => k.split('(')[0].trim() === d.name);
    let yProgress = 0;
    if (yKey && yesterdayRegionMap[yKey].total > 0) {
      yProgress = Number(((yesterdayRegionMap[yKey].done / yesterdayRegionMap[yKey].total) * 100).toFixed(2));
    }
    return {
      name: d.name,
      diff: Number((d.progress - yProgress).toFixed(2))
    };
  });

  const chartRef = useRef(null);

  const downloadChartJpg = () => {
    if (chartRef.current === null) {
      return;
    }
    toJpeg(chartRef.current, { quality: 1, backgroundColor: '#ffffff' })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'Progress_Kecamatan_Chart.jpg';
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Oops, something went wrong!', err);
      });
  };

  const downloadExcelKecamatan = () => {
    const wsData = barData.map((d, index) => ({
      'No': index + 1,
      'Kecamatan': d.name,
      'Total Sampel': d.total,
      'Progress (%)': d.progress
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Progress Kecamatan");
    XLSX.writeFile(wb, "Progress_Kecamatan.xlsx");
  };

  const chartHeight = Math.max(240, barData.length * 50 + 60);

  return (
    <>
      <div className={styles.grid}>
        {stats.map((s, i) => (
          <div key={s.label} className={`${styles.card} ${styles[s.color]}`} style={{ animationDelay: `${i * 80}ms` }}>
            <div className={styles.icon}>{s.icon}</div>
            <div className={styles.val}>{s.value}</div>
            <div className={styles.lbl}>{s.label}</div>
          </div>
        ))}
      </div>
      
      {/* Charts Section */}
      <div className={styles.chartsContainer}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Pie Chart */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Proporsi Status</h3>
            <div className={styles.chartWrapper}>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ percent }) => `${(percent * 100).toFixed(2)}%`}
                  labelLine={true}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value) => [fmtNumber(value), "Total"]} 
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--gray-700)', backgroundColor: 'var(--white)' }}
                  itemStyle={{ color: 'var(--gray-50)' }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '0.8rem', color: 'var(--gray-300)' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.targetBanner} style={{ marginBottom: 0 }}>
          <div className={styles.targetHeader}>
            <div>
              <h3 className={styles.targetTitle}>🎯 Target & Realisasi Pelaksanaan</h3>
              <p className={styles.targetSubtitle}>Mulai pencacahan: 15 Juni 2026 (Hari ke-{daysRunning} berjalan)</p>
            </div>
          </div>
          
          <div className={styles.targetComparison}>
            <div className={styles.targetItem}>
              <span>Target Progress</span>
              <strong>{targetProgress.toFixed(2)}%</strong>
            </div>
            <div className={styles.targetItem}>
              <span>Realisasi Progress</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ color: isBelowTarget ? '#ef4444' : '#10b981' }}>{overallPct}%</strong>
                {yesterdayEntries && yesterdayEntries.length > 0 && (
                  <span style={{ 
                    fontSize: '0.85rem', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    backgroundColor: isDiffPositive ? 'rgba(16, 185, 129, 0.1)' : isDiffNegative ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                    color: isDiffPositive ? '#10b981' : isDiffNegative ? '#ef4444' : '#a1a1aa'
                  }}>
                    {isDiffPositive ? '📈 +' : isDiffNegative ? '📉 ' : ''}{diffPct}% dari hari sebelumnya
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className={`${styles.targetAlert} ${isBelowTarget ? styles.alertBelow : styles.alertAbove}`} style={{ width: 'fit-content' }}>
            {isBelowTarget ? '📉 Di bawah Target, Semangat!' : '📈 Memenuhi Target, Pertahankan!'}
          </div>
        </div>

        {/* Bar Chart Selisih Harian Kecamatan */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Kenaikan Progress Kecamatan dari Kemarin</h3>
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-700)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--gray-400)', fontSize: 9 }} angle={-45} textAnchor="end" interval={0} height={60} axisLine={false} tickLine={false} />
                <YAxis type="number" tick={{ fill: 'var(--gray-400)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  formatter={(value) => [`${value > 0 ? '+' : ''}${value}%`, "Kenaikan"]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--gray-700)', backgroundColor: 'var(--white)' }}
                  itemStyle={{ color: 'var(--primary-500)' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <ReferenceLine y={Number(diffPct)} stroke="#10b981" strokeWidth={2} strokeDasharray="3 3">
                  <Label value={`Deli Serdang: ${diffPct > 0 ? '+' : ''}${diffPct.replace('.', ',')}%`} position="top" fill="#10b981" fontSize={11} fontWeight="bold" />
                </ReferenceLine>
                <Bar dataKey="diff" fill="var(--primary-500)" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Line Chart Progress Harian (30 Hari) */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Tren Kenaikan Progress Harian (30 Hari)</h3>
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-700)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--gray-400)', fontSize: 9 }} angle={-45} textAnchor="end" interval={0} height={60} axisLine={false} tickLine={false} />
                <YAxis type="number" tick={{ fill: 'var(--gray-400)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <RechartsTooltip 
                  formatter={(value, name) => [`${value}%`, name === 'kenaikan' ? "Kenaikan Harian" : "Progress Keseluruhan"]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--gray-700)', backgroundColor: 'var(--white)' }}
                  itemStyle={{ color: 'var(--primary-500)' }}
                />
                <Line type="monotone" dataKey="kenaikan" stroke="var(--accent-orange)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent-orange)' }} activeDot={{ r: 5 }} name="kenaikan" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

        {/* Bar Chart */}
        <div className={styles.chartCard} ref={chartRef}>
          <div className={styles.headerRow}>
            <h3 className={styles.chartTitle}>Progress Kecamatan</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className={styles.downloadBtn} onClick={downloadChartJpg}>
                <span>🖼️</span> Download JPG
              </button>
              <button className={styles.downloadBtn} onClick={downloadExcelKecamatan}>
                <span>📥</span> Download Excel
              </button>
            </div>
          </div>
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={barData} layout="vertical" margin={{ top: 30, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-700)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--gray-400)', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 'dataMax + 10']} />
                <YAxis dataKey="name" type="category" tick={{ fill: 'var(--gray-400)', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                <RechartsTooltip 
                  formatter={(value, name, props) => [`${value}%`, "Progress"]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--gray-700)', backgroundColor: 'var(--white)' }}
                  itemStyle={{ color: 'var(--gray-50)' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <ReferenceLine x={Number(overallPct)} stroke="#10b981" strokeWidth={2}>
                  <Label value={`Deli Serdang; ${overallPct.replace('.', ',')}`} position="top" fill="#10b981" fontSize={14} fontWeight="bold" offset={10} />
                </ReferenceLine>
                <Bar dataKey="progress" fill="#f97316" radius={[0, 4, 4, 0]} barSize={28}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={'#f97316'} />
                  ))}
                  <LabelList dataKey="progress" position="right" formatter={(val) => val.toString().replace('.', ',')} fill="var(--gray-400)" fontSize={11} offset={5} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
