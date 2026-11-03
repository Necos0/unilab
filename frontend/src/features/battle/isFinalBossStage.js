/*
 * 最終ボス（ステージ5の前の勇者）のステージ ID。ゲーム全体の最後の戦いで、
 * 通常のボス演出（`isBossStage`）よりさらに大がかりな専用の入場演出を出す。
 */
const FINAL_BOSS_STAGE_ID = '5-4';

/**
 * ステージ ID が最終ボス戦（5-4、黒いフローチャートに操られた勇者）かを
 * 判定する。
 *
 * エンカウント演出（`BattleTransition`）とバトル入場演出（`BattleScreen`
 * の `finalOmen` フェーズ・最終ボス版バナー）を、通常のボス演出から
 * 最終ボス専用の演出に切り替える判定に使う。最終ボスは `isBossStage` も
 * true（*-4）なので、呼び出し側はこちらを先に判定する。
 *
 * Args:
 *     stageId (string): ステージ ID（`"<world>-<number>"` 形式）。
 *
 * Returns:
 *     boolean: 最終ボス戦なら true。
 */
function isFinalBossStage(stageId) {
  return stageId === FINAL_BOSS_STAGE_ID;
}

export default isFinalBossStage;
