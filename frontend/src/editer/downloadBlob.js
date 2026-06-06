/**
 * Blob を指定ファイル名でブラウザにダウンロードさせる。
 *
 * 一時的な object URL を作って `<a download>` をプログラム的にクリックし、
 * 直後に URL を解放する。生成した anchor は DOM に残さない。
 *
 * Args:
 *     blob (Blob): ダウンロードさせるデータ。
 *     filename (string): 保存時のファイル名。
 *
 * Returns:
 *     void
 */
export default function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
