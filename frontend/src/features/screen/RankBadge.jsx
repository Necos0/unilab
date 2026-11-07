import styles from './RankBadge.module.css';

/* 1〜3 位の王冠の色（金・銀・銅）。 */
const CROWN_CLASS_BY_RANK = {
  1: styles.gold,
  2: styles.silver,
  3: styles.bronze,
};

/**
 * 集計スクリーンの一覧の左端に出す順位マーク。
 *
 * 1〜3 位は金・銀・銅の王冠に順位の数字を重ねて、上位であることが
 * ひと目でわかるようにする。4 位以下は「4.」「5.」のように数字だけを出す。
 * 幅はどの順位でも同じなので、名前の書き出し位置がそろう。
 *
 * Args:
 *     rank (number): 1 から始まる順位。
 *
 * Returns:
 *     JSX.Element: 順位マーク。
 */
function RankBadge({ rank }) {
  const crownClass = CROWN_CLASS_BY_RANK[rank];

  if (!crownClass) {
    return <span className={styles.badge}>{`${rank}.`}</span>;
  }

  return (
    <span className={`${styles.badge} ${crownClass}`} aria-label={`${rank}位`}>
      <svg className={styles.crownIcon} viewBox="0 0 16 13" aria-hidden="true">
        <polygon className={styles.crownBody} points="1,3 4.5,7 8,2 11.5,7 15,3 14,13 2,13" />
        <circle className={styles.crownJewel} cx="1" cy="2.2" r="1.2" />
        <circle className={styles.crownJewel} cx="8" cy="1.2" r="1.2" />
        <circle className={styles.crownJewel} cx="15" cy="2.2" r="1.2" />
      </svg>
      <span className={styles.crownNumber}>{rank}</span>
    </span>
  );
}

export default RankBadge;
