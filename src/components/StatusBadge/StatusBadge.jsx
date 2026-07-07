import styles from './StatusBadge.module.css';
import { getStatusLabel } from '../../utils/helpers';

const colorMap = {
  'open': styles.open,
  'submitted': styles.submitted,
  'approved': styles.approved,
  'rejected': styles.rejected,
};

export default function StatusBadge({ status, count }) {
  const key = Object.keys(colorMap).find(k => status.toLowerCase().includes(k)) || '';
  const cls = colorMap[key] || styles.default;

  return (
    <span className={`${styles.badge} ${cls}`}>
      {count !== undefined && <span className={styles.count}>{count}</span>}
      <span>{getStatusLabel(status)}</span>
    </span>
  );
}
