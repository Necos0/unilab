import stagesData from '../../../data/stages.json';
import config from '../data/lanebattle_config.json';
import { rosterIds } from './deriveUnitDef';

/*
 * roster のキャラ id → 本編での初出ステージ id の逆引き表．
 * stages.json の各ステージ enemyId（stage→enemy）を反転して作る．JSON は
 * 1-1,1-2,… の昇順なので，同じ敵が複数に出ても最初＝初出を採る．ここに
 * 現れない id（mecha_dragon 等）は「初出ステージ無し」＝常に解放扱い．
 */
const STAGE_BY_UNIT = (() => {
  const map = {};
  const stages = stagesData.stages ?? {};
  for (const [stageId, stage] of Object.entries(stages)) {
    if (!/^[1-5]-[1-4]$/.test(stageId)) continue;
    const enemyId = stage?.enemyId;
    if (enemyId && !(enemyId in map)) map[enemyId] = stageId;
  }
  return map;
})();

/**
 * ロスターキャラの「初出ステージ id」を返す（要件1）．
 *
 * stages.json の enemyId に現れないキャラ（mecha_dragon 等）は null を返し，
 * 常に解放扱いとする．
 *
 * Args:
 *     unitId (string): ロスターのキャラ id．
 *
 * Returns:
 *     string | null: 初出ステージ id（例 '1-2'）．無ければ null．
 */
export function requiredStageFor(unitId) {
  return STAGE_BY_UNIT[unitId] ?? null;
}

/**
 * ロスターキャラ1体が解放済みかを返す（要件1・4）．
 *
 * 初出ステージが無い（null）なら常に true．それ以外はそのステージが
 * clearedStageIds に含まれていれば true．
 *
 * Args:
 *     unitId (string): ロスターのキャラ id．
 *     clearedStageIds (string[]): クリア済みステージ id の配列．
 *
 * Returns:
 *     boolean: 解放済みなら true．
 */
export function isUnitUnlocked(unitId, clearedStageIds) {
  const stage = STAGE_BY_UNIT[unitId];
  if (!stage) return true;
  return clearedStageIds.includes(stage);
}

/**
 * 解放済みのロスター id 配列を返す（☆×1 CPU プール・UI 用．要件4・6）．
 *
 * Args:
 *     clearedStageIds (string[]): クリア済みステージ id の配列．
 *
 * Returns:
 *     string[]: 解放済みのロスター id．
 */
export function unlockedRosterIds(clearedStageIds) {
  return rosterIds().filter((id) => isUnitUnlocked(id, clearedStageIds));
}

/**
 * 難易度（star1/star2/star3）が解放済みかを返す（要件5）．
 *
 * `config.cpu.difficultyUnlock[key]` が null（常時解放）か，その指定
 * ステージが clearedStageIds に含まれていれば true．未定義時も true に
 * フォールバックする（config 拡張前でも壊れないように）．
 *
 * Args:
 *     key (string): 'star1' / 'star2' / 'star3'．
 *     clearedStageIds (string[]): クリア済みステージ id の配列．
 *
 * Returns:
 *     boolean: 解放済みなら true．
 */
export function isDifficultyUnlocked(key, clearedStageIds) {
  const gate = config.cpu.difficultyUnlock?.[key] ?? null;
  if (!gate) return true;
  return clearedStageIds.includes(gate);
}
