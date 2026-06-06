/**
 * 入力された名前をキャラクター ID（snake_case）に正規化する。
 *
 * 命名規則では JSON データ・アセットの ID は snake_case を用いるため、
 * 前後の空白を除き、小文字化し、空白・連続区切り文字をアンダースコア 1 つに
 * まとめ、英数字とアンダースコア以外を取り除く。先頭・末尾のアンダースコアも
 * 落とす。結果が空になることもある（呼び出し側で未入力として扱う）。
 *
 * Args:
 *     raw (string): ユーザーが入力した名前。
 *
 * Returns:
 *     string: snake_case に正規化した ID。
 */
export default function sanitizeId(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
}
