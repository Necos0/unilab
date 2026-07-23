import { useEffect, useState } from 'react';
import useMapStore from '../../stores/mapStore';
import { useSpriteAnimation } from '../../hooks/useSpriteAnimation';
import findNodeById from './findNodeById';
import { getHeroFramePath } from './heroSpritePath';
import { reverseDirection } from './reverseDirection';
import RoboSprite from './RoboSprite';
import playerData from '../../data/player.json';

const SEGMENT_SPEED_PX_PER_MS = 0.42;

const SPRITE_WIDTH = 130;
const SPRITE_HEIGHT = 130;
// 道のラインから足元をさらに下にずらして接地感を出すための補正(SVG 単位)。
const SPRITE_Y_OFFSET = 10;

// 足元に敷く楕円シャドウ。地面接地感を出すための古典的な JRPG パターン
// （影が無いと「貼り付け感」が出る）。輪郭がくっきりした 1 枚だと逆に
// 浮くため、(1) 大きく薄い「拡散影」と (2) 小さく濃い「接地影」の 2 枚を
// 重ね、両方に feGaussianBlur を掛けてエッジを柔らかくする。
const SHADOW_RX = 34;
const SHADOW_RY = 7;
const SHADOW_OPACITY = 0.26;
const CONTACT_SHADOW_RX = 19;
const CONTACT_SHADOW_RY = 4;
const CONTACT_SHADOW_OPACITY = 0.4;
// シャドウのぼかし強度（SVG 単位の標準偏差）。大きいほどソフトになる。
const SHADOW_BLUR_STD = 2.4;
// PNG 下端に透明パディングがあり、画像ボックス最下端 = 視覚的足元 には
// ならない。その分シャドウを上に持ち上げて実際の足元に揃える。値を
// 大きくするほど影が上（スプライトの足元寄り）に動く。
const SHADOW_FEET_LIFT = 16;
// スプライトのカラーグレーディング。塗り背景に対してピクセルアートは
// 彩度・明度が高く浮きやすいので、わずかに彩度・明度を落としてマップの
// 環境光に馴染ませる。暖色寄りにしたいときは sepia() を少し足す。
const SPRITE_COLOR_GRADE = 'saturate(0.92) brightness(0.97)';

/**
 * 現在の歩行方向（`idle` / `up` / `down` / `left` / `right`）を、
 * 進行中セグメントとマップ定義から導出する。
 *
 * セグメントが無ければ `idle`。進行中であれば、エッジの `direction`
 * をベースに `from === edge.to` のとき（逆走時）だけ
 * `reverseDirection` で反転する。エッジ未定義や `direction` 未指定
 * といった不整合があれば `idle` にフォールバックして画像が壊れない
 * ようにする。
 *
 * Args:
 *     mapDef (object | null): マップ定義。
 *     segment (object | undefined): 進行中の移動セグメント。
 *
 * Returns:
 *     string: スプライト状態名（`idle` / `up` / `down` / `left` / `right`）。
 */
function resolveDirectionState(mapDef, segment) {
  if (!mapDef || !segment) {
    return 'idle';
  }
  const edge = mapDef.edges.find((e) => e.id === segment.edgeId);
  if (!edge || !edge.direction) {
    return 'idle';
  }
  const reverse = segment.from === edge.to;
  return reverse ? reverseDirection(edge.direction) : edge.direction;
}

/**
 * 指定状態のスプライトフレーム群をブラウザに事前読み込みする。
 *
 * 歩行アニメ開始の最初のフレームでチラつかないよう、`new Image()`
 * を全フレーム分先読みしてブラウザキャッシュに載せる。`EnemySprite`
 * の事前読み込みと同じパターン。`<img>` ではなく SVG `<image>` を
 * 使う側でも、HTTP 経由でアセットを取得する点は変わらないので
 * 効果は同様に得られる。
 *
 * Args:
 *     state (string): 事前読み込み対象の状態名。
 *     frameCount (number): フレーム総数。
 */
