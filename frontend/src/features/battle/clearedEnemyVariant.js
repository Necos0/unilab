import useProgressStore from '../../stores/progressStore.js';

/*
 * クリア後に再挑戦すると見た目が変わるステージと、そのときの敵 ID。
 * 5-4 は倒すと勇者から魔気がぬけるので、クリア後は元に戻った勇者
 * （`purified_hero`）として出す。盤面（HP・カード・フロー）は同じまま。
 */
const CLEARED_ENEMY_VARIANTS = {
  '5-4': 'purified_hero',
};

/**
 * クリア済みのステージなら、クリア後の見た目の敵 ID を返す。
 *
 * Args:
 *     stageId (string): ステージ ID。
 *
 * Returns:
 *     string | null: クリア済みで差し替え先があればその敵 ID、
 *         なければ null（ステージ本来の敵をそのまま使う）。
 */
export function getClearedVariantEnemyId(stageId) {
  const variantId = CLEARED_ENEMY_VARIANTS[stageId];
  if (!variantId) return null;
  const isCleared = useProgressStore.getState().clearedStageIds.includes(stageId);
  return isCleared ? variantId : null;
}
