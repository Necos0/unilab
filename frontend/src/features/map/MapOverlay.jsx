/**
 * マップ全面に薄いビネット（周辺減光）を重ねるオーバーレイ層。
 *
 * 背景画像・ランドマーク・勇者スプライトの上から同一のグラデーションを
 * 1 枚かぶせることで、全要素が同じ光環境を共有しているように見せ、
 * ピクセルアートのスプライトが塗りの背景から「浮く」印象を和らげる。
 * 中央は透明・周辺だけをわずかに暗くするため、画面中央の勇者と道へ視線を
 * 誘導する副次効果もある。描画順は最前面（`PlayerSprite` より後ろ）で、
 * クリック判定を奪わないよう `pointerEvents` は無効化する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         viewBox (object): 親 `<svg>` の論理座標サイズ。`width` / `height`
 *             を参照して全面を覆う矩形のサイズに使う。
 *
 * Returns:
 *     JSX.Element: ビネット用のグラデ定義と矩形を含む `<g>` 要素。
 */
function MapOverlay({ viewBox }) {
  return (
    <g pointerEvents="none">
      <defs>
        {/*
         * objectBoundingBox（既定）なのでグラデは矩形のアスペクト比に
         * 沿って楕円状に伸び、画面形状にフィットしたビネットになる。
         */}
        <radialGradient id="map-vignette" cx="50%" cy="50%" r="72%">
          <stop offset="55%" stopColor="#08060e" stopOpacity={0} />
          <stop offset="100%" stopColor="#08060e" stopOpacity={0.34} />
        </radialGradient>
      </defs>
      <rect
        x={0}
        y={0}
        width={viewBox.width}
        height={viewBox.height}
        fill="url(#map-vignette)"
      />
    </g>
  );
}

export default MapOverlay;
