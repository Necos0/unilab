/**
 * スプライト連番の命名規則に沿ったファイル名を組み立てる。
 *
 * プロジェクトの命名規則 `<ID>_<状態>_<2桁ゼロ埋め連番>.png` に従う
 * （例: `slime_idle_00.png`）。連番が 100 以上になった場合は桁が自然に
 * 増える（`padStart(2, '0')` のため最低 2 桁を保証する）。
 *
 * Args:
 *     name (string): キャラクター ID（例: `slime`）。
 *     state (string): 状態（`idle` または `dead`）。
 *     index (number): 0 始まりのフレーム連番。
 *
 * Returns:
 *     string: 命名規則に沿った PNG ファイル名。
 */
export default function buildSpriteFileName(name, state, index) {
  const padded = String(index).padStart(2, '0');
  return `${name}_${state}_${padded}.png`;
}
