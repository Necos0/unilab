# 実装タスク: マップ・ランドマーク移動

`requirements.md` / `design.md` を実装に落とすためのタスク分解。依存関係を考えて下から上へ積み上がる順に並べる。各タスクは原則 1 ファイル 1 タスク（CLAUDE.md「1 ファイル 1 クラス」に対応）。

---

## 1. データ定義

- [ ] **1.1 `frontend/src/data/maps.json` を作成する**
  - `map_1` を定義する：`image` / `viewBox` / `startId` / `landmarks[5]` / `edges[4]`。
  - ランドマーク ID: `village_gate` / `well` / `fallen_tree` / `fortress` / `stone_circle`。
  - エッジ: `e-gate-well` / `e-well-fallen` / `e-well-fortress` / `e-fortress-stone`。
  - `position` / `control` の数値は `public/maps/map_1.png` を見ながら仮置きする（あとで動作確認時に微調整）。
  - 対応要件: 2-1, 2-2, 2-3, 2-4, 3-3, 6-1

## 2. 経路探索の純関数

- [ ] **2.1 `frontend/src/features/map/findShortestPath.js` を作成する**
  - シグネチャ: `findShortestPath(adjacency, start, goal) → string[] | null`
  - `adjacency` は `Map<nodeId, nodeId[]>`。BFS で最短ホップの経路を返す。
  - 到達不可なら `null`、`start === goal` なら `[start]` を返す。
  - Google docstring を付ける。UI 非依存・純関数なので将来の単体テスト対象。
  - 対応要件: 4-3

## 3. 状態管理

- [ ] **3.1 `frontend/src/stores/mapStore.js` を作成する**
  - State: `mapDef` / `currentLocation` / `isMoving` / `segments` / `adjacency`
  - Actions: `initializeMap(mapDef)` / `requestMove(targetId)` / `advanceSegment()`
  - `initializeMap` 内で `edges` から隣接リスト（`adjacency`）を一度だけ構築する。
  - `requestMove` の冒頭で同地点ガード・移動中ガードを実装（要件 4-4, 4-5）。
  - `findShortestPath` を呼び、エッジ列に分解して `segments` にセット。
  - `advanceSegment` で `currentLocation` を `segments[0].to` に進め、配列を 1 つ縮める。空になったら `isMoving=false`。
  - 対応要件: 3-1, 3-3, 4-1〜4-5

## 4. コンポーネント（描画レイヤ）

- [ ] **4.1 `frontend/src/features/map/MapBackground.jsx` を作成する**
  - `<image href={mapDef.image} x={0} y={0} width={vb.width} height={vb.height} />` を返すだけ。
  - `mapDef` を props で受ける。
  - 対応要件: 1-2, 1-3

- [ ] **4.2 `frontend/src/features/map/MapPaths.jsx` を作成する**
  - `mapDef.edges` をループし、エッジごとに `<path d="M fx,fy Q cx,cy tx,ty" data-edge-id={edge.id} />` を 1 本ずつ描画。
  - `stroke` / `stroke-width` / `fill="none"` / `pointer-events="none"` を CSS Module で当てる。
  - CSS Module: `MapPaths.module.css`。
  - 対応要件: 2-2, 6-2

- [ ] **4.3 `frontend/src/features/map/Landmark.jsx` を作成する**
  - props: `landmark` / `isMoving` / `onClick`。
  - `<g>` 内に `<circle>`（プレースホルダ）と `<text>`（ラベル）を置き、`onClick` で `mapStore.requestMove(landmark.id)`。
  - `isMoving` 中は `pointer-events="none"`、それ以外は `cursor: pointer`。
  - CSS Module: `Landmark.module.css`。
  - 対応要件: 2-1, 4-1, 4-5

