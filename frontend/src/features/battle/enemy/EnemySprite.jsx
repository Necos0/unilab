import { useEffect } from 'react';
import styles from './EnemySprite.module.css';
import enemiesData from '../../../data/enemies.json';
import { getEnemyFramePath } from './enemySpritePath';
import { useSpriteAnimation } from './useSpriteAnimation';

/**
 * 敵をスプライトアニメーションで描画する汎用コンポーネント。
 *
 * `enemies.json` から `enemyId` と `state` に対応するアニメーション
 * 定義を解決し、`useSpriteAnimation` で進行する現在フレームを
 * `getEnemyFramePath` で URL に変換して `<img>` で描画する。
 * 対象状態のフレーム群はマウント時に `new Image()` で事前読み込み
 * することで、フレーム切り替え時のチラつきを防ぐ。
 * `enemyId` または `state` が定義に存在しない場合は `null` を返し、
 * 親レイアウトを崩さない。画像は原寸で表示する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         enemyId (string): 敵識別子。
 *         state (string): アニメーション状態名。既定値 `"idle"`。
 *
 * Returns:
 *     JSX.Element | null: スプライト画像を内包する要素、または未定義時 null。
 */
function EnemySprite({ enemyId, state = 'idle' }) {
  const enemy = enemiesData.enemies.find((e) => e.id === enemyId);
  const animation = enemy?.animations?.[state];

  const { frameIndex } = useSpriteAnimation({
    frameCount: animation?.frameCount ?? 1,
    frameDurationMs: animation?.frameDurationMs ?? 1000,
    loop: animation?.loop ?? false,
  });

  useEffect(() => {
    if (!animation) return;
    for (let i = 0; i < animation.frameCount; i += 1) {
      const img = new Image();
      img.src = getEnemyFramePath(enemyId, state, i);
    }
  }, [enemyId, state, animation]);

  if (!animation) {
    return null;
  }

  const src = getEnemyFramePath(enemyId, state, frameIndex);

  return (
    <div className={styles.root}>
      <img
        className={styles.sprite}
        src={src}
        alt={enemy.displayName}
        draggable={false}
      />
    </div>
  );
}

export default EnemySprite;
