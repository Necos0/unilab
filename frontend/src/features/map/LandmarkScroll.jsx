import styles from './LandmarkScroll.module.css';
import LandmarkLockOverlay from './LandmarkLockOverlay';

/**
 * ランドマークの上に常時表示される、矩形のラベルバナー。
 *
 * パーチメント風の塗り色を載せた角丸の長方形に、ステージ名（ランドマーク
 * `label`）を中央配置するシンプルな表示。横幅は文字数に応じてある程度の
 * 余白を持つ固定値とする（最長 8 文字の `ストーンサークル` まで収まる
 * よう調整）。SVG `<g>` 要素を返すため、親側で `transform="translate(...)"`
 * を当てて配置する想定。クリック判定とホバー演出は CSS 側で `.scroll`
 * クラスにかけている。
 *
 * `isLocked === true` のとき、最前面に `LandmarkLockOverlay`（鎖＋南京錠）
 * を重ねて描画する（要件 1-2）。さらに `isFading === true` のとき、
 * オーバーレイ側でフェードアウトのトランジションが走る（要件 5-1）。
 * フェード完了後の visibility 切替（要件 5-2）は親 `Landmark` が
 * `pendingUnlockStageId` を消す形で行うため、本コンポーネントは
 * 受け取った prop を素直に渡す責務だけを持つ。
 *
 * Args:
 *     props (object): React プロパティ。
 *         label (string): ラベル上に表示するステージ名。
 *         isLocked (boolean, optional): ロックオーバーレイを表示するなら
 *             `true`。デフォルト `false`。
 *         isFading (boolean, optional): ロックオーバーレイをフェード
 *             アウトさせるなら `true`。`isLocked === false` のときは
 *             無視される。デフォルト `false`。
 *
 * Returns:
 *     JSX.Element: ラベルバナー全体を表す `<g>` 要素。
 */
function LandmarkScroll({ label, isLocked = false, isFading = false }) {
  const halfWidth = 80;
  const halfHeight = 16;

  return (
    <g className={styles.scroll}>
      <rect
        x={-halfWidth}
        y={-halfHeight}
        width={halfWidth * 2}
        height={halfHeight * 2}
        rx={4}
        ry={4}
        className={styles.parchment}
      />
      <text x={0} y={5} textAnchor="middle" className={styles.text}>
        {label}
      </text>
      {isLocked && <LandmarkLockOverlay isFading={isFading} />}
    </g>
  );
}

export default LandmarkScroll;
