import styles from './ProgressBar.module.css';

export default function ProgressBar({ value = 0, showLabel = true, size = 'md' }) {
  const clamped = Math.max(0, Math.min(100, value));
  const colorCls =
    clamped >= 80 ? styles.high :
    clamped >= 40 ? styles.mid :
    styles.low;

  return (
    <div className={`${styles.wrapper} ${styles[size]}`}>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${colorCls}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className={styles.label}>{clamped}%</span>
      )}
    </div>
  );
}
