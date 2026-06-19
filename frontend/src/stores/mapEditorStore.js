import { create } from 'zustand';

/**
 * マップ座標エディタ（開発用）の状態を一元管理する Zustand ストア。
 *
 * `maps.json` のランドマーク `position` / `stopPoint`、分岐点（junction）の
 * `stopPoint`、エッジの `waypoints` を、実マップ画像の上でドラッグして
 * 微調整するための編集状態を保持する。編集は元の `maps.json` を直接書き
 * 換えるのではなく、マップ定義の複製（`draft`）に対して行い、結果を JSON
 * として書き出して人手で `maps.json` に貼り戻す運用を想定している（実行時に
 * ソースファイルへ書き込めないため）。
 *
 * 公開アクション：
 *   - `startEditing(mapId, mapDef)` : `mapDef` を複製して編集を開始する
 *   - `stopEditing()`               : 編集を終了し、複製を破棄する
 *   - `resetDraft()`                : 複製を編集開始時の状態へ戻す
 *   - `setNodePosition(id, x, y)`   : ランドマークのアイコン位置を更新する
 *   - `setNodeStop(id, x, y)`       : ランドマーク／分岐点の道上停止点を更新する
 *   - `setWaypoint(edgeId, i, x, y)`: エッジ `i` 番目の通過点を更新する
 *   - `insertWaypoint(edgeId, i, x, y)` : エッジに通過点を `i` 番目として挿入する
 *   - `removeWaypoint(edgeId, i)`   : エッジ `i` 番目の通過点を削除する
 *   - `toggleTraceMode()`           : 境界線トレース（クリックで頂点追加）を切り替える
 *   - `setActiveBorder(name)`       : なぞる対象の境界線（up/right/down/left）を選ぶ
 *   - `setRegionCenter(x, y)`       : 4 本の境界線が共有する中心点を移動する
 *   - `addBorderPoint(x, y)`        : アクティブな境界線に頂点を末尾追加する
 *   - `setBorderPoint(name, i, x, y)`: 境界線 `name` の `i` 番目の頂点を移動する
 *   - `removeBorderPoint(name, i)`  : 境界線 `name` の `i` 番目の頂点を削除する
 *   - `removeLastBorderPoint()`     : アクティブな境界線の末尾頂点を取り消す
 */

/**
 * 構造体をディープコピーする。
 *
 * 編集アクションのたびに `draft` を不変更新するために使う。マップ定義は
 * 小さく、`structuredClone` で十分に高速かつ安全に複製できる。
 *
 * Args:
 *     value (object): 複製対象。
 *
 * Returns:
 *     object: 共有参照を持たない複製。
 */
function clone(value) {
  return structuredClone(value);
}

