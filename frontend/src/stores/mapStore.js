import { create } from 'zustand';
import findShortestPath from '../features/map/findShortestPath';

/**
 * マップ画面の状態を一元管理する Zustand ストア。
 *
 * 現在位置（`currentLocation`）・移動中フラグ（`isMoving`）・残り移動
 * セグメント列（`segments`）・マップ定義（`mapDef`）・隣接リスト
 * （`adjacency`）をグローバルに保持する。`Landmark` のクリックハンドラと
 * `PlayerSprite` のアニメーションループから購読・更新する。
 *
 * 公開アクション：
 *   - `initializeMap(mapDef)` : `maps.json` の 1 マップ分から状態を初期化する
 *   - `requestMove(targetId)` : ランドマーククリック起点の移動要求を処理する
 *                               （同地点・移動中なら no-op、それ以外は BFS で
 *                                経路を求めて `segments` にセット）
 *   - `advanceSegment()`      : 1 セグメント分のアニメ完了時に呼び、`segments`
 *                                先頭を消費して `currentLocation` を進める
 */

const SEGMENT = 'segment';

/**
 * エッジ配列から無向グラフの隣接リストを構築する。
 *
 * Args:
 *     edges (Array<{from: string, to: string}>): エッジ配列。
 *
 * Returns:
 *     Map<string, string[]>: ノード ID をキー、隣接ノード ID の配列を値に
 *         持つマップ。
 */
function buildAdjacency(edges) {
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, []);
    }
    if (!adjacency.has(edge.to)) {
      adjacency.set(edge.to, []);
    }
    adjacency.get(edge.from).push(edge.to);
    adjacency.get(edge.to).push(edge.from);
  }
  return adjacency;
}

/**
 * 2 つのノード ID をつなぐエッジを線形探索で取得する。
 *
 * エッジは無向のため `from` / `to` の順序を問わず一致を判定する。
 *
 * Args:
 *     edges (Array<object>): エッジ配列。
 *     a (string): 一方のノード ID。
 *     b (string): もう一方のノード ID。
 *
 * Returns:
 *     object | undefined: 見つかったエッジ、または見つからなければ undefined。
 */
function findEdgeBetween(edges, a, b) {
  return edges.find(
    (edge) =>
      (edge.from === a && edge.to === b) ||
      (edge.from === b && edge.to === a),
  );
}

const useMapStore = create((set, get) => ({
  mapDef: null,
  currentLocation: null,
  isMoving: false,
  segments: [],
  adjacency: null,

  /**
   * マップ定義からストアを初期化する。
   *
   * `currentLocation` は `mapDef.startId` に設定し（要件 3-1, 3-3）、
   * 隣接リストをこの 1 回だけ構築する。
   *
   * Args:
   *     mapDef (object): `maps.json` の 1 マップ分。
   *         `landmarks` と `edges` と `startId` を持つ。
   */
  initializeMap: (mapDef) =>
    set(() => ({
      mapDef,
      currentLocation: mapDef.startId,
      isMoving: false,
      segments: [],
      adjacency: buildAdjacency(mapDef.edges),
    })),

  /**
   * ランドマーククリック起点の移動要求を処理する。
   *
   * 以下のいずれかなら何もしない（早期 return）：
   *   - 移動中（要件 4-5）
   *   - マップ未初期化
   *   - 目的地が現在地と同じ（要件 4-4）
   *   - 経路が見つからない（連結グラフなら起きない想定）
   *
   * それ以外は `findShortestPath` で最短経路（エッジ数最小、要件 4-3）を
   * 求め、エッジ列に分解して `segments` にセットし `isMoving=true` にする。
   *
   * Args:
   *     targetId (string): 目的地ランドマークの ID。
   */
  requestMove: (targetId) => {
    const state = get();
    if (state.isMoving) {
      return;
    }
    if (!state.mapDef || !state.currentLocation || !state.adjacency) {
      return;
    }
    if (targetId === state.currentLocation) {
      return;
    }

    const path = findShortestPath(
      state.adjacency,
      state.currentLocation,
      targetId,
    );
    if (path == null || path.length < 2) {
      return;
    }

    const segments = [];
    for (let i = 0; i < path.length - 1; i += 1) {
      const edge = findEdgeBetween(state.mapDef.edges, path[i], path[i + 1]);
      if (!edge) {
        return;
      }
      segments.push({
        kind: SEGMENT,
        edgeId: edge.id,
        from: path[i],
        to: path[i + 1],
      });
    }

    set({ segments, isMoving: true });
  },

  /**
   * アニメーション 1 セグメント完了時に呼ぶ。
   *
   * `segments` の先頭を消費し、`currentLocation` を当該セグメントの到達
   * ノードに進める。残りが空なら `isMoving=false` に戻して静止状態へ。
   * 残りが残っていれば `isMoving=true` のまま `PlayerSprite` 側が次
   * セグメントを連続再生する（要件 5-5）。
   */
  advanceSegment: () =>
    set((state) => {
      if (state.segments.length === 0) {
        return {};
      }
      const [head, ...rest] = state.segments;
      return {
        currentLocation: head.to,
        segments: rest,
        isMoving: rest.length > 0,
      };
    }),
}));

export default useMapStore;
