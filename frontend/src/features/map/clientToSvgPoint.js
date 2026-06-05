/**
 * クライアント座標（ピクセル）を SVG のユーザー座標系へ変換する。
 *
 * `preserveAspectRatio="xMidYMid meet"` によるレターボックス化や viewBox の
 * スケーリングを `getScreenCTM()` が内包するため、その逆行列を掛けるだけで
 * マウス／ポインタ位置を viewBox 基準の座標に正しく落とせる。マップ座標
 * エディタのドラッグ処理で、ポインタの実画面位置を `maps.json` と同じ座標
 * 系に変換するために使う。
 *
 * Args:
 *     svg (SVGSVGElement): 対象の `<svg>` 要素。
 *     clientX (number): ポインタの clientX（ビューポート基準ピクセル）。
 *     clientY (number): ポインタの clientY（ビューポート基準ピクセル）。
 *
 * Returns:
 *     {x: number, y: number}: viewBox 座標系での座標。CTM が取得できない
 *         場合は `{x: 0, y: 0}`。
 */
export function clientToSvgPoint(svg, clientX, clientY) {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    return { x: 0, y: 0 };
  }
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}
