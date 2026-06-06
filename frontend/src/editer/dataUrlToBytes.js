/**
 * `data:...;base64,xxxx` 形式の dataURL をバイト列（Uint8Array）に変換する。
 *
 * canvas が吐く PNG の dataURL を ZIP へ詰めるために生バイトへ戻す用途で使う。
 * カンマ以降の base64 部分のみを取り出し、`atob` で 1 バイトずつデコードする。
 *
 * Args:
 *     dataUrl (string): base64 エンコードされた dataURL。
 *
 * Returns:
 *     Uint8Array: デコード後のバイト列。
 */
export default function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
