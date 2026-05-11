/**
 * ステージ ID 文字列を `world` と `number` に分解する純関数。
 *
 * `stages.json` のキー命名規約 `"<world>-<number>"`（例 `"1-2"`）を前提に、
 * 文字列を `{ world: "1", number: 2 }` に分解して返す。番号部分は数値型
 * に変換して返すため、隣接ステージの判定（番号 +1）が四則演算で行える。
 * `world` 側は将来「2-1」「demo-3」のような複数体系にも耐えるよう
 * 文字列のままに保つ（数値変換しない）。
 *
 * 形式不一致（`null` 渡し・空文字・ハイフン抜け等）はすべて `null` を
 * 返す。呼び出し側は受け取った値が `null` のときに早期リターンする
 * 想定で、内部的に例外は投げない。
 *
 * Args:
 *     stageId (string): ステージ ID。`"<world>-<number>"` 形式。
 *
 * Returns:
 *     {world: string, number: number} | null: 分解結果。フォーマット
 *         不一致または非文字列なら `null`。
 */
function parseStageId(stageId) {
  if (typeof stageId !== 'string') {
    return null;
  }
  const match = /^(\w+)-(\d+)$/.exec(stageId);
  if (!match) {
    return null;
  }
  return { world: match[1], number: Number(match[2]) };
}

export default parseStageId;
