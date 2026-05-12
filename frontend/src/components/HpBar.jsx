import styles from './HpBar.module.css';

/**
 * 汎用の HP バーコンポーネント。
 *
 * ピクセルアート調の白枠と暗色背景で「器」を、緑色のフィルで「残量」を
 * 表示する。`currentHp` は 0 〜 `maxHp` にクランプされ、`maxHp + shield`
 * を共通分母とした比率で fill の幅が決まる。`maxHp` が未指定または 0 以下
 * の場合は `null` を返してレイアウトを崩さない。
 *
 * `shield` プロパティ（optional、デフォルト 0）が正の値のときは、`.frame`
 * の幅を `(maxHp + shield) / maxHp` 倍に拡張し、青色の「シールド領域」を
 * 緑の現在 HP fill の右端に直接くっつける形で描画する。`.shield` の `left`
 * を `${hpRatio * 100}%`、`width` を `${shieldRatio * 100}%` の inline style
 * で動的に指定することで、HP が減ったときは緑の終端と青の左端が同期して
 * 左へ縮み、失った HP 分は `.frame` 自身の `background: #0b0b10` がそのまま
 * 透けて見えて右端に黒として残る。これにより「緑（現在 HP）→ 青（シールド）
 * → 黒（失った HP）」の 3 セグメント構造が、追加の要素なしで自然に成立する
 * （`guard-card-effect` 要件 6-1〜6-4）。
 *
 * `.shield` の `transition` は `width` だけでなく `left` にも `0.25s` を
 * 適用しているため、被弾でシールドが減るときも回復で緑が伸びるときも、
 * 緑の右端と青の左端の追従が滑らかに同期する。`.fill` の `width` トラン
 * ジションと持続時間を揃えることで、3 つの要素（`.fill` の width、
 * `.shield` の left と width）が同じカーブで動くアニメーションになる。
 *
 * `shield = 0` のときは `.shield` 要素自体をレンダリングせず、`.frame` の
 * `width` も `var(--shield-scale, 1)` のフォールバック値 `1` によって従来の
 * 180px に戻る。これにより、敵側 HP バー（`shield` を渡していない呼び出し）
 * を含む既存呼び出しはすべて完全後方互換で動作する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         currentHp (number): 現在 HP。
 *         maxHp (number): 最大 HP。1 以上を想定。
 *         shield (number, optional): 防御シールド残量。0 以上の数値で、
 *             デフォルト 0。負の値は内部で `Math.max(0, ...)` で 0 に
 *             クランプする。
 *
 * Returns:
 *     JSX.Element | null: HP バー要素、または無効な入力時 null。
 */
function HpBar({ currentHp, maxHp, shield = 0 }) {
  if (maxHp == null || maxHp <= 0) {
    return null;
  }

  const clampedHp = Math.max(0, Math.min(maxHp, currentHp));
  const normalizedShield = Math.max(0, shield);
  const total = maxHp + normalizedShield;
  const hpRatio = clampedHp / total;
  const shieldRatio = normalizedShield / total;
  const scale = total / maxHp;

  return (
    <div 
      className={styles.frame}
      style={{ '--shield-scale': scale }}
    >
      <div
        className={styles.fill}
        style={{ width: `${hpRatio * 100}%` }}
      />
      {normalizedShield > 0 && (
        <div 
          className={styles.shield}
          style={{ 
            left: `${hpRatio * 100}%`,
            width: `${shieldRatio * 100}%`, 
          }}
        />
      )}
    </div>
  );
}

export default HpBar;
