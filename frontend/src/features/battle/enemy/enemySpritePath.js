/**
 * 敵スプライト画像の公開 URL を組み立てる。
 *
 * プロジェクト共通の命名規則
 *   `/sprites/enemies/<敵ID>/<状態>/<敵ID>_<状態>_<NN>.png`
 * に従ってパスを生成する。連番 `NN` は 2 桁ゼロ埋めで、
 * フレーム数が 100 以上になった場合のみ 3 桁に拡張する。
 * 命名規則の唯一の実装場所であり、アプリ内で他のコードに
 * パス組み立てロジックを書かせないための関数。
 *
 * Args:
 *     enemyId (string): 敵識別子。例: `"slime"`。
 *     state (string): アニメーション状態名。例: `"idle"`。
 *     frameIndex (number): 0 始まりのフレーム番号。
 *
 * Returns:
 *     string: スプライト画像の公開 URL 文字列。
 */
export function getEnemyFramePath(enemyId, state, frameIndex) {
  const paddingLength = frameIndex >= 100 ? 3 : 2;
  const frame = String(frameIndex).padStart(paddingLength, '0');
  return `/sprites/enemies/${enemyId}/${state}/${enemyId}_${state}_${frame}.png`;
}
