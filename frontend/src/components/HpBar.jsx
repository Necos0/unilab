import styles from './HpBar.module.css';

/**
 * 汎用の HP バーコンポーネント。
 *
 * ピクセルアート調の白枠と暗色背景で「器」を、緑色のフィルで「残量」を
 * 表示する。`currentHp` は 0 〜 `maxHp` にクランプされ、`clampedHp / maxHp`
 * の比率で `.fill` の幅が決まる。`maxHp` が未指定または 0 以下の場合は
 * `null` を返してレイアウトを崩さない。
 *
 * 外側を `.row`（flex）でラップし、`icon` props（ReactNode、デフォルト
 * `null`）が渡されたときに `.frame` の左にアイコンを並べる。`icon == null`
 * のとき React は何も描画しないため、敵 HP バーのような「左アイコン不要」の
 * 呼び出しは props を渡さないだけで従来通りの見た目になる。プレイヤー HP
 * バーは `BattleScreen` 側で `<CrossIcon />` を `icon` に渡すことで、HP の
 * 種別を視覚的に示すアイコンを左に表示する（`guard-bar-redesign` 要件 1-4）。
 *
 * `reflectActive` プロパティ（optional、デフォルト false）が `true` のときは、
 * `.fill` に `.reflect` クラスを付与して背景色を緑（`#3ad430`）からオレンジ
 * （`#ff8c42`）に切り替える。`transition: background 0.25s` により、付与時・
 * 解除時の色変化が滑らかにアニメートする。`.reflect` クラスは `.fill` を基底と
 * する複合セレクタ（`.fill.reflect`）として書かれているため、CSS Specificity
 * が高く、緑↔オレンジの切替が確実に効く（`reflect-card-effect` 要件 1-2, 4-2）。
 * `reflectActive` は `guardShield > 0` と排他関係にあり（`battleStore` の
 * `applyGuard` / `applyReflect` で互いをクリア）、ガードが立っているときに
 * オレンジ fill が出ることはない。
 *
 * 設計の変遷：旧仕様では `shield` props と `--shield-scale` CSS 変数を使い、
 * HP バー右側に青いシールド領域を連結描画していた（`guard-card-effect`
 * 要件 6-1〜6-4）。`guard-bar-redesign` 仕様で「HP バーの真上に独立した
 * GuardBar を置く Fortnite 風の 2 段スタック構造」に切り替えたため、本
 * コンポーネントは HP のみを描画し、ガード表示は `GuardBar.jsx` に分離した。
 * `.frame` の `width` は 180px 固定に戻り、`width` トランジションも不要に
 * なった。
 *
 * Args:
 *     props (object): React プロパティ。
 *         currentHp (number): 現在 HP。
 *         maxHp (number): 最大 HP。1 以上を想定。
 *         reflectActive (boolean, optional): リフレクト状態のフラグ。
 *             デフォルト false。true のとき `.fill` がオレンジ色に変化する。
 *         icon (ReactNode, optional): バー左側に表示するアイコン。デフォルト
 *             `null`（アイコンなし）。敵 HP バーは未指定、プレイヤー HP バーは
 *             `<CrossIcon />` を渡す想定。
 *
 * Returns:
 *     JSX.Element | null: HP バー要素、または無効な入力時 null。
 */
function HpBar({ currentHp, maxHp, reflectActive = false, icon = null }) {
  if (maxHp == null || maxHp <= 0) {
    return null;
  }

  const clampedHp = Math.max(0, Math.min(maxHp, currentHp));
  const hpRatio = clampedHp / maxHp;
  const fillClassName = reflectActive ? `${styles.fill} ${styles.reflect}` : styles.fill;

  return (
    <div className={styles.row}>
      {icon}
      <div className={styles.frame}>
        <div
          className={fillClassName}
          style={{ width: `${hpRatio * 100}%` }}
        />
      </div>
    </div>
  );
}

export default HpBar;