const useMapEditorStore = create((set, get) => ({
  isEditing: false,
  mapId: null,
  draft: null,
  original: null,
  traceMode: false,
  activeBorder: null,

  /**
   * 編集を開始する。
   *
   * `regionCenter` / `regionBorders` が未定義のマップでも境界線トレースを
   * 始められるよう、複製時に既定値（中心 = viewBox 中央、空の 4 本）で
   * 補完する。トレース関連の一時状態も初期化する。
   *
   * Args:
   *     mapId (string): 編集対象マップのキー（例: `"map_3"`）。
   *     mapDef (object): `maps.json` の 1 マップ分。複製して編集する。
   */
  startEditing: (mapId, mapDef) => {
    const draft = clone(mapDef);
    if (!draft.regionCenter) {
      draft.regionCenter = {
        x: Math.round(draft.viewBox.width / 2),
        y: Math.round(draft.viewBox.height / 2),
      };
    }
    if (!draft.regionBorders) {
      draft.regionBorders = { up: [], right: [], down: [], left: [] };
    }
    set({
      isEditing: true,
      mapId,
      draft,
      original: clone(draft),
      traceMode: false,
      activeBorder: null,
    });
  },

  /** 編集を終了し、複製を破棄する。 */
  stopEditing: () =>
    set({
      isEditing: false,
      mapId: null,
      draft: null,
      original: null,
      traceMode: false,
      activeBorder: null,
    }),

  /** 複製を編集開始時の状態へ戻す。 */
  resetDraft: () => {
    const { original } = get();
    if (original) {
      set({ draft: clone(original) });
    }
  },

  /**
   * ランドマークのアイコン位置（`position`）を更新する。
   *
   * Args:
   *     id (string): ランドマーク ID。
   *     x (number): 新しい X 座標（整数に丸める）。
   *     y (number): 新しい Y 座標（整数に丸める）。
   */
  setNodePosition: (id, x, y) =>
    set((state) => {
      if (!state.draft) {
        return {};
      }
      const draft = clone(state.draft);
      const landmark = draft.landmarks.find((lm) => lm.id === id);
      if (landmark) {
        landmark.position = { x: Math.round(x), y: Math.round(y) };
      }
      return { draft };
    }),

  /**
   * ランドマークまたは分岐点の道上停止点（`stopPoint`）を更新する。
   *
   * Args:
   *     id (string): ランドマークまたは分岐点の ID。
   *     x (number): 新しい X 座標（整数に丸める）。
   *     y (number): 新しい Y 座標（整数に丸める）。
   */
  setNodeStop: (id, x, y) =>
    set((state) => {
      if (!state.draft) {
        return {};
      }
      const draft = clone(state.draft);
      const point = { x: Math.round(x), y: Math.round(y) };
      const landmark = draft.landmarks.find((lm) => lm.id === id);
      if (landmark) {
        landmark.stopPoint = point;
        return { draft };
      }
      const junction = (draft.junctions ?? []).find((j) => j.id === id);
      if (junction) {
        junction.stopPoint = point;
      }
      return { draft };
    }),

  /**
   * エッジの `index` 番目の通過点（`waypoint`）を更新する。
   *
   * Args:
   *     edgeId (string): エッジ ID。
   *     index (number): 通過点の 0 始まりインデックス。
   *     x (number): 新しい X 座標（整数に丸める）。
   *     y (number): 新しい Y 座標（整数に丸める）。
   */
  setWaypoint: (edgeId, index, x, y) =>
    set((state) => {
      if (!state.draft) {
        return {};
      }
      const draft = clone(state.draft);
      const edge = draft.edges.find((e) => e.id === edgeId);
      if (edge && edge.waypoints && edge.waypoints[index]) {
        edge.waypoints[index] = { x: Math.round(x), y: Math.round(y) };
      }
      return { draft };
    }),

  /**
   * エッジに通過点を `index` 番目として挿入する。
   *
   * Args:
   *     edgeId (string): エッジ ID。
   *     index (number): 挿入位置（0 始まり）。
   *     x (number): X 座標（整数に丸める）。
   *     y (number): Y 座標（整数に丸める）。
   */
  insertWaypoint: (edgeId, index, x, y) =>
    set((state) => {
      if (!state.draft) {
        return {};
      }
      const draft = clone(state.draft);
      const edge = draft.edges.find((e) => e.id === edgeId);
      if (edge) {
        if (!edge.waypoints) {
          edge.waypoints = [];
        }
        edge.waypoints.splice(index, 0, {
          x: Math.round(x),
          y: Math.round(y),
        });
      }
      return { draft };
    }),

  /**
   * エッジの `index` 番目の通過点を削除する。
   *
   * Args:
   *     edgeId (string): エッジ ID。
   *     index (number): 削除する通過点の 0 始まりインデックス。
   */
  removeWaypoint: (edgeId, index) =>
    set((state) => {
      if (!state.draft) {
        return {};
      }
      const draft = clone(state.draft);
      const edge = draft.edges.find((e) => e.id === edgeId);
      if (edge && edge.waypoints) {
        edge.waypoints.splice(index, 1);
      }
      return { draft };
    }),

  /** 境界線トレース（クリックで頂点追加）モードのオン／オフを切り替える。 */
  toggleTraceMode: () => set((state) => ({ traceMode: !state.traceMode })),

  /**
   * なぞる対象の境界線を切り替え、トレースモードに入る。
   *
   * Args:
   *     name (string): 境界線名（`up`/`right`/`down`/`left`）。
   */
  setActiveBorder: (name) => set({ activeBorder: name, traceMode: true }),

  /**
   * 4 本の境界線が共有する中心点を移動する（ドラッグ微調整）。
   *
   * Args:
   *     x (number): 新しい X 座標（整数に丸める）。
   *     y (number): 新しい Y 座標（整数に丸める）。
   */
  setRegionCenter: (x, y) =>
    set((state) => {
      if (!state.draft) {
        return {};
      }
      const draft = clone(state.draft);
      draft.regionCenter = { x: Math.round(x), y: Math.round(y) };
      return { draft };
    }),

  /**
   * アクティブな境界線に頂点を末尾追加する。
   *
   * アクティブな境界線が無い場合は何もしない（選択漏れを無害化する）。
   *
   * Args:
   *     x (number): X 座標（整数に丸める）。
   *     y (number): Y 座標（整数に丸める）。
   */
  addBorderPoint: (x, y) =>
    set((state) => {
      if (!state.draft || !state.activeBorder) {
        return {};
      }
      const draft = clone(state.draft);
      draft.regionBorders[state.activeBorder].push({
        x: Math.round(x),
        y: Math.round(y),
      });
      return { draft };
    }),

  /**
   * 境界線 `name` の `index` 番目の頂点を移動する（ドラッグ微調整）。
   *
   * Args:
   *     name (string): 境界線名。
   *     index (number): 頂点の 0 始まりインデックス。
   *     x (number): 新しい X 座標（整数に丸める）。
   *     y (number): 新しい Y 座標（整数に丸める）。
   */
  setBorderPoint: (name, index, x, y) =>
    set((state) => {
      if (!state.draft) {
        return {};
      }
      const draft = clone(state.draft);
      const arm = draft.regionBorders[name];
      if (arm && arm[index]) {
        arm[index] = { x: Math.round(x), y: Math.round(y) };
      }
      return { draft };
    }),

  /**
   * 境界線 `name` の `index` 番目の頂点を削除する。
   *
   * Args:
   *     name (string): 境界線名。
   *     index (number): 削除する頂点の 0 始まりインデックス。
   */
  removeBorderPoint: (name, index) =>
    set((state) => {
      if (!state.draft) {
        return {};
      }
      const draft = clone(state.draft);
      const arm = draft.regionBorders[name];
      if (arm) {
        arm.splice(index, 1);
      }
      return { draft };
    }),

  /** アクティブな境界線の末尾頂点を取り消す（直前のクリックの取り消し）。 */
  removeLastBorderPoint: () =>
    set((state) => {
      if (!state.draft || !state.activeBorder) {
        return {};
      }
      const draft = clone(state.draft);
      const arm = draft.regionBorders[state.activeBorder];
      if (arm && arm.length > 0) {
        arm.pop();
      }
      return { draft };
    }),
}));

export default useMapEditorStore;
