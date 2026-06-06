/**
 * CRC-32 計算用のルックアップテーブルを生成する。
 *
 * 標準多項式 0xEDB88320 で 256 要素のテーブルを 1 度だけ作る。
 *
 * Returns:
 *     Uint32Array: CRC-32 計算テーブル（256 要素）。
 */
function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

/**
 * バイト列の CRC-32 を計算する。
 *
 * Args:
 *     bytes (Uint8Array): 対象のバイト列。
 *
 * Returns:
 *     number: 符号なし 32bit の CRC-32 値。
 */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * 複数ファイルを 1 つの ZIP（ストア方式・無圧縮）にまとめて Blob で返す。
 *
 * 外部ライブラリを使わず、PKZIP 仕様（APPNOTE）に沿ってローカルファイル
 * ヘッダ・中央ディレクトリ・終端レコードを並べる。圧縮はせず method=0
 * （store）で格納するため、PNG のように既に圧縮済みのデータでもサイズは
 * ほぼ変わらず、依存追加なしで確実に取り出せる。日時は固定値 0、ファイル名
 * は UTF-8（汎用フラグ bit 11）で書き込む。`name` にスラッシュを含めると
 * 展開時にサブフォルダとして再現される。
 *
 * Args:
 *     files (Array<{name: string, data: Uint8Array}>): 格納するファイル一覧。
 *         name はスラッシュ区切りの相対パス、data は中身のバイト列。
 *
 * Returns:
 *     Blob: `application/zip` 形式の ZIP データ。
 */
export default function createZip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);

    const local = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(local);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // 展開に必要なバージョン
    lv.setUint16(6, 0x0800, true); // 汎用フラグ（UTF-8 ファイル名）
    lv.setUint16(8, 0, true); // 圧縮方式 = store
    lv.setUint16(10, 0, true); // 更新時刻
    lv.setUint16(12, 0, true); // 更新日付
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true); // 圧縮後サイズ
    lv.setUint32(22, data.length, true); // 圧縮前サイズ
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // 拡張フィールド長
    const localBytes = new Uint8Array(local);
    localBytes.set(nameBytes, 30);
    chunks.push(localBytes);
    chunks.push(data);

    const cd = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(cd);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // 作成バージョン
    cv.setUint16(6, 20, true); // 展開に必要なバージョン
    cv.setUint16(8, 0x0800, true); // 汎用フラグ
    cv.setUint16(10, 0, true); // 圧縮方式
    cv.setUint16(12, 0, true); // 更新時刻
    cv.setUint16(14, 0, true); // 更新日付
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // 拡張フィールド長
    cv.setUint16(32, 0, true); // コメント長
    cv.setUint16(34, 0, true); // 開始ディスク番号
    cv.setUint16(36, 0, true); // 内部属性
    cv.setUint32(38, 0, true); // 外部属性
    cv.setUint32(42, offset, true); // ローカルヘッダ位置
    const cdBytes = new Uint8Array(cd);
    cdBytes.set(nameBytes, 46);
    central.push(cdBytes);

    offset += localBytes.length + data.length;
  }

  const centralSize = central.reduce((sum, c) => sum + c.length, 0);
  const centralOffset = offset;

  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true); // このディスク番号
  ev.setUint16(6, 0, true); // 中央ディレクトリ開始ディスク
  ev.setUint16(8, files.length, true); // このディスクのエントリ数
  ev.setUint16(10, files.length, true); // 総エントリ数
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true); // コメント長

  return new Blob([...chunks, ...central, new Uint8Array(eocd)], {
    type: 'application/zip',
  });
}
