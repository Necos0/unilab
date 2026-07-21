import parseStageId from '../map/parseStageId';

/**
 * ステージ ID がボスステージ（各ワールドの最終ステージ）かを判定する。
 *
 * ステージ命名規約では各ワールドの 4 番目（`"1-4"` など `*-4`）がボス戦。
 * バトル入場演出（`BattleTransition` / `BattleScreen`）が、通常戦より
 * 派手なボス専用演出へ切り替える判定に使う。
 *
 * Args:
 *     stageId (string): ステージ ID（`"<world>-<number>"` 形式）。
 *
 * Returns:
 *     boolean: ボスステージなら true。形式不一致・null 等は false。
 */
function isBossStage(stageId) {
  return parseStageId(stageId)?.number === 4;
}

export default isBossStage;
