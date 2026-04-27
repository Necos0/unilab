/**
 * マップ背景画像を SVG `<image>` として描画するコンポーネント。
 *
 * 親 `<svg>` の viewBox（論理座標）全面に画像を貼ることで、ウィンドウ
 * サイズが変わってもアスペクト比と相対位置が崩れない（要件 1-2, 6-3）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         mapDef (object): `maps.json` の 1 マップ分。`image` と `viewBox`
 *             を参照する。
 *
 * Returns:
 *     JSX.Element: SVG `<image>` 要素。
 */
function MapBackground({ mapDef }) {
  const { image, viewBox } = mapDef;
  return (
    <image
      href={image}
      x={0}
      y={0}
      width={viewBox.width}
      height={viewBox.height}
      preserveAspectRatio="xMidYMid slice"
    />
  );
}

export default MapBackground;
