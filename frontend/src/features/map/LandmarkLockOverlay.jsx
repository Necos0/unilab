import styles from './LandmarkLockOverlay.module.css';

const SCROLL_HALF_WIDTH = 115.2;
const SCROLL_HALF_HEIGHT = 35;

const PADLOCK_IMAGE_HREF = '/icons/landmark_padlock.png';
const PADLOCK_SIZE = 78.4;
const PADLOCK_HALF = PADLOCK_SIZE / 2;

/**
 * `LandmarkScroll` 上に重ねて表示する、南京錠のロックオーバーレイ。
 *
 * 視覚要素は 3 層で構成する：
 *   1. 半透明黒の背景矩形（Scroll 全面）— 「ロックされて暗くなった」感
 *   2. 解放演出用の黄色いバーストリング（解放時のみアニメで外側に拡がる）
 *   3. 中央の南京錠 — ピクセルアート画像 `/icons/landmark_padlock.png` を
 *      `<image>` で読み込む（`PADLOCK_SIZE`×`PADLOCK_SIZE` SVG 単位、原点中心配置）
 *
 * 座標は `LandmarkScroll` と同じ（中心 (0,0)、Scroll は半幅 115.2・半高 35）。
 * 描画自体は `pointer-events: none` で、クリック判定の抑止は親
 * `Landmark` 側で行う（要件 2-3）。`isFading` を `true` にすると CSS
 * アニメーションで解放演出が発火する（要件 5-1）：
 *   - 暗幕（`.dim`）：opacity 1 → 0 に消える
 *   - 南京錠（`.padlockGroup`）：軽く拡大して傾きながらスケールダウン
 *     して消える（破壊感）
 *   - バーストリング（`.burst`）：Scroll 外形に沿う楕円が中央から外側へ
 *     拡がり、フェードアウトする（発光感）
 * フェード時間は `progressStore.UNLOCK_FADE_DURATION_MS` と CSS の
 * `animation-duration` で共有している（600ms）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         isFading (boolean): フェードアウト中なら `true`。`data-fading`
 *             属性で CSS 側のアニメーション制御に渡される。
 *
 * Returns:
 *     JSX.Element: ロックオーバーレイ全体を表す `<g>` 要素。
 */
function LandmarkLockOverlay({ isFading = false }) {
  return (
    <g
      className={styles.overlay}
      data-fading={isFading ? 'true' : 'false'}
    >
      <rect
        x={-SCROLL_HALF_WIDTH}
        y={-SCROLL_HALF_HEIGHT}
        width={SCROLL_HALF_WIDTH * 2}
        height={SCROLL_HALF_HEIGHT * 2}
        rx={4}
        ry={4}
        className={styles.dim}
      />
      <ellipse
        cx={0}
        cy={0}
        rx={SCROLL_HALF_WIDTH}
        ry={SCROLL_HALF_HEIGHT}
        className={styles.burst}
      />
      <g className={styles.padlockGroup}>
        <image
          href={PADLOCK_IMAGE_HREF}
          x={-PADLOCK_HALF}
          y={-PADLOCK_HALF}
          width={PADLOCK_SIZE}
          height={PADLOCK_SIZE}
          className={styles.padlock}
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
    </g>
  );
}

export default LandmarkLockOverlay;
