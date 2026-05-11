import styles from './LandmarkLockOverlay.module.css';

const SCROLL_HALF_WIDTH = 80;
const SCROLL_HALF_HEIGHT = 16;
const CHAIN_LINK_COUNT = 6;

/**
 * `LandmarkScroll` 上に重ねて表示する、鎖＋南京錠のロックオーバーレイ。
 *
 * 視覚要素は 3 層で構成する：
 *   1. 半透明黒の背景矩形（Scroll 全面）— 「鎖がかかって暗くなった」感
 *   2. 対角の鎖 2 本 — `(-80,-16) → (80,16)` と `(-80,16) → (80,-16)` の
 *      対角線に沿って `<ellipse>` をリンク状に等間隔で並べる
 *   3. 中央の南京錠 — `<rect>`（本体）＋ `<path>`（シャックル U 字）＋
 *      `<circle>` / `<rect>`（鍵穴）
 *
 * 座標は `LandmarkScroll` と同じ（中心 (0,0)、Scroll は半幅 80・半高 16）。
 * 描画自体は `pointer-events: none` で、クリック判定の抑止は親
 * `Landmark` 側で行う（要件 2-3）。`isFading` を `true` にすると CSS
 * トランジションで opacity 1 → 0 へフェードアウトする（要件 5-1）。
 * フェード時間は `progressStore.UNLOCK_FADE_DURATION_MS` と CSS の
 * `transition-duration` で共有している。
 *
 * Args:
 *     props (object): React プロパティ。
 *         isFading (boolean): フェードアウト中なら `true`。`data-fading`
 *             属性で CSS 側 opacity 制御に渡される。
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
      <ChainLine
        from={{ x: -SCROLL_HALF_WIDTH, y: -SCROLL_HALF_HEIGHT }}
        to={{ x: SCROLL_HALF_WIDTH, y: SCROLL_HALF_HEIGHT }}
        linkCount={CHAIN_LINK_COUNT}
      />
      <ChainLine
        from={{ x: -SCROLL_HALF_WIDTH, y: SCROLL_HALF_HEIGHT }}
        to={{ x: SCROLL_HALF_WIDTH, y: -SCROLL_HALF_HEIGHT }}
        linkCount={CHAIN_LINK_COUNT}
      />
      <Padlock />
    </g>
  );
}

/**
 * 2 点間に楕円形のリンクを等間隔に並べた「鎖」を描画する内部コンポーネント。
 *
 * リンクは `<ellipse>` で描画し、線の方向に合わせて回転させる。
 * 等間隔配置は `t` を `[0, 1]` の範囲で `linkCount` 等分して計算する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         from (object): 始点座標 `{x, y}`。
 *         to (object): 終点座標 `{x, y}`。
 *         linkCount (number): 並べるリンクの個数。
 *
 * Returns:
 *     JSX.Element: 鎖 1 本分の `<g>` 要素。
 */
function ChainLine({ from, to, linkCount }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const links = [];
  for (let i = 0; i < linkCount; i += 1) {
    const t = (i + 0.5) / linkCount;
    const cx = from.x + dx * t;
    const cy = from.y + dy * t;
    links.push(
      <ellipse
        key={i}
        cx={cx}
        cy={cy}
        rx={5}
        ry={2.8}
        transform={`rotate(${angleDeg} ${cx} ${cy})`}
        className={styles.chainLink}
      />,
    );
  }
  return <g>{links}</g>;
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
