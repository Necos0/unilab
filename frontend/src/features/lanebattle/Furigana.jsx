/*
 * `漢字《ふりがな》` 記法を検出してルビ（<ruby>）に変換する正規表現。
 * 本編の `tokenizeFurigana` と同じ記法だが、ミニゲームを隔離するため
 * 依存せず feature 内に最小実装で持つ。
 */
const FURIGANA_PATTERN = /([一-鿿々]+)《([^》]+)》/g;

/**
 * `漢字《ふりがな》` 記法の文字列を、ルビ付きで表示するコンポーネント。
 *
 * 小学5年生向けに、漢字へふりがな（ルビ）を振るための表示部品。地の文は
 * そのまま、`漢字《よみ》` の部分だけ `<ruby>漢字<rt>よみ</rt></ruby>` にする。
 * 記法を含まない文字列（ひらがな・カタカナのみ等）はそのまま表示する。
 *
 * Args:
 *     props (object):
 *         text (string): 表示する文字列（`漢字《よみ》` を含んでよい）。
 *
 * Returns:
 *     JSX.Element: ルビ付きテキスト。
 */
export default function Furigana({ text }) {
  if (!text) return null;
  const nodes = [];
  let last = 0;
  let key = 0;
  const re = new RegExp(FURIGANA_PATTERN);
  let m = re.exec(text);
  while (m) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      <ruby key={key}>
        {m[1]}
        <rt>{m[2]}</rt>
      </ruby>,
    );
    key += 1;
    last = m.index + m[0].length;
    m = re.exec(text);
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}
