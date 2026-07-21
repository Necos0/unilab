/**
 * 配列の要素をランダムな順に並べ替えた新しい配列を返す純関数。
 *
 * Fisher–Yates 法で偏りなくシャッフルする。引数の配列は変更せず、
 * コピーに対して並べ替えを行う（カードあわせの盤面生成で使う）。
 *
 * Args:
 *     items (Array): 並べ替える配列。
 *
 * Returns:
 *     Array: 同じ要素をランダムな順に並べた新しい配列。
 */
function shuffleArray(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default shuffleArray;
