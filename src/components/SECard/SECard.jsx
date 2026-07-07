import { useState } from 'react';
import styles from './SECard.module.css';
import StatusBadge from '../StatusBadge/StatusBadge';
import ProgressBar from '../ProgressBar/ProgressBar';
import { fmtNumber, fmtDate, getRegionName, calcProgress } from '../../utils/helpers';

export default function SECard({ data, onRemove, officers = [], yesterdayEntries = [], wilayahs = [], affirmasi = [] }) {
  const [expanded, setExpanded] = useState(false);

  // Map email to officer name if available
  const officer = officers.find(o => o.email.toLowerCase() === data.email.toLowerCase());
  const displayName = officer ? officer.Nama : data.email;

  const isAffirmasi = affirmasi.some(a => a.email.toLowerCase() === data.email.toLowerCase());

  const stats = { draft: 0, open: 0, submitted: 0, approved: 0, rejected: 0 };
  data?.regionSummary?.forEach(r => {
    r.statusBreakdown?.forEach(s => {
      const st = s.status.toLowerCase();
      if (st.includes('draft')) stats.draft += s.count;
      else if (st.includes('open')) stats.open += s.count;
      else if (st.includes('submitted')) stats.submitted += s.count;
      else if (st.includes('approved')) stats.approved += s.count;
      else if (st.includes('rejected')) stats.rejected += s.count;
    });
  });

  const total = data.total || 1;
  const totalDone = stats.submitted + stats.approved + stats.rejected;
  const overallProgress = data.total > 0 ? Math.round((totalDone / data.total) * 100) : 0;
  
  const draftPct = ((stats.draft / total) * 100).toFixed(2);
  const openPct = ((stats.open / total) * 100).toFixed(2);
  const submittedPct = ((stats.submitted / total) * 100).toFixed(2);
  const approvedPct = ((stats.approved / total) * 100).toFixed(2);
  const rejectedPct = ((stats.rejected / total) * 100).toFixed(2);

  let diffText = null;
  let diffColor = '#6b7280';
  if (yesterdayEntries && yesterdayEntries.length > 0) {
    const yData = yesterdayEntries.find(e => e.id === data.id || (e.email === data.email && e.roleName === data.roleName));
    if (yData) {
      let yTotalDone = 0;
      yData.regionSummary?.forEach(r => {
        r.statusBreakdown?.forEach(s => {
          const st = s.status.toLowerCase();
          if (st.includes('submitted') || st.includes('approved') || st.includes('rejected')) {
            yTotalDone += s.count;
          }
        });
      });
      const diff = totalDone - yTotalDone;
      if (diff > 0) {
        diffText = `(+${diff})`;
        diffColor = '#10b981';
      } else if (diff < 0) {
        diffText = `(${diff})`;
        diffColor = '#ef4444';
      } else {
        diffText = `(+0)`;
      }
    }
  }

  const donePct = ((totalDone / total) * 100).toFixed(2);

  return (
    <div className={`${styles.card} animate-fadeIn`}>
      <div className={styles.compactRow}>
        {/* Left: Avatar & Info */}
        <div className={styles.infoCol}>
          <div className={styles.avatar}>
            {data.roleName?.[0]?.toUpperCase() || 'S'}
          </div>
          <div className={styles.infoText}>
            <div className={styles.nameRow}>
              <h3 className={styles.name}>{data.fetchLabel}</h3>
              <span className={styles.roleBadge}>{data.roleName}</span>
              <span className={styles.roleBadge} style={{ 
                backgroundColor: isAffirmasi ? 'rgba(16, 185, 129, 0.2)' : 'rgba(107, 114, 128, 0.2)', 
                color: isAffirmasi ? 'var(--accent-green)' : 'var(--gray-300)', 
                marginLeft: '6px',
                border: isAffirmasi ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(107, 114, 128, 0.4)'
              }}>
                {isAffirmasi ? 'Mitra Affirmasi' : 'Mitra Umum'}
              </span>
            </div>
            <p className={styles.email} title={data.email}>
              {displayName !== data.email ? `${displayName} (${data.email})` : data.email}
            </p>
            <div className={styles.fileInfo}>
              <span>{data.fileName}</span>
              <span className={styles.dot}>·</span>
              <span>Update: {fmtDate(data.uploadedAt)}</span>
            </div>
          </div>
        </div>

        {/* Center: Stats & Progress */}
        <div className={styles.statsCol}>
          <div className={styles.statsInline}>
            <div className={styles.stat}>
              <span className={styles.statVal}>{fmtNumber(data.total)}</span>
              <span className={styles.statLbl}>Sampel</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statVal}>{data.regionSummary.length}</span>
              <span className={styles.statLbl}>Wilayah</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statVal} style={{ color: '#fcd34d' }}>{fmtNumber(stats.draft)}</span>
              <span className={styles.statLbl}>Draft</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statVal} style={{ color: '#f59e0b' }}>{fmtNumber(stats.open)}</span>
              <span className={styles.statLbl}>Open</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statVal}>
                {fmtNumber(totalDone)}
                {diffText && <span style={{ fontSize: '0.65em', color: diffColor, marginLeft: '4px' }}>{diffText}</span>}
              </span>
              <span className={styles.statLbl}>Selesai</span>
            </div>
            <div className={styles.stat}>
              <span className={`${styles.statVal} ${styles.progressVal}`}>{donePct}%</span>
              <span className={styles.statLbl}>Progress</span>
            </div>
          </div>
          <div className={styles.progressSection}>
            <ProgressBar value={overallProgress} size="md" showLabel={false} />
            <div className={styles.progressBreakdown}>
              <div className={styles.breakdownItem}>
                <span className={styles.breakdownDot} style={{ background: '#fcd34d' }}></span>
                <span className={styles.breakdownLbl}>Draft: {draftPct}% ({fmtNumber(stats.draft)})</span>
              </div>
              <div className={styles.breakdownItem}>
                <span className={styles.breakdownDot} style={{ background: '#f59e0b' }}></span>
                <span className={styles.breakdownLbl}>Open: {openPct}% ({fmtNumber(stats.open)})</span>
              </div>
              <div className={styles.breakdownItem}>
                <span className={styles.breakdownDot} style={{ background: '#3b82f6' }}></span>
                <span className={styles.breakdownLbl}>Submitted: {submittedPct}%</span>
              </div>
              <div className={styles.breakdownItem}>
                <span className={styles.breakdownDot} style={{ background: '#10b981' }}></span>
                <span className={styles.breakdownLbl}>Approved: {approvedPct}%</span>
              </div>
              <div className={styles.breakdownItem}>
                <span className={styles.breakdownDot} style={{ background: '#ef4444' }}></span>
                <span className={styles.breakdownLbl}>Rejected: {rejectedPct}%</span>
              </div>
              <div className={styles.breakdownItem}>
                <span className={styles.breakdownDot} style={{ background: '#059669' }}></span>
                <span className={styles.breakdownLbl}>Total Selesai: {donePct}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.actionsCol}>
          <button
            className={styles.expandBtn}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            title="Lihat Detail Wilayah"
          >
            {expanded ? 'Tutup Detail' : 'Detail'}
          </button>
        </div>
      </div>

      {/* Region Detail */}
      {expanded && (
        <div className={styles.regionList}>
          {data.regionSummary.map((region, i) => (
            <div key={region.regionCode} className={styles.regionItem} style={{ animationDelay: `${i * 50}ms` }}>
              <div className={styles.regionHeader}>
                <div>
                  <p className={styles.regionName}>
                    {(() => {
                      let name = region.nmdesa;
                      if (region.regionCode && region.regionCode.length >= 10) {
                        const kdkec = region.regionCode.substring(4, 7);
                        const kddesa = region.regionCode.substring(7, 10);
                        let matched = wilayahs.find(w => w.kdkec === kdkec && w.kddesa === kddesa);
                        if (!matched) {
                          matched = wilayahs.find(w => w.kddesa === kddesa);
                        }
                        if (matched && matched.nmdesa) name = matched.nmdesa;
                      }
                      return name ? `[${region.regionCode.substring(7, 10)}] ${name}` : getRegionName(region.regionCode);
                    })()}
                  </p>
                  <p className={styles.regionCode}>{region.regionCode}</p>
                </div>
                <div className={styles.regionStats}>
                  <span className={styles.regionTotal}>{fmtNumber(region.total)}</span>
                  <span className={styles.regionLbl}>sampel</span>
                </div>
              </div>

              <div className={styles.regionProgress}>
                <ProgressBar value={region.progress} size="sm" />
              </div>

              <div className={styles.badges}>
                {region.statusBreakdown.map(s => (
                  <StatusBadge key={s.status} status={s.status} count={s.count} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
