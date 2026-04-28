import { useEffect, useState } from 'react';
import useMapStore from '../../stores/mapStore';
import findNodeById from './findNodeById';

const SEGMENT_SPEED_PX_PER_MS = 0.6;

/**
 * 仮プレイヤースプライト（赤丸プレースホルダ）の描画コンポーネント。
 *
 * 本物のプレイヤースプライト画像が用意されていない段階の暫定描画。
 * アニメーションロジックから描画要素を分離する目的で別関数にして
 * あり、本番アセット差し替え時はこの関数を `<image>` ベースの実装に
 * 置き換えるだけで済む。アンカーは `(cx, cy)` がそのまま中心になる
 * ので、`getPointAtLength` の戻り値を補正なしでそのまま渡せる。
 *
 * Args:
 *     props (object): React プロパティ。
 *         x (number): SVG 論理座標の中心 X。
 *         y (number): SVG 論理座標の中心 Y。
 *
 * Returns:
 *     JSX.Element: SVG `<circle>` 要素。
 */
function PlayerPlaceholder({ x, y }) {
  return (
    <circle
      cx={x}
      cy={y}
      r={18}
      fill="#e74c3c"
      stroke="#ffffff"
      strokeWidth={3}
      pointerEvents="none"
    />
  );
}

/**
 * プレイヤーキャラクターを SVG 上に描画し、移動アニメーションを駆動する
 * コンポーネント。
 *
 * `mapStore.segments` を購読し、先頭セグメントが存在する間は
 * `requestAnimationFrame` で `<path data-edge-id>` 上の点を
 * `getPointAtLength()` で求めて座標を更新する（要件 5-1〜5-4, 6-4）。
 * セグメント完了時に `advanceSegment()` を呼び、残りセグメントが
 * あれば次の useEffect 実行で連続再生される（要件 5-5）。
 *
 * 描画位置の決定ロジック：
 *   - 静止時（`segments` 空）は `currentLocation` のランドマークの
 *     `stopPoint`（道上の停止点。アイコン位置 `position` とは別軸）を
 *     描画時に直接導出する（要件 3-2, 5-3）。effect 内で同期的に
 *     setState すると `react-hooks/set-state-in-effect` に抵触するため、
 *     静止位置は state で持たず render で導出するパターンを採る。
 *   - 移動中はアニメーション state（`animPos`）を使う。前セグメント完了時
 *     の最終位置がそのまま次セグメントの開始位置（= 新 `currentLocation`
 *     の `stopPoint`）と一致するため、フレーム間でジャンプは起こらない。
 *
 * Returns:
 *     JSX.Element | null: スプライト要素、または座標未確定時 null。
 */
function PlayerSprite() {
  const mapDef = useMapStore((state) => state.mapDef);
  const currentLocation = useMapStore((state) => state.currentLocation);
  const segments = useMapStore((state) => state.segments);
  const advanceSegment = useMapStore((state) => state.advanceSegment);

  const [animPos, setAnimPos] = useState(null);

  useEffect(() => {
    if (!mapDef) {
      return undefined;
    }
    const segment = segments[0];
    if (!segment) {
      // 静止：描画は currentLocation から導出する。effect 内では何もしない。
      return undefined;
    }

    const edge = mapDef.edges.find((e) => e.id === segment.edgeId);
    if (!edge) {
      return undefined;
    }
    // エッジ描画方向に対する移動の向き。
    // edge.from === segment.from なら順走、そうでなければ逆走。
    const reverse = segment.from === edge.to;

    let rafId = null;
    let cancelled = false;
    let startTimestamp = null;

    /**
     * `<path>` DOM がマウントされ次第アニメを開始する内部ループ。
     *
     * 初回マウント直後など `document.querySelector` が `<path>` を
     * 拾えないフレームでは、次フレームに再試行する（DOM レース回避）。
     */
    const tick = (now) => {
      if (cancelled) {
        return;
      }
      const pathEl = document.querySelector(
        `[data-edge-id="${segment.edgeId}"]`,
      );
      if (!pathEl) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      if (startTimestamp === null) {
        startTimestamp = now;
      }
      const total = pathEl.getTotalLength();
      // 等速移動：所要時間はエッジ長に比例（duration = total / speed）。
      // 進行率は線形のまま（イージングなし）使うことで px/ms が一定になる。
      const duration = total / SEGMENT_SPEED_PX_PER_MS;
      const progress = Math.min(1, (now - startTimestamp) / duration);
      const length = (reverse ? 1 - progress : progress) * total;
      const point = pathEl.getPointAtLength(length);
      setAnimPos({ x: point.x, y: point.y });

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        // 完了時：浮動小数誤差を打ち消すため目的地の停止点（stopPoint）へ
        // スナップしてからストアを進める。次セグメントがあれば effect が
        // 再走して連続再生。目的地は landmark / junction のいずれもあり得る。
        const destNode = findNodeById(mapDef, segment.to);
        if (destNode) {
          setAnimPos({
            x: destNode.stopPoint.x,
            y: destNode.stopPoint.y,
          });
        }
        advanceSegment();
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [mapDef, currentLocation, segments, advanceSegment]);

  // 静止位置のノードは landmark or junction どちらでもあり得る
  // （プログラム的には起動直後やデバッグ時に junction が現在地になる
  //  可能性に備える。通常の操作では起点・終点ともランドマーク）。
  const idlePosition =
    mapDef && currentLocation
      ? findNodeById(mapDef, currentLocation)?.stopPoint ?? null
      : null;
  // 移動中は animPos（rAF が更新する補間点）を、静止時は idlePosition を使う。
  // 移動開始の最初のフレームで animPos がまだ前回の値を保持していても、その
  // 値は前セグメントの目的地（＝今回の出発点 = 新 currentLocation）と等しい
  // ので、idlePosition と一致しジャンプしない。
  const position = segments.length > 0 ? animPos ?? idlePosition : idlePosition;

  if (!position) {
    return null;
  }
  return <PlayerPlaceholder x={position.x} y={position.y} />;
}

export default PlayerSprite;
