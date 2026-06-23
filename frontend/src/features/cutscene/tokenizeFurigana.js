/*
 * `漢字《ふりがな》` 記法を検出する正規表現。
 * 連続する漢字（CJK 統合漢字 一-鿿 ＋ 繰り返し記号 々）の直後に `《よみ》` が
 * 続く部分をルビの対象とする。グローバルフラグ付きだが、`String.prototype.matchAll`
 * で都度新しいイテレータを得るため、呼び出し間で `lastIndex` の状態が持ち越される
 * ことはない。
 */
const FURIGANA_PATTERN = /([一-鿿々]+)《([^》]+)》/g;

/**
 * `漢字《ふりがな》` 記法のテキストを、表示単位（トークン）の配列へ分解する。
 *
 * 読み上げ（タイプライター）アニメーションで1単位ずつ出すために、地の文は
 * 1文字ずつ `{type: 'char'}` に、ルビ対象の `漢字《よみ》` は途中で割れないよう
 * ひとまとまりの `{type: 'ruby'}` にする。先頭から N 個のトークンだけ描画すれば、
 * ルビを壊さずに途中までの表示を作れる。
 *
 * Args:
 *     text (string): `{playerName}` 置換済みの吹き出し文言。
 *
 * Returns:
 *     Array<object>: 表示単位の配列。各要素は
 *         `{type: 'char', value: string}` または
 *         `{type: 'ruby', base: string, ruby: string}`。
 */
function tokenizeFurigana(text) {
  const tokens = [];
  let lastIndex = 0;
  for (const match of text.matchAll(FURIGANA_PATTERN)) {
    const start = match.index;
    for (const ch of text.slice(lastIndex, start)) {
      tokens.push({ type: 'char', value: ch });
    }
    tokens.push({ type: 'ruby', base: match[1], ruby: match[2] });
    lastIndex = start + match[0].length;
  }
  for (const ch of text.slice(lastIndex)) {
    tokens.push({ type: 'char', value: ch });
  }
  return tokens;
}

export default tokenizeFurigana;