function preloadFrames(state, frameCount) {
  for (let i = 0; i < frameCount; i += 1) {
    const img = new Image();
    img.src = getHeroFramePath(state, i);
  }
}

/**
 * 1 フレーム分のプレイヤースプライトを SVG `<image>` として描く描画専用関数。
 *
 * 画像はソース解像度がアニメ状態ごとに異なる（idle/down は縦長、
 * left/right は横長、など）。共通の `SPRITE_WIDTH × SPRITE_HEIGHT`
 * の枠に `preserveAspectRatio="xMidYMax meet"` で内接させ、横方向は
 * 中央、縦方向は **下端** に揃える。これによりスプライトの「足元」が
 * 常に `(x, y)` に一致し、ランドマーク間を結ぶ道の上で歩行接地点が
 * ぶれない（要件: 歩行中も静止中も足元基準で配置する）。
 * `image-rendering: pixelated` はピクセルアートのにじみを防ぐ。
 * `filter`（`SPRITE_COLOR_GRADE`）で彩度・明度をわずかに落とし、塗りの
 * マップ背景に対する「浮き」を抑える。
 *
 * Args:
 *     props (object): React プロパティ。
 *         x (number): SVG 論理座標の足元 X。
 *         y (number): SVG 論理座標の足元 Y。
 *         src (string): 表示する PNG 画像の URL。
 *
 * Returns:
 *     JSX.Element: SVG `<image>` 要素。
 */
function PlayerImage({ x, y, src }) {
  return (
    <image
      href={src}
      x={x - SPRITE_WIDTH / 2}
      y={y - SPRITE_HEIGHT + SPRITE_Y_OFFSET}
      width={SPRITE_WIDTH}
      height={SPRITE_HEIGHT}
      preserveAspectRatio="xMidYMax meet"
      style={{ imageRendering: 'pixelated', filter: SPRITE_COLOR_GRADE }}
      pointerEvents="none"
    />
  );
}

/**
 * プレイヤーの足元に敷くソフトシャドウ（2 層構成）。
 *
 * スプライト単体だと背景に対して「貼り付けられた」印象になりがちなため、
 * 地面側に半透明の楕円を敷いて接地感を出す（JRPG の古典的手法）。輪郭が
 * くっきりした 1 枚だと逆に浮くので、大きく薄い「拡散影」と小さく濃い
 * 「接地影」の 2 枚を重ね、両方に `feGaussianBlur` を掛けてエッジを柔ら
 * かくする。描画順は `PlayerImage` より前で、勇者の足元の下に潜らせる。
 * シャドウの中心は視覚的な足元（`SPRITE_Y_OFFSET` で下げた位置から
 * `SHADOW_FEET_LIFT` ぶん持ち上げた点）に合わせる。
 *
 * Args:
 *     props (object): React プロパティ。
 *         x (number): 足元 X（スプライトと同じ基準）。
 *         y (number): 足元 Y（スプライトと同じ基準）。
 *
 * Returns:
 *     JSX.Element: ぼかしフィルタ定義と 2 枚の `<ellipse>` を含む `<g>` 要素。
 */
function PlayerShadow({ x, y }) {
  const cy = y + SPRITE_Y_OFFSET - SHADOW_FEET_LIFT;
  return (
    <g pointerEvents="none">
      <defs>
        {/* 既定のフィルタ領域だとぼかしが切れるため広めに確保する。*/}
        <filter
          id="hero-shadow-blur"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation={SHADOW_BLUR_STD} />
        </filter>
      </defs>
      <ellipse
        cx={x}
        cy={cy}
        rx={SHADOW_RX}
        ry={SHADOW_RY}
        fill={`rgba(0, 0, 0, ${SHADOW_OPACITY})`}
        filter="url(#hero-shadow-blur)"
      />
      <ellipse
        cx={x}
        cy={cy}
        rx={CONTACT_SHADOW_RX}
        ry={CONTACT_SHADOW_RY}
        fill={`rgba(0, 0, 0, ${CONTACT_SHADOW_OPACITY})`}
        filter="url(#hero-shadow-blur)"
      />
    </g>
  );
}

