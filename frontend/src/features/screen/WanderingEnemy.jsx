import { useEffect } from 'react';
import { useSpriteAnimation } from '../../hooks/useSpriteAnimation.js';
import { getEnemyFramePath } from '../battle/enemy/enemySpritePath.js';
import enemiesData from '../../data/enemies.json';
import useWanderMotion from './useWanderMotion.js';
import styles from './WanderingEnemy.module.css';

/* 敵 ID から定義（コマ数・コマ送り速度）を引く表。 */
const ENEMY_BY_ID = Object.fromEntries(
  enemiesData.enemies.map((enemy) => [enemy.id, enemy]),
);

/**
 * 集計スクリーンの草原を、敵キャラがうろうろ歩き回る演出。
 *
 * 敵には歩行アニメが無いので、待機（idle）アニメを流したまま、歩いて
 * いる間だけぴょこぴょこ跳ねさせて「歩いている」ように見せる。敵の
 * 画像は左向きなので、右へ歩くときは左右反転する。動きは
 * `useWanderMotion` にまかせる。
 *
 * Args:
 *     props (object): React プロパティ。
 *         enemyId (string): `enemies.json` の敵 ID。
 *         heightVh (number): 表示する高さ（vh）。
 *         initialX (number): 最初に立っている位置（vw）。
 *         speedVwPerSec (number): 歩く速さ（vw / 秒）。
 *
 * Returns:
 *     JSX.Element: 歩き回る敵。
 */
function WanderingEnemy({ enemyId, heightVh, initialX, speedVwPerSec }) {
  const motion = useWanderMotion(initialX, speedVwPerSec);
  const animation = ENEMY_BY_ID[enemyId].animations.idle;
  const { frameIndex } = useSpriteAnimation({
    frameCount: animation.frameCount,
    frameDurationMs: animation.frameDurationMs,
    loop: true,
  });

  /* コマ送りでチラつかないよう、全コマを先読みしておく。 */
  useEffect(() => {
    for (let i = 0; i < animation.frameCount; i += 1) {
      const img = new Image();
      img.src = getEnemyFramePath(enemyId, 'idle', i);
    }
  }, [enemyId, animation.frameCount]);

  const isWalking = motion.direction !== 'idle';

  return (
    <div
      className={styles.track}
      style={{
        transform: `translateX(${motion.x}vw)`,
        transitionDuration: `${motion.durationMs}ms`,
      }}
      aria-hidden="true"
    >
      <div className={styles.shadow} />
      <div className={isWalking ? `${styles.body} ${styles.hopping}` : styles.body}>
        <img
          className={
            motion.direction === 'right'
              ? `${styles.sprite} ${styles.flipped}`
              : styles.sprite
          }
          style={{ height: `${heightVh}vh` }}
          src={getEnemyFramePath(enemyId, 'idle', frameIndex)}
          alt=""
          draggable={false}
        />
      </div>
    </div>
  );
}

export default WanderingEnemy;
