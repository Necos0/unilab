import { useEffect, useState } from 'react';
import styles from './EnemySprite.module.css';
import enemiesData from '../../../data/enemies.json';
import { getEnemyFramePath } from './enemySpritePath';
import { useSpriteAnimation } from './useSpriteAnimation';
import useBattleStore from '../../../stores/battleStore';

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
 * 攻撃ヒット演出として `battleStore.enemyDamageEvents` 末尾の id を購読し、
 * 新しいダメージイベントが入ったタイミングで `<img>` に `.flashing`
 * クラスを 1 ショット付与する。CSS の `@keyframes enemyFlash` が
 * `filter: brightness/saturate` でスプライトを白く明滅させ、
 * `onAnimationEnd` でクラスを外す。位置・サイズ・idle のフレーム
 * 切り替えには影響しない（演出は重ね描き）。
 *
 * 勝利演出への連動として `battleStore.victoryPhase` を購読し、
 * `'fading'` または `'cleared'` のとき `<img>` に `.fading` クラスを
 * 付与して `opacity: 0` へ 0.5 秒のトランジションをかける。
 * `'fading'` 中はフェードが進行し、`'cleared'` では透明のまま固定される
 * （`victory-clear` 要件 3）。dead 状態への切替（`state="dead"`）の
 * 判断は親（`BattleScreen`）側で行い、本コンポーネントは渡された
 * `state` プロップに従って描画する責務に限定する。`.flashing` は
 * `filter`、`.fading` は `opacity` で別プロパティのため、両方が同時に
 * 当たっても干渉しない。
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

  const lastDamageId = useBattleStore(
    (s) => s.enemyDamageEvents[s.enemyDamageEvents.length -1]?.id ?? null,
  );
  const [consumedDamageId, setConsumedDamageId] = useState(null);
  const isFlashing = lastDamageId !== null && lastDamageId !== consumedDamageId;
  const victoryPhase = useBattleStore((s) => s.victoryPhase);
  const isFading = victoryPhase === 'fading' || victoryPhase === 'cleared';

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
        className={`${styles.sprite} ${isFlashing ? styles.flashing : ''} ${isFading ? styles.fading : ''}`}
        onAnimationEnd={() => setConsumedDamageId(lastDamageId)}
        src={src}
        alt={enemy.displayName}
        draggable={false}
      />
    </div>
  );
}

export default EnemySprite;
