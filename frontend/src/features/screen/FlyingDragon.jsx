import { useEffect, useState } from 'react';
import { useSpriteAnimation } from '../../hooks/useSpriteAnimation.js';
import styles from './FlyingDragon.module.css';

/* 羽ばたきアニメのコマ数と 1 コマの表示時間（元 GIF と同じ 130ms）。 */
const DRAGON_ANIMATION = { frameCount: 8, frameDurationMs: 130 };

/**
 * 羽ばたきアニメの 1 コマの画像 URL を返す。
 *
 * 命名規則 `/sprites/flying_dragon/fly/flying_dragon_fly_<NN>.png` に従う。
 *
 * Args:
 *     frameIndex (number): 0 始まりのコマ番号。
 *
 * Returns:
 *     string: 画像の公開 URL。
 */
function getDragonFramePath(frameIndex) {
  const frame = String(frameIndex).padStart(2, '0');
  return `/sprites/flying_dragon/fly/flying_dragon_fly_${frame}.png`;
}

/* 画面を開いてから最初に飛んでくるまでの時間の範囲（ミリ秒）。 */
const FIRST_FLIGHT_MIN_MS = 10_000;
const FIRST_FLIGHT_MAX_MS = 25_000;

/* 飛び去ってから次に飛んでくるまでの時間の範囲（ミリ秒）。 */
const NEXT_FLIGHT_MIN_MS = 45_000;
const NEXT_FLIGHT_MAX_MS = 90_000;

/* 画面を横切るのにかける時間の範囲（ミリ秒）。 */
const FLIGHT_MIN_MS = 9_000;
const FLIGHT_MAX_MS = 13_000;

/* 飛ぶ高さの範囲（画面上端からの位置、vh）。星空の帯の中。 */
const FLIGHT_MIN_TOP_VH = 8;
const FLIGHT_MAX_TOP_VH = 38;

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
 * ときどきドラゴンが夜空を横切って飛んでいく演出。
 *
 * 最初は `FIRST_FLIGHT_*`、以降は飛び去るたびに `NEXT_FLIGHT_*` の
 * ランダムな間隔で 1 回ずつ飛んでくる。向き（左→右／右→左）と高さ・
 * 速さは毎回ランダム。横移動は CSS アニメーションで画面の外から外へ
 * 動かし、羽ばたきアニメ（`flying_dragon/fly`）を流しながら上下に
 * ゆったり波打たせる。終わったら（`animationend`）
 * 消して次の予約をする。ドラゴンの画像は左向きなので、左→右に飛ぶ
 * ときは左右反転する。
 *
 * Returns:
 *     JSX.Element | null: 飛んでいる間はドラゴン、それ以外は null。
 */
function FlyingDragon() {
  const [flight, setFlight] = useState(null);
  const [flightCount, setFlightCount] = useState(0);

  const { frameIndex } = useSpriteAnimation({
    frameCount: DRAGON_ANIMATION.frameCount,
    frameDurationMs: DRAGON_ANIMATION.frameDurationMs,
    loop: true,
  });

  /* 羽ばたきのコマでチラつかないよう、全コマを先読みしておく。 */
  useEffect(() => {
    for (let i = 0; i < DRAGON_ANIMATION.frameCount; i += 1) {
      const img = new Image();
      img.src = getDragonFramePath(i);
    }
  }, []);

  /* 飛んでいないときだけ、次に飛んでくるまでのタイマーを張る。 */
  useEffect(() => {
    if (flight) return undefined;
    const delayMs =
      flightCount === 0
        ? randomBetween(FIRST_FLIGHT_MIN_MS, FIRST_FLIGHT_MAX_MS)
        : randomBetween(NEXT_FLIGHT_MIN_MS, NEXT_FLIGHT_MAX_MS);
    const timerId = setTimeout(() => {
      setFlight({
        isGoingRight: Math.random() < 0.5,
        topVh: randomBetween(FLIGHT_MIN_TOP_VH, FLIGHT_MAX_TOP_VH),
        durationMs: randomBetween(FLIGHT_MIN_MS, FLIGHT_MAX_MS),
      });
    }, delayMs);
    return () => clearTimeout(timerId);
  }, [flight, flightCount]);

  if (!flight) return null;

  /* 横切り終えたら消して、次の予約へ回す。 */
  const handleFlightEnd = (event) => {
    if (event.target !== event.currentTarget) return;
    setFlight(null);
    setFlightCount((count) => count + 1);
  };

  return (
    <div
      className={flight.isGoingRight ? styles.flyRight : styles.flyLeft}
      style={{
        top: `${flight.topVh}vh`,
        animationDuration: `${flight.durationMs}ms`,
      }}
      onAnimationEnd={handleFlightEnd}
      aria-hidden="true"
    >
      <div className={styles.wave}>
        <img
          className={
            flight.isGoingRight ? `${styles.sprite} ${styles.flipped}` : styles.sprite
          }
          src={getDragonFramePath(frameIndex)}
          alt=""
          draggable={false}
        />
      </div>
    </div>
  );
}

export default FlyingDragon;
