/**
 * プレイヤースプライト画像の公開 URL を組み立てる。
 *
 * プロジェクト共通の命名規則
 *   `/sprites/hero/<状態>/hero_<状態>_<NN>.png`
 * に従ってパスを生成する。`<状態>` は `idle` / `up` / `down` /
 * `left` / `right` のいずれか。連番 `NN` は 2 桁ゼロ埋めで、
 * フレーム数が 100 以上になった場合のみ 3 桁に拡張する。
 * 命名規則の唯一の実装場所であり、アプリ内で他のコードに
 * パス組み立てロジックを書かせないための関数。
 *
 * Args:
 *     state (string): アニメーション状態名。`idle` / `up` /
 *         `down` / `left` / `right` のいずれか。
 *     frameIndex (number): 0 始まりのフレーム番号。
 *
 * Returns:
 *     string: スプライト画像の公開 URL 文字列。
 */
export function getHeroFramePath(state, frameIndex) {
  const paddingLength = frameIndex >= 100 ? 3 : 2;
  const frame = String(frameIndex).padStart(paddingLength, '0');
  return `/sprites/hero/${state}/hero_${state}_${frame}.png`;
}
