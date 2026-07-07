/**
 * Utility helpers untuk SE Monitoring
 */

// Kode region → nama wilayah (hardcoded untuk Deli Serdang / GALANG)
const REGION_NAME_MAP = {
  '1212190008000100': 'Desa Sialang Taru',
  '1212190012000300': 'Desa Galang Kota',
  '1212190012000200': 'Desa Tanjung Morawa',
  '1212190012000400': 'Desa Pagar Jati',
  '1212190012000100': 'Desa Pekan Galang',
};

export function getRegionName(code) {
  return REGION_NAME_MAP[code] || code;
}

/**
 * Ambil label warna berdasarkan status
 */
export function getStatusColor(status = '') {
  const s = status.toLowerCase();
  if (s.includes('open')) return 'status-open';
  if (s.includes('submitted')) return 'status-submitted';
  if (s.includes('approved')) return 'status-approved';
  if (s.includes('rejected')) return 'status-rejected';
  return 'status-default';
}

export function getStatusLabel(status = '') {
  const s = status.toLowerCase();
  if (s.includes('open')) return 'Open';
  if (s.includes('submitted')) return 'Submitted';
  if (s.includes('approved')) return 'Approved';
  if (s.includes('rejected')) return 'Rejected';
  return status;
}

/**
 * Hitung progress (non-OPEN / total)
 */
export function calcProgress(statusBreakdown = [], total = 0) {
  if (total === 0) return 0;
  const done = statusBreakdown
    .filter(s => !s.status.toLowerCase().includes('open'))
    .reduce((acc, s) => acc + s.count, 0);
  return Math.round((done / total) * 100);
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Parse satu file JSON menjadi format internal
 */
export function parseJsonFile(raw, fileName, uploadType = 'pencacah', uploadDate = null) {
  // Bisa array atau objek tunggal
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((item, idx) => {
    const userIdentifier = item.userId || item.username || item.email || `${fileName}`;
    const fetchLabelClean = item._fetch_label ? String(item._fetch_label).replace(/[^a-zA-Z0-9]/g, '') : '';
    const itemHash = hashCode(JSON.stringify(item));
    const baseId = fetchLabelClean ? `${userIdentifier}_${fetchLabelClean}_${itemHash}` : `${userIdentifier}_${itemHash}`;
    const todayStr = uploadDate || new Date().toISOString().split('T')[0];
    const uniqueId = `${baseId}_${uploadType}_${todayStr}_${idx}`;
    return {
      id: uniqueId,
      baseId: baseId,
      fileName,
      fetchLabel: item._fetch_label || '-',
      email: item.email || item.username || '-',
      roleName: uploadType === 'pengawas' ? 'Pengawas' : (item.roleName || 'Pencacah'),
      roleSequence: item.roleSequence ?? null,
      isPencacah: uploadType === 'pencacah' ? true : (uploadType === 'pengawas' ? false : (item.isPencacah ?? false)),
      total: item.total || 0,
      userId: item.userId || '-',
      regionSummary: (item.regionSummary || []).map(r => ({
        regionCode: r.regionCode,
        nmdesa: r.nmdesa,
        total: r.total,
        statusBreakdown: r.statusBreakdown || [],
        progress: calcProgress(r.statusBreakdown, r.total),
      })),
      uploadedAt: new Date().toISOString(),
      dateOnly: todayStr,
    };
  });
}

/**
 * Format number dengan separator ribuan (ID)
 */
export function fmtNumber(n) {
  const num = Number(n);
  if (isNaN(num)) return n;
  if (num % 1 !== 0) {
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  }
  return new Intl.NumberFormat('id-ID').format(num);
}

/**
 * Format tanggal menjadi string lokal
 */
export function fmtDate(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
