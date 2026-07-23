import { useEffect, useRef, useState } from 'react';
import styles from './RoboSprite.module.css';

const ROBO_SRC = '/sprites/robo/robo.png';

// ロボの表示サイズ（SVG 単位）。勇者（130）の半分程度の相棒サイズにする。
const ROBO_SIZE = 64;
// 勇者の足元基準点からのオフセット。X は勇者に近い側のロボ端までの水平
// 距離、Y はロボ上端までの距離で、勇者の斜め上、頭より少し高い位置に
// 浮かせる（左右どちらの側に置くかは歩行方向から決める）。
const ROBO_OFFSET_X = 24;
const ROBO_OFFSET_Y = 148;
// 勇者と同じカラーグレーディング（PlayerSprite.jsx と揃える）。塗りの
// マップ背景に対するピクセルアートの「浮き」を抑える。
const SPRITE_COLOR_GRADE = 'saturate(0.92) brightness(0.97)';
// 慣性追従の時定数（ms）。目標位置との距離がこの時間で約 63% 縮まる。
// 大きくするほど「ゆっくり遅れてついてくる」動きになる。
const FOLLOW_TAU_MS = 180;
// 目標との距離がこれ未満になったら目標へスナップして再レンダーを止める。
const SNAP_EPSILON = 0.5;
// 目標がこれ以上離れていたら追従せず即座にワープする（マップ切り替えなど、
// 画面を横切って滑空してしまうケースの回避）。
const TELEPORT_DISTANCE = 400;

/**
 * マップ上で勇者の斜め上に浮遊するフローチャートロボのスプライト。
 *
 * `PlayerSprite` から勇者の足元座標と歩行方向を受け取り、その斜め上を
 * 目標位置として SVG `<image>` を描画する。定位置は進行方向の反対側
 * （右へ歩くときは左上、左へ歩くときは右上）に切り替え、慣性で遅れた
 * ロボが勇者の顔の上を横切らないようにする。上下移動・静止中は直前の
 * 側を維持する。目標位置へは即座に張り付かず、
 * `requestAnimationFrame` ループで毎フレーム指数補間（時定数
 * `FOLLOW_TAU_MS`）して近づけることで、勇者の移動に少し遅れてついてくる
 * 慣性のある飛行を表現する。目標に十分近づいたら（`SNAP_EPSILON`）目標へ
 * スナップして setState を止め、静止中の無駄な再レンダーを避ける。
 * マップ切り替えなどで目標が大きく飛んだ場合（`TELEPORT_DISTANCE` 超）は
 * 画面を横切る滑空をせず即座にワープする。
 * 飛行キャラクターなので接地シャドウは敷かず、CSS アニメーション
 * （`RoboSprite.module.css` の上下バウンス）でふわふわ感を出す。
 *
 * Args:
 *     props (object): React プロパティ。
 *         x (number): 勇者の足元 X（SVG 論理座標。`PlayerSprite` と同じ基準）。
 *         y (number): 勇者の足元 Y（同上）。
 *         directionState (string): 勇者の歩行方向
 *             （`idle` / `up` / `down` / `left` / `right`）。
 *
 * Returns:
 *     JSX.Element: 浮遊アニメーション付きの `<g>` 要素。
 */
function RoboSprite({ x, y, directionState }) {
  /*
   * ロボを置く側。`left` なら勇者の左上、`right` なら右上。横移動の間だけ
   * 進行方向の反対側へ更新し、上下移動・静止中は直前の側を保つ（レンダー中の
   * 条件付き setState で prop 変化に追随する React 公式パターン）。
   */
  const [side, setSide] = useState('left');
  const oppositeSide =
    directionState === 'left'
      ? 'right'
      : directionState === 'right'
        ? 'left'
        : null;
  if (oppositeSide !== null && oppositeSide !== side) {
    setSide(oppositeSide);
  }

  const targetX =
    side === 'left' ? x - ROBO_OFFSET_X - ROBO_SIZE : x + ROBO_OFFSET_X;
  const targetY = y - ROBO_OFFSET_Y;

  const [pos, setPos] = useState({ x: targetX, y: targetY });
  const posRef = useRef(pos);
  const targetRef = useRef({ x: targetX, y: targetY });

  /* 最新の目標位置を rAF ループから参照できるよう ref に書き写す。 */
  useEffect(() => {
    targetRef.current = { x: targetX, y: targetY };
  }, [targetX, targetY]);

  useEffect(() => {
    let rafId = null;
    let cancelled = false;
    let lastTimestamp = null;

    /**
     * 毎フレーム現在位置を目標位置へ指数補間する内部ループ。
     *
     * フレーム間隔 `dt` に依存しない減衰率 `1 - exp(-dt / tau)` を使い、
     * リフレッシュレートが違う環境でも同じ速度感で追従させる。目標に
     * 収束済みのフレームでは setState を呼ばず、再レンダーを発生させない。
     */
    const tick = (now) => {
      if (cancelled) {
        return;
      }
      if (lastTimestamp === null) {
        lastTimestamp = now;
      }
      const dt = now - lastTimestamp;
      lastTimestamp = now;

      const current = posRef.current;
      const target = targetRef.current;
      const distance = Math.hypot(target.x - current.x, target.y - current.y);

      if (distance >= SNAP_EPSILON) {
        let next;
        if (distance > TELEPORT_DISTANCE) {
          next = { x: target.x, y: target.y };
        } else {
          const alpha = 1 - Math.exp(-dt / FOLLOW_TAU_MS);
          next = {
            x: current.x + (target.x - current.x) * alpha,
            y: current.y + (target.y - current.y) * alpha,
          };
        }
        posRef.current = next;
        setPos(next);
      } else if (current.x !== target.x || current.y !== target.y) {
        posRef.current = { x: target.x, y: target.y };
        setPos(posRef.current);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return (
    <g className={styles.float} pointerEvents="none">
      <image
        href={ROBO_SRC}
        x={pos.x}
        y={pos.y}
        width={ROBO_SIZE}
        height={ROBO_SIZE}
        preserveAspectRatio="xMidYMid meet"
        style={{ imageRendering: 'pixelated', filter: SPRITE_COLOR_GRADE }}
      />
    </g>
  );
}

export default RoboSprite;
