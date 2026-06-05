import { useRef } from 'react';
import styles from './MapEditorLayer.module.css';
import { clientToSvgPoint } from './clientToSvgPoint';
import useMapEditorStore from '../../stores/mapEditorStore';

/**
 * 1 本のエッジの折れ線頂点列（停止点 + 通過点 + 停止点）を求める。
 *
 * `MapPaths` の曲線生成と同じ端点（両端ノードの `stopPoint`）と通過点列を
 * たどり、通過点の挿入位置（中点ハンドル）を計算するための素の点列を返す。
 *
 * Args:
 *     edge (object): エッジ定義（`from` / `to` / `waypoints?`）。
 *     nodeById (Map<string, object>): ノード ID から定義を引くマップ。
 *
 * Returns:
 *     Array<{x: number, y: number}>: 端点と通過点を順に並べた点列。
 */
function edgePolyline(edge, nodeById) {
  const from = nodeById.get(edge.from)?.stopPoint;
  const to = nodeById.get(edge.to)?.stopPoint;
  if (!from || !to) {
    return [];
  }
  return [from, ...(edge.waypoints ?? []), to];
}

/**
 * 編集モード時に座標ハンドルを SVG 上へ重ねて描画するレイヤー。
 *
 * `mapEditorStore` の `draft` を読み、各ランドマークの `position`（四角）と
 * `stopPoint`（丸）、分岐点の `stopPoint`（菱形）、各エッジの `waypoint`
 * （小丸）をドラッグ可能なハンドルとして描く。さらにエッジの各区間中点に
 * 「＋」ハンドルを置き、クリックでその位置に通過点を挿入できる。通過点は
 * ダブルクリックで削除する。`position` と `stopPoint` の対応は破線で結んで
 * 視認性を上げる。
 *
 * ドラッグは Pointer Events + `setPointerCapture` で実装し、ハンドル要素に
 * 捕捉されたポインタの move だけを座標更新に使う（ホバーの move と区別する
 * ため `activePointerRef` で捕捉中の pointerId を保持する）。画面ピクセルから
 * viewBox 座標への変換は `clientToSvgPoint` が担う。
 *
 * Args:
 *     props (object): React プロパティ。
 *         draft (object): 編集中のマップ定義（`mapEditorStore.draft`）。
 *
 * Returns:
 *     JSX.Element: ハンドル群を含む `<g>` 要素。
 */
function MapEditorLayer({ draft }) {
  const setNodePosition = useMapEditorStore((s) => s.setNodePosition);
  const setNodeStop = useMapEditorStore((s) => s.setNodeStop);
  const setWaypoint = useMapEditorStore((s) => s.setWaypoint);
  const insertWaypoint = useMapEditorStore((s) => s.insertWaypoint);
  const removeWaypoint = useMapEditorStore((s) => s.removeWaypoint);

  const activePointerRef = useRef(null);

  const nodeById = new Map([
    ...draft.landmarks.map((lm) => [lm.id, lm]),
    ...(draft.junctions ?? []).map((j) => [j.id, j]),
  ]);

  /**
   * 1 個のハンドル用にドラッグ用ポインタハンドラ群を生成する。
   *
   * Args:
   *     apply (function): 確定した viewBox 座標 `(x, y)` を受け取り、対応する
   *         ストアアクションを呼ぶコールバック。
   *
   * Returns:
   *     object: `<circle>` などに展開する `onPointerDown/Move/Up` の束。
   */
  const dragHandlers = (apply) => ({
    onPointerDown: (event) => {
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      activePointerRef.current = event.pointerId;
    },
    onPointerMove: (event) => {
      if (activePointerRef.current !== event.pointerId) {
        return;
      }
      const svg = event.currentTarget.ownerSVGElement;
      const point = clientToSvgPoint(svg, event.clientX, event.clientY);
      apply(point.x, point.y);
    },
    onPointerUp: (event) => {
      if (activePointerRef.current === event.pointerId) {
        event.currentTarget.releasePointerCapture(event.pointerId);
        activePointerRef.current = null;
      }
    },
  });

  return (
    <g className={styles.layer}>
      {/* エッジの通過点ハンドルと、区間中点の挿入ハンドル */}
      {draft.edges.map((edge) => {
        const pts = edgePolyline(edge, nodeById);
        const waypoints = edge.waypoints ?? [];
        return (
          <g key={`edge-${edge.id}`}>
            {/* 区間中点の「＋」挿入ハンドル */}
            {pts.slice(0, -1).map((p, segIndex) => {
              const next = pts[segIndex + 1];
              const midX = (p.x + next.x) / 2;
              const midY = (p.y + next.y) / 2;
              return (
                <g
                  key={`ins-${edge.id}-${segIndex}`}
                  className={styles.insert}
                  onClick={() => insertWaypoint(edge.id, segIndex, midX, midY)}
                >
                  <circle cx={midX} cy={midY} r="12" className={styles.insertDot} />
                  <text x={midX} y={midY} className={styles.insertPlus}>
                    +
                  </text>
                </g>
              );
            })}
            {/* 通過点ハンドル（ドラッグで移動・ダブルクリックで削除）*/}
            {waypoints.map((wp, index) => (
              <g key={`wp-${edge.id}-${index}`} className={styles.handle}>
                <circle
                  cx={wp.x}
                  cy={wp.y}
                  r="16"
                  className={styles.waypoint}
                  onDoubleClick={() => removeWaypoint(edge.id, index)}
                  {...dragHandlers((x, y) => setWaypoint(edge.id, index, x, y))}
                />
                <text x={wp.x} y={wp.y - 22} className={styles.handleLabel}>
                  {`${edge.id}[${index}]`}
                </text>
              </g>
            ))}
          </g>
        );
      })}

      {/* 分岐点の停止点ハンドル */}
      {(draft.junctions ?? []).map((junction) => (
        <g key={`j-${junction.id}`} className={styles.handle}>
          <rect
            x={junction.stopPoint.x - 13}
            y={junction.stopPoint.y - 13}
            width="26"
            height="26"
            transform={`rotate(45 ${junction.stopPoint.x} ${junction.stopPoint.y})`}
            className={styles.junctionStop}
            {...dragHandlers((x, y) => setNodeStop(junction.id, x, y))}
          />
          <text
            x={junction.stopPoint.x}
            y={junction.stopPoint.y - 24}
            className={styles.handleLabel}
          >
            {junction.id}
          </text>
        </g>
      ))}

      {/* ランドマークの position（四角）と stopPoint（丸）*/}
      {draft.landmarks.map((landmark) => (
        <g key={`lm-${landmark.id}`} className={styles.handle}>
          <line
            x1={landmark.position.x}
            y1={landmark.position.y}
            x2={landmark.stopPoint.x}
            y2={landmark.stopPoint.y}
            className={styles.link}
          />
          <circle
            cx={landmark.stopPoint.x}
            cy={landmark.stopPoint.y}
            r="16"
            className={styles.stop}
            {...dragHandlers((x, y) => setNodeStop(landmark.id, x, y))}
          />
          <rect
            x={landmark.position.x - 15}
            y={landmark.position.y - 15}
            width="30"
            height="30"
            className={styles.position}
            {...dragHandlers((x, y) => setNodePosition(landmark.id, x, y))}
          />
          <text
            x={landmark.position.x}
            y={landmark.position.y - 24}
            className={styles.handleLabel}
          >
            {landmark.id}
          </text>
        </g>
      ))}
    </g>
  );
}

export default MapEditorLayer;
