import { useEffect, useState } from 'react';
import styles from './ShootingStar.module.css';

/* 流れ星を流す間隔（ミリ秒）。15 分に 1 回。 */
const SHOOTING_STAR_INTERVAL_MS = 15 * 60 * 1000;

/* 流れはじめる位置の範囲（vw / vh）。星空の上のほう。 */
const START_MIN_X_VW = 15;
const START_MAX_X_VW = 85;
const START_MIN_Y_VH = 4;
const START_MAX_Y_VH = 22;

/**
 * min 以上 max 未満のランダムな数を返す。
 *
 * Args:
 *     min (number): 下限。
 *     max (number): 上限。
 *
 * Returns:
 *     number: ランダムな数。
 */
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * 15 分に 1 回、夜空に流れ星を流す演出。
 *
 * 画面を開いてから `SHOOTING_STAR_INTERVAL_MS` ごとに 1 本流す。
 * 流れはじめる位置と向き（左下へ／右下へ）は毎回ランダム。CSS
 * アニメーションでななめに走らせ、終わったら（`animationend`）消す。
 *
 * Returns:
 *     JSX.Element | null: 流れている間は流れ星、それ以外は null。
 */
function ShootingStar() {
  const [star, setStar] = useState(null);

  useEffect(() => {
    const timerId = setInterval(() => {
      setStar({
        id: Date.now(),
        xVw: randomBetween(START_MIN_X_VW, START_MAX_X_VW),
        yVh: randomBetween(START_MIN_Y_VH, START_MAX_Y_VH),
        isGoingRight: Math.random() < 0.5,
      });
    }, SHOOTING_STAR_INTERVAL_MS);
    return () => clearInterval(timerId);
  }, []);

  if (!star) return null;

  return (
    <div
      key={star.id}
      className={styles.anchor}
      style={{ left: `${star.xVw}vw`, top: `${star.yVh}vh` }}
      aria-hidden="true"
    >
      <div
        className={star.isGoingRight ? `${styles.star} ${styles.toRight}` : styles.star}
        onAnimationEnd={() => setStar(null)}
      />
    </div>
  );
}

export default ShootingStar;
