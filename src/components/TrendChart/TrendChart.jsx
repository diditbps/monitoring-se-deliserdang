import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import styles from './TrendChart.module.css';

export default function TrendChart({ entries }) {
  // Default end date is today, start date is 7 days ago
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 7);
  const [startDate, setStartDate] = useState(defaultStart.toISOString().split('T')[0]);

  // Aggregate data by date
  const chartData = useMemo(() => {
    if (!entries || entries.length === 0) return [];

    // Filter entries by date range
    const filteredEntries = entries.filter(e => e.dateOnly >= startDate && e.dateOnly <= endDate);

    // We want a snapshot of the *latest* progress per baseId for each date in the range.
    // However, simple aggregation of all entries uploaded on a date might be easier.
    // The prompt just asks for "menampilkan data tren".
    // We'll calculate the total samples and total completed for each date based on the latest snapshot per user per date.
    
    // First, group by date
    const dateMap = new Map();
    
    // Initialize all dates in range
    let current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
      dateMap.set(current.toISOString().split('T')[0], { date: current.toISOString().split('T')[0], total: 0, done: 0, count: 0 });
      current.setDate(current.getDate() + 1);
    }

    // Now, for each date, we find the latest entry for each baseId up to that date.
    const uniqueBaseIds = [...new Set(entries.map(e => e.baseId))];
    
    dateMap.forEach((val, dateStr) => {
      let dailyTotal = 0;
      let dailyDone = 0;
      let dailyCount = 0;

      uniqueBaseIds.forEach(baseId => {
        // Find latest entry for this baseId up to dateStr
        const userEntries = entries.filter(e => e.baseId === baseId && e.dateOnly <= dateStr);
        if (userEntries.length > 0) {
          // Sort descending by dateOnly and uploadedAt
          userEntries.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
          const latest = userEntries[0];
          
          dailyTotal += latest.total;
          const done = latest.regionSummary.reduce((acc, r) => 
            acc + r.statusBreakdown
              .filter(s => !s.status.toLowerCase().includes('open'))
              .reduce((a, s) => a + s.count, 0), 0);
          dailyDone += done;
          dailyCount++;
        }
      });
      
      val.total = dailyTotal;
      val.done = dailyDone;
      val.count = dailyCount;
    });

    return Array.from(dateMap.values());
  }, [entries, startDate, endDate]);

  const hasData = chartData.some(d => d.count > 0);

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.datePickerGroup}>
          <label>Dari Tanggal:</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            className={styles.dateInput}
          />
        </div>
        <div className={styles.datePickerGroup}>
          <label>Sampai Tanggal:</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            className={styles.dateInput}
          />
        </div>
      </div>

      <div className={styles.chartWrapper}>
        {!hasData ? (
          <div className={styles.noData}>Tidak ada data tren pada rentang tanggal ini.</div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorDone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                itemStyle={{ color: '#f8fafc' }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Area type="monotone" dataKey="total" name="Total Sampel" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" />
              <Area type="monotone" dataKey="done" name="Selesai (Non-Open)" stroke="#10b981" fillOpacity={1} fill="url(#colorDone)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
