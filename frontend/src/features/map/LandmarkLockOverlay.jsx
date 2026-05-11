import styles from './LandmarkLockOverlay.module.css';

const SCROLL_HALF_WIDTH = 80;
const SCROLL_HALF_HEIGHT = 16;

/**
 * `LandmarkScroll` 上に重ねて表示する、南京錠のロックオーバーレイ。
 *
 * 視覚要素は 3 層で構成する：
 *   1. 半透明黒の背景矩形（Scroll 全面）— 「ロックされて暗くなった」感
 *   2. 解放演出用の黄色いバーストリング（解放時のみアニメで外側に拡がる）
 *   3. 中央の南京錠 — `<rect>`（本体）＋ `<path>`（シャックル U 字）＋
 *      `<circle>` / `<rect>`（鍵穴）
 *
 * 座標は `LandmarkScroll` と同じ（中心 (0,0)、Scroll は半幅 80・半高 16）。
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
        <Padlock />
      </g>
    </g>
  );
}

/**
 * 中央に配置する南京錠を描画する内部コンポーネント。
 *
 * 本体（角丸 `<rect>`）＋ シャックル（`<path>` の半円アーチ）＋ 鍵穴
 * （`<circle>` + 細い縦長 `<rect>`）の 3 パーツで構成する。座標は親
 * グループの中心 (0,0) を基準にする。
 *
 * Returns:
 *     JSX.Element: 南京錠を表す `<g>` 要素。
 */
function Padlock() {
  return (
    <g className={styles.padlock}>
      <path
        d="M -6 0 A 6 6 0 0 1 6 0"
        className={styles.shackle}
      />
      <rect
        x={-9}
        y={-1}
        width={18}
        height={14}
        rx={2}
        ry={2}
        className={styles.body}
      />
      <circle cx={0} cy={5} r={1.6} className={styles.keyhole} />
      <rect x={-0.8} y={5} width={1.6} height={4} className={styles.keyhole} />
    </g>
  );
}

export default LandmarkLockOverlay;
