import styles from './LandmarkScroll.module.css';
import LandmarkLockOverlay from './LandmarkLockOverlay';

const SCROLL_IMAGE_HREF = '/icons/landmark_scroll.png';

/**
 * ランドマークの上に常時表示される、巻物形のラベルバナー。
 *
 * 背景は `/icons/landmark_scroll.png`（パーチメント／巻物のピクセルアート
 * 画像）を SVG `<image>` で読み込み、ステージ名（`label`）をその上に
 * `<text>` で中央配置する。横幅は最長 8 文字の `ストーンサークル` まで
 * 収まる固定値（160×32 SVG 単位）。SVG `<g>` 要素を返すため、親側で
 * `transform="translate(...)"` を当てて配置する想定。クリック判定と
 * ホバー演出は CSS 側で `.scroll` クラスにかけている。
 *
 * ホバー・解放演出はすべて `filter`（brightness）で表現する。`<image>` は
 * `fill` プロパティを持たないため、画像の明滅は CSS `filter` を介して
 * 行う必要がある。`image-rendering: pixelated` で拡縮時もシャープな
 * ピクセルアートの見た目を保つ。
 *
 * `isLocked === true` のとき、最前面に `LandmarkLockOverlay`（南京錠＋
 * バーストリング）を重ねて描画する（要件 1-2）。さらに `isFading === true`
 * のとき、オーバーレイ側で解放アニメが走る（要件 5-1）。フェード完了後の
 * visibility 切替（要件 5-2）は親 `Landmark` が `pendingUnlockStageId` を
 * 消す形で行うため、本コンポーネントは受け取った prop を素直に渡す責務
 * だけを持つ。
 *
 * Args:
 *     props (object): React プロパティ。
 *         label (string): ラベル上に表示するステージ名。
 *         isLocked (boolean, optional): ロックオーバーレイを表示するなら
 *             `true`。デフォルト `false`。
 *         isFading (boolean, optional): ロックオーバーレイの解放アニメを
 *             発火するなら `true`。`isLocked === false` のときは無視
 *             される。`true` のときは本コンポーネント側の `data-unlocking`
 *             属性も同期し、スクロール全体の振動・パーチメント閃光が
 *             発火する。デフォルト `false`。
 *
 * Returns:
 *     JSX.Element: ラベルバナー全体を表す `<g>` 要素。
 */
function LandmarkScroll({ label, isLocked = false, isFading = false }) {
  const halfWidth = 80;
  const halfHeight = 16;

  return (
    <g
      className={styles.scroll}
      data-unlocking={isFading ? 'true' : 'false'}
    >
      <image
        href={SCROLL_IMAGE_HREF}
        x={-halfWidth}
        y={-halfHeight}
        width={halfWidth * 2}
        height={halfHeight * 2}
        className={styles.parchment}
        preserveAspectRatio="none"
      />
      <text x={0} y={5} textAnchor="middle" className={styles.text}>
        {label}
      </text>
      {isLocked && <LandmarkLockOverlay isFading={isFading} />}
    </g>
  );
}

export default LandmarkScroll;
