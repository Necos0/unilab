import { useRef } from 'react';
import styles from './MapRegionEditorLayer.module.css';
import { clientToSvgPoint } from './clientToSvgPoint';
import useMapEditorStore from '../../stores/mapEditorStore';
import buildRegionPolygons from './buildRegionPolygons';

const BORDER_NAMES = ['up', 'right', 'down', 'left'];

/**
 * 頂点列を SVG `points` 属性用の "x,y x,y ..." 文字列へ変換する。
 *
 * Args:
 *     points (Array<{x: number, y: number}>): 頂点列。
 *
 * Returns:
 *     string: `<polygon>` / `<polyline>` の `points` 属性値。
 */
function toPointsAttr(points) {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

/**
 * 編集モード時に「境界線（十字モデル）」をなぞって全体マップを 4 分割する
 * ためのレイヤー。
 *
 * `mapEditorStore` の `draft.regionCenter` と `draft.regionBorders` を読み、
 * 中心点と 4 本の境界線（`up`/`right`/`down`/`left`）を描く。境界線は中心点を
 * 起点に折れ線で表示し、各頂点はドラッグで微調整・ダブルクリックで削除できる。
 * 中心点もドラッグで動かせ、4 本に共有される。`traceMode` がオンの間は viewBox
 * 全面を覆う透明矩形がクリックを受け取り、クリック位置をアクティブな境界線の
 * 末尾頂点として追加する（`addBorderPoint`）。
 *
 * さらに `buildRegionPolygons` で 4 本の境界線から領域ポリゴンを自動生成し、
 * 半透明で塗って「全面がすき間なく 4 分割される」様子をライブプレビューする。
 * 4 本すべてに頂点が 1 つ以上ある時だけ塗りが現れる。ドラッグは Pointer
 * Events + `setPointerCapture` で実装し、捕捉中の pointerId を `activePointerRef`
 * に保持してホバーの move と区別する。座標変換は `clientToSvgPoint` が担う。
 *
 * Args:
 *     props (object): React プロパティ。
 *         draft (object): 編集中のマップ定義（`mapEditorStore.draft`）。
 *             `viewBox` / `regionCenter` / `regionBorders` を参照する。
 *
 * Returns:
 *     JSX.Element: 中心点・境界線・領域プレビューを含む `<g>` 要素。
 */
function MapRegionEditorLayer({ draft }) {
  const traceMode = useMapEditorStore((s) => s.traceMode);
  const activeBorder = useMapEditorStore((s) => s.activeBorder);
  const addBorderPoint = useMapEditorStore((s) => s.addBorderPoint);
  const setBorderPoint = useMapEditorStore((s) => s.setBorderPoint);
  const removeBorderPoint = useMapEditorStore((s) => s.removeBorderPoint);
  const setRegionCenter = useMapEditorStore((s) => s.setRegionCenter);

  const activePointerRef = useRef(null);

  const { viewBox } = draft;
  const center = draft.regionCenter;
  const borders = draft.regionBorders ?? { up: [], right: [], down: [], left: [] };
  const regions = buildRegionPolygons(center, borders, viewBox);

  /**
   * ドラッグ開始。掴んだポインタを捕捉し、その pointerId を記録する。
   *
   * Args:
   *     event (PointerEvent): `pointerdown` イベント。
   */
  const handleDragStart = (event) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
  };

  /**
   * ドラッグ移動。捕捉中のポインタなら、対象（中心点／境界線頂点）を
   * `data-*` 属性から判別して座標を更新する。
   *
   * Args:
   *     event (PointerEvent): `pointermove` イベント。
   */
  const handleDragMove = (event) => {
    if (activePointerRef.current !== event.pointerId) {
      return;
    }
    const point = clientToSvgPoint(
      event.currentTarget.ownerSVGElement,
      event.clientX,
      event.clientY,
    );
    const { dragKind, border, index } = event.currentTarget.dataset;
    if (dragKind === 'center') {
      setRegionCenter(point.x, point.y);
    } else if (dragKind === 'vertex') {
      setBorderPoint(border, Number(index), point.x, point.y);
    }
  };

  /**
   * ドラッグ終了。捕捉していたポインタを解放する。
   *
   * Args:
   *     event (PointerEvent): `pointerup` イベント。
   */
  const handleDragEnd = (event) => {
    if (activePointerRef.current === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      activePointerRef.current = null;
    }
  };

  /**
   * トレース用の透明矩形クリックで、クリック位置を境界線頂点として追加する。
   *
   * Args:
   *     event (PointerEvent): クリックイベント。
   */
  const handleTraceClick = (event) => {
    const point = clientToSvgPoint(
      event.currentTarget.ownerSVGElement,
      event.clientX,
      event.clientY,
    );
    addBorderPoint(point.x, point.y);
  };

  return (
    <g className={styles.layer}>
      {/* 領域の自動プレビュー（全面 4 分割の確認用） */}
      {regions.map((region) => (
        <polygon
          key={`region-${region.id}`}
          points={toPointsAttr(region.points)}
          className={styles.region}
          style={{ fill: region.color }}
        />
      ))}

      {/*
       * トレース中だけ全面の透明矩形でクリックを拾う。中心点・頂点ハンドルは
       * 後段でこの矩形より前面に描かれ、stopPropagation でドラッグを優先する。
       */}
      {traceMode && activeBorder && (
        <rect
          x={0}
          y={0}
          width={viewBox.width}
          height={viewBox.height}
          className={styles.capture}
          onClick={handleTraceClick}
        />
      )}

      {/* 各境界線：中心点を起点とした折れ線と頂点ハンドル */}
      {center &&
        BORDER_NAMES.map((name) => {
          const arm = borders[name] ?? [];
          const isActive = name === activeBorder;
          const linePoints = [center, ...arm];
          return (
            <g key={`border-${name}`}>
              {linePoints.length >= 2 && (
                <polyline
                  points={toPointsAttr(linePoints)}
                  className={styles.border}
                  data-active={isActive ? 'true' : 'false'}
                />
              )}
              {arm.map((p, index) => (
                <circle
                  key={`v-${name}-${index}`}
                  cx={p.x}
                  cy={p.y}
                  r="11"
                  className={styles.vertex}
                  data-active={isActive ? 'true' : 'false'}
                  data-drag-kind="vertex"
                  data-border={name}
                  data-index={index}
                  onDoubleClick={() => removeBorderPoint(name, index)}
                  onPointerDown={handleDragStart}
                  onPointerMove={handleDragMove}
                  onPointerUp={handleDragEnd}
                />
              ))}
              {arm.length > 0 && (
                <text
                  x={arm[arm.length - 1].x}
                  y={arm[arm.length - 1].y - 16}
                  className={styles.label}
                >
                  {name}
                </text>
              )}
            </g>
          );
        })}

      {/* 4 本が共有する中心点ハンドル */}
      {center && (
        <circle
          cx={center.x}
          cy={center.y}
          r="15"
          className={styles.center}
          data-drag-kind="center"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
        />
      )}
    </g>
  );
}

export default MapRegionEditorLayer;
