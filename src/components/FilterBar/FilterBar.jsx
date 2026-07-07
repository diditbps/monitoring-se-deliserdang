import styles from './FilterBar.module.css';

const ROLE_OPTIONS = ['Semua Role', 'Pencacah', 'Pengawas'];
const SORT_OPTIONS = [
  { value: 'fetchLabel-asc', label: 'Label A–Z' },
  { value: 'fetchLabel-desc', label: 'Label Z–A' },
  { value: 'total-desc', label: 'Total Terbesar' },
  { value: 'total-asc', label: 'Total Terkecil' },
  { value: 'progress-desc', label: 'Progress Tertinggi' },
  { value: 'progress-asc', label: 'Progress Terendah' },
  { value: 'uploadedAt-desc', label: 'Terbaru Diupload' },
  { value: 'uploadedAt-asc', label: 'Terlama Diupload' },
];

import { fmtDate } from '../../utils/helpers';

export default function FilterBar({ filters, onFilterChange, totalShown, totalAll, kecamatanOptions, desaOptions, lastUpdated }) {
  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        {/* Search */}
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            id="filter-search"
            className={styles.searchInput}
            type="text"
            placeholder="Cari nama, email, region…"
            value={filters.search}
            onChange={e => onFilterChange('search', e.target.value)}
          />
          {filters.search && (
            <button
              className={styles.clearBtn}
              onClick={() => onFilterChange('search', '')}
              title="Hapus pencarian"
            >×</button>
          )}
        </div>
        

        {/* Kecamatan Filter */}
        {kecamatanOptions && kecamatanOptions.length > 0 && (
          <div className={styles.selectWrap}>
            <svg className={styles.selectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <select
              id="filter-kecamatan"
              className={styles.select}
              value={filters.kecamatan || ''}
              onChange={e => onFilterChange('kecamatan', e.target.value)}
            >
              <option value="">Semua Kecamatan</option>
              {kecamatanOptions.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        )}

        {/* Desa Filter */}
        <div className={styles.selectWrap} style={{ opacity: !filters.kecamatan ? 0.5 : 1, pointerEvents: !filters.kecamatan ? 'none' : 'auto' }}>
          <svg className={styles.selectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <select
            id="filter-desa"
            className={styles.select}
            value={filters.desa || ''}
            onChange={e => onFilterChange('desa', e.target.value)}
            disabled={!filters.kecamatan}
          >
            <option value="">{filters.kecamatan ? 'Semua Desa' : 'Pilih Kecamatan Dulu'}</option>
            {desaOptions && desaOptions.map(d => (
              <option key={d.code} value={d.code}>[{d.code}] {d.name}</option>
            ))}
          </select>
        </div>

        {/* Role Filter */}
        <div className={styles.selectWrap}>
          <svg className={styles.selectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <select
            id="filter-role"
            className={styles.select}
            value={filters.role}
            onChange={e => onFilterChange('role', e.target.value)}
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r} value={r === 'Semua Role' ? '' : r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Mitra Type Filter */}
        <div className={styles.selectWrap}>
          <svg className={styles.selectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 22h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <select
            id="filter-mitraType"
            className={styles.select}
            value={filters.mitraType}
            onChange={e => onFilterChange('mitraType', e.target.value)}
          >
            <option value="">Semua Mitra</option>
            <option value="Affirmasi">Mitra Affirmasi</option>
            <option value="Umum">Mitra Umum</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className={styles.selectWrap}>
          <svg className={styles.selectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <select
            id="filter-status"
            className={styles.select}
            value={filters.status}
            onChange={e => onFilterChange('status', e.target.value)}
          >
            <option value="">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
          </select>
        </div>
      </div>

      <div className={styles.right}>
        {/* Sort */}
        <div className={styles.selectWrap}>
          <svg className={styles.selectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M7 12h10M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <select
            id="filter-sort"
            className={styles.select}
            value={filters.sort}
            onChange={e => onFilterChange('sort', e.target.value)}
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.count}>
          <div>
            <span className={styles.countNum}>{totalShown}</span>
            <span className={styles.countOf}> / {totalAll} SE</span>
          </div>
          {lastUpdated && (
            <div className={styles.updateTime} title="Update Terakhir">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>{fmtDate(lastUpdated)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
