import { useEffect, useState } from 'react';

/* 歩ける範囲（画面左端からの位置、vw）。 */
const MIN_X_VW = 6;
const MAX_X_VW = 92;

/* 1 回に歩く距離の範囲（vw）。短めにして「ちょこちょこ」歩かせる。 */
const MIN_STEP_VW = 8;
const MAX_STEP_VW = 28;

/* 立ち止まる時間の範囲（ミリ秒）。 */
const MIN_IDLE_MS = 1200;
const MAX_IDLE_MS = 3500;

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
 * 今いる位置から、次に歩いていく位置を決める。
 *
 * 左右どちらかへ `MIN_STEP_VW`〜`MAX_STEP_VW` だけ進む。端に近くて
 * はみ出す向きしか選べないときは、反対向きに歩かせる。
 *
 * Args:
 *     currentX (number): 今の位置（vw）。
 *
 * Returns:
 *     number: 次の目的地（vw）。
 */
function pickNextX(currentX) {
  const step = randomBetween(MIN_STEP_VW, MAX_STEP_VW);
  const canGoLeft = currentX - step >= MIN_X_VW;
  const canGoRight = currentX + step <= MAX_X_VW;
  const isGoingRight = canGoLeft && canGoRight ? Math.random() < 0.5 : canGoRight;
  return isGoingRight ? currentX + step : currentX - step;
}

/**
 * 「少し歩く → 立ち止まる」をランダムにくり返す横移動を作るフック。
 *
 * 返す `x` と `durationMs` を CSS の `transform` と `transition-duration`
 * に渡すと、目的地まで等速で動く。`direction` は歩いている向き
 * （止まっている間は `'idle'`）で、スプライトの切り替えに使う。
 * 最初の 1 歩は少しずらして始め、複数のキャラが同時に動き出さない
 * ようにする。
 *
 * Args:
 *     initialX (number): 最初に立っている位置（vw）。
 *     speedVwPerSec (number): 歩く速さ（vw / 秒）。
 *
 * Returns:
 *     {x: number, direction: 'idle' | 'left' | 'right', durationMs: number}:
 *         今の目的地・向き・目的地までの移動時間。
 */
function useWanderMotion(initialX, speedVwPerSec) {
  const [motion, setMotion] = useState({
    x: initialX,
    direction: 'idle',
    durationMs: 0,
  });

  useEffect(() => {
    let timerId;
    let currentX = initialX;

    const rest = () => {
      setMotion({ x: currentX, direction: 'idle', durationMs: 0 });
      timerId = setTimeout(walk, randomBetween(MIN_IDLE_MS, MAX_IDLE_MS));
    };

    const walk = () => {
      const nextX = pickNextX(currentX);
      const durationMs = (Math.abs(nextX - currentX) / speedVwPerSec) * 1000;
      setMotion({
        x: nextX,
        direction: nextX > currentX ? 'right' : 'left',
        durationMs,
      });
      currentX = nextX;
      timerId = setTimeout(rest, durationMs);
    };

    timerId = setTimeout(walk, randomBetween(0, MAX_IDLE_MS));
    return () => clearTimeout(timerId);
  }, [initialX, speedVwPerSec]);

  return motion;
}

export default useWanderMotion;
