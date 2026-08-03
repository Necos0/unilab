/**
 * 6 枚デッキ・手札 3 枚のローテーション制御を作る（要件4・9）。
 *
 * クラッシュ・ロワイヤル型のカード回転。内部に並び順のキュー（配列）を
 * 持ち、先頭 3 枚を手札、4 番目を「つぎ」とみなす。カードを出す（`play`）
 * と、そのカードはキューの最後尾へ回り、後続が手札へ繰り上がる。
 * プレイヤー・CPU の双方が同じこの関数を使う（同一ルールでの対戦）。
 *
 * Args:
 *     ids (string[]): デッキのカード ID 配列（通常 6 枚、重複なし）。
 *
 * Returns:
 *     object: 以下を持つコントローラ。
 *         hand (function): 現在の手札（先頭 3 枚）の ID 配列を返す。
 *         nextPreview (function): 「つぎ」に手札へ入るカード ID（4 番目）を返す。
 *         all (function): 現在のキュー全体のコピーを返す。
 *         play (function): index 番目のカードを出したことにして最後尾へ回し、
 *             出したカード ID を返す（範囲外なら null）。
 */
export function createDeck(ids) {
  const queue = ids.slice();

  return {
    hand: () => queue.slice(0, 3),
    nextPreview: () => queue[3] ?? null,
    all: () => queue.slice(),
    play: (index) => {
      if (index < 0 || index >= queue.length) return null;
      const [card] = queue.splice(index, 1);
      queue.push(card);
      return card;
    },
  };
}
