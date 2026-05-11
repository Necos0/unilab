import parseStageId from './parseStageId';

/**
 * 同ワールド内で番号が 1 大きい次ステージ ID を返す純関数。
 *
 * `parseStageId(stageId)` で現 ID を分解し、`<world>-<number+1>` を組み立てて
 * `stagesData.stages` 配下に存在するかをチェックする。存在すれば次ステージ
 * の ID 文字列を返し、存在しなければ `null` を返す（最終ステージのクリア時
 * に何も解放しないという挙動：要件 4-2）。`stageId` のフォーマットが不正
 * （`parseStageId` が `null` を返す）の場合も `null`。
 *
 * Args:
 *     stagesData (object): `stages.json` をそのまま import したオブジェクト。
 *         `stages` キー配下にステージ ID をキーとした連想配列を持つ。
 *     stageId (string): 現ステージ ID。
 *
 * Returns:
 *     string | null: 次ステージ ID。存在しなければ `null`。
 */
function getNextStageId(stagesData, stageId) {
  const parsed = parseStageId(stageId);
  if (!parsed) {
    return null;
  }
  const nextId = `${parsed.world}-${parsed.number + 1}`;
  if (!stagesData?.stages?.[nextId]) {
    return null;
  }
  return nextId;
}

export default getNextStageId;