- [ ] **4.4 `frontend/src/features/map/PlayerSprite.jsx` を作成する**
  - 描画要素は **赤丸プレースホルダ**（`<circle cx={x} cy={y} r={18} fill="#e74c3c" stroke="#fff" strokeWidth={3} pointerEvents="none" />`）。
  - 本番画像差し替え時に内部の描画コンポーネントだけ置き換えられるよう、`PlayerPlaceholder` を内部関数として分離しておく。
  - `mapStore` から `segments` / `currentLocation` / `mapDef` を購読。
  - `useEffect` で以下を実装：
    - `segments[0]` が無ければ `currentLocation` の座標へスナップ（要件 3-2, 5-3）。
    - あれば `document.querySelector('[data-edge-id="..."]')` で `<path>` を取得 → `getPointAtLength` ＋ `requestAnimationFrame` でアニメ。
    - エッジの向き（`edge.from === seg.from` で順走 / 逆走）を判定して長さを反転。
    - イージング: `easeInOutQuad`、所要時間: `SEGMENT_DURATION_MS = 800`。
    - 完了時に最終座標へスナップ → `mapStore.advanceSegment()`。
    - DOM 未マウント時は次フレームで再試行するガードを入れる。
  - 対応要件: 3-1, 3-2, 5-1〜5-5, 6-4

- [ ] **4.5 `frontend/src/features/map/MapScreen.jsx` を作成する**
  - マウント時に `maps.json` から `map_1` を取り出して `mapStore.initializeMap(mapDef)` を呼ぶ。
  - `<svg viewBox="0 0 1920 1080">` 内に `MapBackground` / `MapPaths` / `Landmark` × N / `PlayerSprite` をこの順で重ねる。
  - ハブクリック相当の動作も同じ `Landmark` で扱う（本マップにハブは無いが、汎用的に全ランドマークで `requestMove` が走る）。
  - CSS Module: `MapScreen.module.css`（`width: 100%; height: 100%; aspect-ratio: 16/9` などのレイアウト指定）。
  - 対応要件: 1-1, 1-2, 1-3, 6-1, 6-3

## 5. アプリ統合

- [ ] **5.1 `frontend/src/App.jsx` のインポートを `BattleScreen` から `MapScreen` に差し替える**
  - `BattleScreen` 自体は削除しない（後続スペックで遷移先として再利用）。
  - JSDoc の説明文も「起動直後にマップ画面を表示する」に更新。
  - 対応要件: 1-1

## 6. ドキュメント同期

- [ ] **6.1 `README.md` の「ディレクトリ構造」セクションを更新する**
  - `frontend/src/data/maps.json` を追記。
  - `frontend/src/features/map/` 一式を追記（`MapScreen.jsx` 等）。
  - `frontend/src/stores/mapStore.js` を追記。
  - 「今後追加予定のディレクトリ」表に該当行があれば削除（特に `features/stage/` 系）。
  - CLAUDE.md「ディレクトリ追加・削除・リネーム時は同じコミットで README を更新」に従う。

## 7. 動作確認・仕上げ

- [ ] **7.1 Lint チェック**
  - `cd frontend && npm run lint`（または `eslint`）が通ることを確認。
  - エラー・警告ゼロを目標にし、出たら直す。

- [ ] **7.2 ブラウザ動作確認（ユーザー指示があった場合のみ）**
  - CLAUDE.md「ブラウザ動作確認は指示があるときだけ行う」に従い、ユーザーが明示的に指示した時のみ `npm run dev` を起動する。
  - 確認観点：
    - 起動直後、村の門に赤丸（プレイヤー）が静止している
    - 隣接ランドマーク（村の門 → 井戸）クリックで 1 エッジ移動
    - 非隣接ランドマーク（倒木 → ストーンサークル）クリックで井戸・砦を経由する 3 エッジ連続再生
    - 移動中の連打が無視される
    - ウィンドウサイズ変更でレイアウトが崩れない
  - 確認後の生成物（スクリーンショット等）はコミットしない。

---

## 実装上の注意

- **1 ファイル 1 クラス / コンポーネント**（CLAUDE.md）
- **すべてのクラス・関数に Google docstring**（CLAUDE.md）
- 命名規則: コンポーネントは PascalCase、フック以外の JS ファイルは camelCase（CLAUDE.md）
- ディレクトリは **タスクの中で実際にファイルを置くタイミング** で作成する（先回りで空フォルダを作らない）
- `frontend/src/features/map/` も `frontend/src/data/maps.json` も今回の実装で初めて生まれる