/**
 * プレイヤーキャラクターを SVG 上に描画し、移動アニメーションを駆動する
 * コンポーネント。
 *
 * `mapStore.segments` を購読し、先頭セグメントが存在する間は
 * `requestAnimationFrame` で `<path data-edge-id>` 上の点を
 * `getPointAtLength()` で求めて座標を更新する。セグメント完了時に
 * `advanceSegment()` を呼び、残りセグメントがあれば次の useEffect 実行
 * で連続再生される。
 *
 * 描画位置の決定ロジック：
 *   - 静止時（`segments` 空）は `currentLocation` のランドマークの
 *     `stopPoint`（道上の停止点。アイコン位置 `position` とは別軸）を
 *     描画時に直接導出する。effect 内で同期的に setState すると
 *     `react-hooks/set-state-in-effect` に抵触するため、静止位置は
 *     state で持たず render で導出するパターンを採る。
 *   - 移動中はアニメーション state（`animPos`）を使う。前セグメント完了時
 *     の最終位置がそのまま次セグメントの開始位置（= 新 `currentLocation`
 *     の `stopPoint`）と一致するため、フレーム間でジャンプは起こらない。
 *
 * スプライトアニメーション：
 *   - 進行中セグメントのエッジ `direction`（`maps.json`）から表示状態を
 *     `up` / `down` / `left` / `right` に切り替える。`from === edge.to`
 *     の逆走時は方向を反転（`reverseDirection`）。
 *   - 静止時は `idle`。
 *   - フレーム送りは `useSpriteAnimation` に委譲し、状態変更時は内部で
 *     `frameIndex` が 0 にリセットされる。
 *   - 状態が切り替わるたびに `preloadFrames` で次の歩行方向の画像群を
 *     先読みしてチラつきを抑える。
 *
 * 相棒のフローチャートロボ（`RoboSprite`）も同じ足元座標と歩行方向を
 * 渡して勇者の斜め上（進行方向の反対側）に描画し、歩行・静止を問わず
 * 常に追従して浮遊させる。
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

  const directionState = resolveDirectionState(mapDef, segments[0]);
  const animations = playerData.sprite.animations;
  const animation = animations[directionState] ?? animations.idle;

  const { frameIndex } = useSpriteAnimation({
    frameCount: animation.frameCount,
    frameDurationMs: animation.frameDurationMs,
    loop: animation.loop,
  });

  useEffect(() => {
    preloadFrames(directionState, animation.frameCount);
  }, [directionState, animation.frameCount]);

  useEffect(() => {
    if (!mapDef) {
      return undefined;
    }
    const segment = segments[0];
    if (!segment) {
      return undefined;
    }

    const edge = mapDef.edges.find((e) => e.id === segment.edgeId);
    if (!edge) {
      return undefined;
    }
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
      const duration = total / SEGMENT_SPEED_PX_PER_MS;
      const progress = Math.min(1, (now - startTimestamp) / duration);
      const length = (reverse ? 1 - progress : progress) * total;
      const point = pathEl.getPointAtLength(length);
      setAnimPos({ x: point.x, y: point.y });

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
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

  const idlePosition =
    mapDef && currentLocation
      ? findNodeById(mapDef, currentLocation)?.stopPoint ?? null
      : null;
  const position = segments.length > 0 ? animPos ?? idlePosition : idlePosition;

  if (!position) {
    return null;
  }
  return (
    <g pointerEvents="none">
      <PlayerShadow x={position.x} y={position.y} />
      <PlayerImage
        x={position.x}
        y={position.y}
        src={getHeroFramePath(directionState, frameIndex)}
      />
      <RoboSprite
        x={position.x}
        y={position.y}
        directionState={directionState}
      />
    </g>
  );
}

export default PlayerSprite;
