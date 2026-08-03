import { getEnemyFramePath } from '../battle/enemy/enemySpritePath';

/**
 * React 側（編成・手札・結果など）で静止スプライトを表示する軽量コンポーネント。
 *
 * レーン上の動くユニットはエンジンが命令的に描画する（`laneSprite`）が、
 * UI チャンクでは 1 コマだけ静止表示すれば足りるため、`getEnemyFramePath`
 * で先頭フレームの URL を組み立てて `<img>` を返すだけにする。`battleStore`
 * などには依存しない（隔離）。
 *
 * Args:
 *     props (object):
 *         id (string): キャラ ID。
 *         state (string): アニメ状態。既定 `"idle"`。
 *         frame (number): フレーム番号。既定 0。
 *         className (string, optional): 付与するクラス名。
 *         flip (boolean, optional): true で左右反転（右向き）表示。
 *
 * Returns:
 *     JSX.Element: スプライト画像。
 */
export default function LbSprite({ id, state = 'idle', frame = 0, className, flip }) {
  return (
    <img
      className={className}
      src={getEnemyFramePath(id, state, frame)}
      alt=""
      draggable={false}
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    />
  );
}
