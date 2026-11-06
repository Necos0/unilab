import { useEffect, useState } from 'react';
import { useSpriteAnimation } from '../../hooks/useSpriteAnimation.js';
import { getHeroFramePath } from '../map/heroSpritePath.js';
import playerData from '../../data/player.json';
import useWanderMotion from './useWanderMotion.js';
import styles from './WalkingHero.module.css';

/* 最初に立っている位置（vw）。 */
const INITIAL_X_VW = 14;

/* 歩く速さ（vw / 秒）。 */
const WALK_SPEED_VW_PER_SEC = 5;

/* ゲームと同じ勇者スプライトの設定（状態ごとのコマ数・コマ送り速度）。 */
const HERO_ANIMATIONS = playerData.sprite.animations;

/* 使う状態（立ち止まり・左向き歩き・右向き歩き）。 */
const USED_STATES = ['idle', 'left', 'right'];

/* ビット（フローチャートロボ）の画像。マップと同じもの。 */
const ROBO_SRC = '/sprites/robo/robo.png';

/**
 * 集計スクリーンの下の草原を、勇者がちょこちょこ歩き回る演出。
 *
 * 動き（「少し歩く → 立ち止まる」のくり返し）は `useWanderMotion` に
 * まかせ、歩いている間は進む向きの歩行アニメ、止まっている間は待機
 * アニメをゲームと同じスプライトで再生する。状態ごとに画像の縦横比が
 * 違うので、共通の枠に下端そろえで収め、足元の高さがぶれないように
 * する。マップと同じく、相棒のビットが勇者の斜め上にふわふわ浮かんで
 * ついてくる。ビットは進む向きの反対側（後ろ）に回り、止まっている
 * 間は最後にいた側にとどまる。
 *
 * Returns:
 *     JSX.Element: 歩く勇者とビット。
 */
function WalkingHero() {
  const motion = useWanderMotion(INITIAL_X_VW, WALK_SPEED_VW_PER_SEC);
  const spriteState = motion.direction;

  /*
   * ビットがいる側。歩き出したら進む向きの反対側へ回る。止まっている
   * 間は変えない（レンダー中に前回の値と比べて更新する React の定石）。
   */
  const [roboSide, setRoboSide] = useState('left');
  const trailingSide =
    motion.direction === 'right' ? 'left' : motion.direction === 'left' ? 'right' : null;
  if (trailingSide !== null && trailingSide !== roboSide) {
    setRoboSide(trailingSide);
  }

  const animation = HERO_ANIMATIONS[spriteState];
  const { frameIndex } = useSpriteAnimation({
    frameCount: animation.frameCount,
    frameDurationMs: animation.frameDurationMs,
    loop: animation.loop,
  });

  /* 状態が切り替わった瞬間にチラつかないよう、全コマを先読みしておく。 */
  useEffect(() => {
    USED_STATES.forEach((state) => {
      for (let i = 0; i < HERO_ANIMATIONS[state].frameCount; i += 1) {
        const img = new Image();
        img.src = getHeroFramePath(state, i);
      }
    });
  }, []);

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
      <img
        className={styles.sprite}
        src={getHeroFramePath(spriteState, frameIndex)}
        alt=""
        draggable={false}
      />
      <div
        className={
          roboSide === 'left'
            ? `${styles.robo} ${styles.roboLeft}`
            : `${styles.robo} ${styles.roboRight}`
        }
      >
        <img className={styles.roboImage} src={ROBO_SRC} alt="" draggable={false} />
      </div>
    </div>
  );
}

export default WalkingHero;
