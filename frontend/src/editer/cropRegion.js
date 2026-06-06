/**
 * 元画像から指定矩形を原寸ピクセルのまま切り出して PNG の dataURL を返す。
 *
 * 表示上の拡大縮小（ビューのズーム）とは無関係に、引数の座標・サイズは常に
 * 元画像のネイティブピクセルとして扱う。オフスクリーンの canvas に等倍で
 * 描き写すことで、にじみのないドット絵をそのまま取り出す。透過は保持する。
 * 枠が画像の外にはみ出した部分は透明として書き出される。
 *
 * Args:
 *     image (HTMLImageElement): 切り出し元の画像要素（読み込み済み）。
 *     x (number): 切り出し矩形の左上 X 座標（元画像ピクセル）。
 *     y (number): 切り出し矩形の左上 Y 座標（元画像ピクセル）。
 *     width (number): 切り出し幅（元画像ピクセル）。
 *     height (number): 切り出し高さ（元画像ピクセル）。
 *
 * Returns:
 *     string: 切り出した画像の `image/png` 形式 dataURL。
 */
export default function cropRegion(image, x, y, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}
