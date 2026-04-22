import styles from './HpBar.module.css';

/**
 * 汎用の HP バーコンポーネント。
 *
 * ピクセルアート調の白枠と暗色背景で「器」を、緑色のフィルで「残量」を
 * 表示する。`currentHp` は 0 〜 `maxHp` にクランプされ、`maxHp` に対する
 * 比率で fill の幅が決まる。`maxHp` が未指定または 0 以下の場合は
 * `null` を返してレイアウトを崩さない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         currentHp (number): 現在 HP。
 *         maxHp (number): 最大 HP。1 以上を想定。
 *
 * Returns:
 *     JSX.Element | null: HP バー要素、または無効な入力時 null。
 */
function HpBar({ currentHp, maxHp }) {
  if (maxHp == null || maxHp <= 0) {
    return null;
  }

  const clampedHp = Math.max(0, Math.min(maxHp, currentHp));
  const ratio = clampedHp / maxHp;

  return (
    <div className={styles.frame}>
      <div
        className={styles.fill}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

export default HpBar;
