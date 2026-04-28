# 設計: マップ・ランドマーク移動

## 概要

要件 1〜6 を満たすマップ画面を、`frontend/src/features/map/` 配下に新設する。背景画像・道・ランドマーク・プレイヤースプライトをすべて単一の `<svg viewBox>` 内に重ね、座標系を 1920×1080 の論理座標に統一する。

道は **分岐を含むネットワーク（無向グラフ）** として扱う：ノード＝ランドマーク **または分岐点（junction）**、エッジ＝道。ランドマークはクリック可能でアイコン・ラベルを持つが、junction は道のグラフ構造上の中間ノードとしてのみ存在し、`id` と `stopPoint` だけを持ちアイコンもクリック判定も持たない（要件 2-4）。マップ定義は JSON データ（`frontend/src/data/maps.json`）として外出しし、座標・ID・接続関係の変更がコード変更なしで反映される構造にする（要件 2-6）。

状態（現在位置・移動中フラグ・移動セグメント列）は Zustand ストア `mapStore` に集約する。任意のランドマークがクリックされたら、現在地から目的地までの **エッジ数最小の経路** をストア内 BFS で求め、得られたエッジ列を順に SVG `<path>` の `getPointAtLength()` ＋ `requestAnimationFrame` で連続再生する（要件 4-3, 5-5, 6-4）。

本設計のスコープは「マップ画面の表示」「道のネットワーク上のランドマーク間移動」「移動アニメーション」までで、ランドマーク到達後の `BattleScreen` 遷移などは含めない。

---

## アーキテクチャ

### コンポーネント階層

```
App
└── MapScreen                 ← ルート。マウント時に mapStore を初期化
    └── <svg viewBox="0 0 1920 1080">
        ├── <image>           ← 背景: /maps/map_1.png
        ├── MapPaths          ← エッジごとに <path> を 1 本描画
        ├── Landmarks         ← 各ランドマーク（クリックハンドラ持ち）
        │   └── Landmark      ← 1 個分（ID/座標で一意）
        └── PlayerSprite      ← <image> をエッジ列に沿ってアニメーション
```

すべて単一 SVG 内に置くことで viewBox スケーリングを背景画像・道・キャラに同時適用でき、ウィンドウリサイズで位置がずれない（要件 6-3）。

### 状態とイベントの流れ

```
[Landmarkクリック]
    │ onClick(landmarkId)
    ▼
[mapStore.requestMove(landmarkId)]
    │ - 現在位置と一致 → 何もしない（要件 4-4）
    │ - 移動中           → 何もしない（要件 4-5）
    │ - それ以外         → BFS で最短経路を求めてエッジ列に分解
    ▼
[mapStore: isMoving=true, segments=[edge1, edge2, ...]]
    ▼
[PlayerSprite が segments[0] を 1 セグメント再生]
    │ requestAnimationFrame ループで getPointAtLength
    │ 完了したら advanceSegment() で先頭を消費
    ▼
[segments が空になったら completeMove()]
    │ currentLocation=targetId, isMoving=false
```

---

## データモデル

### `frontend/src/data/maps.json`（新規）

```json
{
  "maps": {
    "map_1": {
      "image": "/maps/map_1.png",
      "viewBox": { "width": 1920, "height": 1080 },
      "startId": "village_gate",
      "landmarks": [
        { "id": "village_gate", "label": "村の門",          "position": { "x": 170,  "y": 540 }, "stopPoint": { "x": 170,  "y": 540 } },
        { "id": "well",         "label": "井戸",            "position": { "x": 500,  "y": 690 }, "stopPoint": { "x": 500,  "y": 690 } },
        { "id": "fallen_tree",  "label": "倒木",            "position": { "x": 880,  "y": 230 }, "stopPoint": { "x": 880,  "y": 230 } },
        { "id": "fortress",     "label": "砦",              "position": { "x": 980,  "y": 700 }, "stopPoint": { "x": 980,  "y": 700 } },
        { "id": "stone_circle", "label": "ストーンサークル", "position": { "x": 1700, "y": 470 }, "stopPoint": { "x": 1700, "y": 470 } }
      ],
      "junctions": [
        { "id": "j-fork-1", "stopPoint": { "x": 600, "y": 600 } }
      ],
      "edges": [
        { "id": "e-gate-well",      "from": "village_gate", "to": "well",         "control": { "x": 300,  "y": 700 } },
        { "id": "e-well-fallen",    "from": "well",         "to": "fallen_tree",  "control": { "x": 700,  "y": 350 } },
        { "id": "e-well-fortress",  "from": "well",         "to": "fortress",     "control": { "x": 720,  "y": 720 } },
        { "id": "e-fortress-stone", "from": "fortress",     "to": "stone_circle", "control": { "x": 1350, "y": 600 } }
      ]
    }
  }
}
```

**設計上のポイント**

- ランドマークと道のネットワークを **ノード（`landmarks` / `junctions`）＋ エッジ（`edges`）** の 3 配列で表す。`hub` のような特殊ノードを設けず、分岐は「同じノードから複数のエッジが伸びている」状態で自然に表現される。
- **landmarks**: クリック可能・アイコン・ラベル付きの最終目的地候補。`id` / `label` / `position` / `stopPoint` を持つ。
- **junctions**: 道が分岐する位置を表すクリック不可の中間ノード。`id` / `stopPoint` のみ。経路探索（BFS）にはノードとして含まれ、移動アニメーションでは通過点として扱われる（停止しない・選択不能、要件 2-4）。
- エッジの `from` / `to` は landmark / junction のどちらの ID も指せる。グラフ構造としてはどちらも対等なノード。
- 各ランドマークは **2 つの座標** を持つ（要件 2-3）：
    - `position`：アイコン・ラベル・クリック判定の中心。背景画像のランドマーク本体（井戸の建物、村の門のアーチ等）の上に置く。
    - `stopPoint`：道上の停止点・パス端点。背景画像の道がランドマークに最も近づくポイントに置く。`MapPaths` のエッジ端点と `PlayerSprite` の着地点はどちらもこちらを参照する。
- 両者を分離するのは「アイコンを見やすい位置に出しつつ、キャラクターは道の上で停止させる」ための調整自由度を確保するため。両者は同じ座標でもよく、調整が不要なマップでは `stopPoint` を `position` と同じ値にしておけばよい。
- エッジは無向。`from` / `to` の表記順は描画用の都合（ベジェの基準点）であり、移動方向はクリック時に動的に決まる。
- `control` は SVG 二次ベジェの制御点。`<path d="M from.stopPoint Q control to.stopPoint" />` で曲線を引く。直線にしない理由：要件 6-4 で「道のカーブに沿う」ことが期待され、`getPointAtLength` の結果が直線補間と区別できる形にしておく必要があるため。
- `startId` で初期位置を切り替え可能（要件 3-3）。
- 座標は **論理座標（viewBox 内）** で持つ。ピクセル座標やパーセントは使わない（要件 6-1, 6-3）。
- 値は仮値。実際の数値はマップ画像のレイアウトに合わせて調整可能（コード変更不要、要件 2-5）。

### マップ定義の TypeScript 風シグネチャ（参考）

```
type MapDef = {
  image: string;
  viewBox: { width: number; height: number };
  startId: string;
  landmarks: Landmark[];
  junctions?: Junction[];                // 省略可（分岐点が無いマップ）
  edges: Edge[];
};
type Landmark = {
  id: string;
  label?: string;
  position:  { x: number; y: number };  // アイコン・クリック中心
  stopPoint: { x: number; y: number };  // 道上の停止点・パス端点
};
type Junction = {
  id: string;
  stopPoint: { x: number; y: number };  // 道上の通過点（クリック不可）
};
type Edge = {
  id: string;
  from: string;            // landmark id or junction id
  to: string;              // landmark id or junction id
  control: { x: number; y: number };
};
```

---

## 状態管理: `frontend/src/stores/mapStore.js`（新規）

`battleStore.js` と同じ Zustand 流儀で書く。1 ファイル 1 ストア、JSDoc は Google docstring（CLAUDE.md 規約）。

### State

| キー | 型 | 説明 |
|---|---|---|
| `mapDef` | `MapDef \| null` | 現在のマップ定義（landmarks/edges を含む） |
| `currentLocation` | `string` | 現在位置のランドマーク ID。初期値 `mapDef.startId` |
| `isMoving` | `boolean` | 移動中フラグ。クリック入力ガードに使う（要件 4-5） |
| `segments` | `Array<{ edgeId: string; from: string; to: string }>` | 残り移動セグメント。先頭から消化する |

### Actions

| アクション | 役割 |
|---|---|
| `initializeMap(mapDef)` | `mapDef` をストアに格納し、`currentLocation = mapDef.startId` で初期化（要件 3-1, 3-3） |
| `requestMove(targetId)` | クリック起点の遷移要求。`isMoving` か同地点クリックなら no-op。それ以外は経路探索でエッジ列に分解し、`segments` にセット |
| `advanceSegment()` | 先頭セグメントを消費し、`currentLocation` を当該エッジの到達ノード ID に進める。`segments` が空になったら自動的に `isMoving=false` |

### `requestMove` のロジック

```
requestMove(targetId):
  if isMoving:                       return    # 要件 4-5
  if targetId === currentLocation:   return    # 要件 4-4
  path = findShortestPath(currentLocation, targetId)   # ノード ID 列
  if path === null:                  return    # 接続されていない（連結グラフなら起きない想定）
  segments = []
  for i in 0 .. path.length - 2:
    edge = lookupEdge(path[i], path[i+1])
    segments.push({ edgeId: edge.id, from: path[i], to: path[i+1] })
  set({ segments, isMoving: true })
```

### 経路探索（BFS）

```
findShortestPath(start, goal):
  # adjacency: Map<nodeId, Array<nodeId>>  (edges から事前構築)
  visited = { start: null }
  queue = [start]
  while queue not empty:
    n = queue.shift()
    if n === goal: return reconstruct(visited, goal)
    for nb in adjacency[n]:
      if nb not in visited:
        visited[nb] = n
        queue.push(nb)
  return null
```

エッジ数を最小化する経路を返す（要件 4-3）。隣接リストはマップ初期化時に一度作って `mapStore` 内に保持する（毎回作り直さない）。`map_1` のような小規模グラフでは BFS で十分高速。

### `advanceSegment` のロジック

`PlayerSprite` が 1 セグメントを再生し終えたら呼ばれる。

```
advanceSegment():
  next = segments[0]
  rest = segments.slice(1)
  set({
    currentLocation: next.to,
    segments: rest,
    isMoving: rest.length > 0,
  })
```

`isMoving` が `false` に戻るのは最終セグメント完了時のみ。中間セグメント完了時は `isMoving=true` のままで、`PlayerSprite` 側が `segments[0]` の変化を検知して次セグメントを即座に再生する（要件 5-5）。

---

## コンポーネント設計

各コンポーネントは「1 ファイル 1 クラス（コンポーネント）」「Google docstring 必須」の規約に従う（CLAUDE.md）。

### `features/map/MapScreen.jsx`

ルートコンポーネント。`maps.json` から `map_1` を取り出して `mapStore.initializeMap(mapDef)` をマウント時に呼び、`<svg viewBox="0 0 1920 1080">` を返す。`MapBackground` / `MapPaths` / `Landmarks` / `PlayerSprite` を子に並べる。

CSS Module（`MapScreen.module.css`）で `<svg>` を `width: 100%; height: 100%; aspect-ratio: 16 / 9;` にし、ビューポート内で 16:9 を維持する（要件 1-2）。

### `features/map/MapBackground.jsx`

`<image href="/maps/map_1.png" x=0 y=0 width=1920 height=1080 />` を返すだけの薄いラッパー。

### `features/map/MapPaths.jsx`

`mapDef.edges` をループし、エッジごとに 1 本の `<path>` を生成する（要件 6-2）。

- `d` 属性: `M {from.x},{from.y} Q {control.x},{control.y} {to.x},{to.y}`（二次ベジェ）。
- 各 `<path>` には `data-edge-id="{edge.id}"` を付け、`PlayerSprite` から DOM 経由で `getPointAtLength()` を呼べるようにする（要件 6-4）。
- `stroke` は土の道色（後でアセット差し替え）、`fill="none"`、`pointer-events="none"`（クリックはランドマークでのみ受ける）。

### `features/map/Landmark.jsx`

1 個分のランドマーク。`<g>` に `<image>` か `<circle>` のプレースホルダ、`<text>` でラベル、`onClick` で `mapStore.requestMove(id)` を呼ぶ。`isMoving` 中はカーソルを `default`、それ以外は `pointer` にしてクリック可否を視覚化する（要件 4-5 の体感補助）。本スペックでは画像アセットがまだ無い段階を想定し、円＋ラベルでも要件は満たす。

### `features/map/PlayerSprite.jsx`

`<image>` を 1 つ描画し、`x` / `y` を `useState` で持つ。`mapStore.segments[0]` を購読して、変化があったら以下のループで動かす：

```js
useEffect:
  seg = segments[0]
  if !seg:
    // 静止: currentLocation の座標にスナップ（要件 3-2, 5-3）
    snapTo(landmarkPosition(currentLocation))
    return

  pathEl = document.querySelector(`[data-edge-id="${seg.edgeId}"]`)
  if !pathEl: rAF(retry); return     // マウント直後のレースガード

  total = pathEl.getTotalLength()
  edge  = lookupEdge(seg.edgeId)
  // エッジは "from→to" 方向に描かれている。
  // 移動が逆方向（seg.from === edge.to）なら getPointAtLength の引数を反転する
  reverse = seg.from === edge.to

  start = performance.now()
  duration = SEGMENT_DURATION_MS  // 例: 800ms

  function tick(now):
    t = clamp((now - start) / duration, 0, 1)
    eased = easeInOutQuad(t)                       // 要件 5-4
    len = (reverse ? (1 - eased) : eased) * total
    p = pathEl.getPointAtLength(len)               // 要件 5-2, 6-4
    setPos({ x: p.x, y: p.y })
    if t < 1: rAF(tick)
    else:
      // 最終位置を厳密にスナップ（要件 5-3）
      snapTo(landmarkPosition(seg.to))
      mapStore.advanceSegment()                    // 連続再生（要件 5-5）

  rAF(tick)
```

#### エッジ方向と移動方向の関係

エッジは JSON 上 `from`→`to` の向きで描画されているが、移動は無向グラフ上の任意方向で発生する。`seg.from === edge.from` なら順走（`getPointAtLength(t * total)`）、`seg.from === edge.to` なら逆走（`getPointAtLength((1 - t) * total)`）。これにより各エッジ 1 本の `<path>` で双方向のアニメーションを賄える（要件 6-2 の「エッジ数 = `<path>` 要素数」を維持）。

#### スプライトの内容

初期実装ではプレイヤースプライト画像が無いので、`/sprites/player/idle_00.png` を将来配置する想定で `<image>` を描き、画像が無い段階では暫定的に `<circle>` を出す。アンカーは中央（`transform="translate(-w/2, -h/2)"`）。

---

## ファイル配置

CLAUDE.md の「必要になった時点で作る」「README.md と同期」に従い、以下を本スペックの実装時に追加する。

```
frontend/
├── public/
│   └── maps/
│       └── map_1.png            ← 既存
└── src/
    ├── data/
    │   └── maps.json            ← 新規（マップ定義: landmarks + junctions + edges）
    ├── stores/
    │   └── mapStore.js          ← 新規
    └── features/
        └── map/                 ← 新規
            ├── MapScreen.jsx
            ├── MapScreen.module.css
            ├── MapBackground.jsx
            ├── MapPaths.jsx
            ├── MapPaths.module.css
            ├── Landmark.jsx
            ├── Landmark.module.css
            ├── PlayerSprite.jsx
            ├── findNodeById.js       ← landmark / junction を ID 横断で引く純関数
            └── findShortestPath.js   ← BFS による経路探索（純関数）
```

`App.jsx` は `BattleScreen` のインポートを `MapScreen` に差し替える（要件 1-1）。`BattleScreen` 自体は削除しない（後続スペックで遷移先として再利用する）。

`README.md` の「ディレクトリ構造」セクションに `features/map/` と `data/maps.json` を追記する。同 README の「今後追加予定のディレクトリ」表から該当行があれば削る。

---

## 主要なロジック詳細

### `findShortestPath(adjacency, start, goal)`（純関数）

`mapStore` の経路探索ロジックをテスト容易な純関数として切り出す。引数は隣接リスト（`Map<string, string[]>`）と始点・終点 ID。返り値はノード ID の配列（`[start, ..., goal]`）か、到達不可なら `null`。

連結グラフを前提とするが、防御的に `null` を返せるようにしておくことで、将来「橋が落ちて分断されたマップ」のような表現にも壊れない構造にする。

### イージングと所要時間

- 1 セグメント `SEGMENT_DURATION_MS = 800ms`（仮）。距離に依存させない一定時間で「滑らか」を担保（要件 5-4）。
- イージングは `easeInOutQuad`。直線運動でも違和感が出ないようなだらかな加減速。
- 経由ランドマークを含む経路の場合、経由ノード通過時に **停止フレームを挿入しない**：`advanceSegment` で次セグメントが即座に開始される（要件 5-5）。

### 静止時の挙動

`segments` が空のとき、`PlayerSprite` は `mapStore.currentLocation` から座標を引いて静止描画する（要件 3-2, 5-3）。アニメ完了時の最終座標とこの静止座標が一致するよう、`completeMove`（実体は `advanceSegment` の最終呼び出し）後に明示的に座標スナップを行う。

### クリックガード

要件 4-5 を `mapStore.requestMove` 内で吸収するため、`Landmark` 側に追加のフラグは不要。ただし UX 補助として `isMoving` を購読し、`pointerEvents: "none"` または `cursor: "default"` を当てて視覚的にも無効化する。

---

## エッジケース

| 状況 | 期待動作 | 実現方法 |
|---|---|---|
| 同じランドマークを連打 | 2 度目以降は無視 | `requestMove` 冒頭の同地点ガード（要件 4-4） |
| 移動中に別ランドマークをクリック | 無視 | `requestMove` 冒頭の `isMoving` ガード（要件 4-5） |
| 隣接ランドマークをクリック | 1 セグメントで移動 | BFS が長さ 2 のパスを返す → segments 1 本 |
| 非隣接ランドマークをクリック | 経路上を経由して移動 | BFS が最短経路を返す → segments 複数本（要件 4-3, 5-5） |
| ウィンドウリサイズ | 比率は保たれる | viewBox によるスケール（要件 6-3）。`getPointAtLength` は論理座標で動くので影響なし |
| `<path>` DOM が未マウント | 次フレームで再試行 | `PlayerSprite` の `useEffect` 内ガード |
| マップ画像読み込み失敗 | 道とランドマークは描画継続 | `<image>` のロード失敗は SVG レンダに影響しない |
| 連結されていないノードへの要求 | 何もしない | `findShortestPath` が `null` を返したら `requestMove` は no-op |

---

## 要件との対応表

| 要件 | 対応する設計要素 |
|---|---|
| 1-1 起動で MapScreen | `App.jsx` で `MapScreen` を返す |
| 1-2 16:9 背景 | `MapScreen.module.css` で `aspect-ratio: 16/9` ＋ `<image>` を viewBox 全面 |
| 1-3 道・ランドマーク・キャラを重ねる | 単一 `<svg>` 内のレイヤ順 |
| 2-1 5 ランドマーク（アイコン位置） | `maps.json` の `landmarks[5].position` |
| 2-2 エッジごとに `<path>`（停止点接続） | `MapPaths` が両端ノードの `stopPoint` を端点に 1 本ずつ生成 |
| 2-3 position と stopPoint の分離 | ランドマーク定義に 2 つの座標を持つ（アイコンと道のラインを別軸で調整可能） |
| 2-4 分岐点（junction）はクリック不可のグラフノード | `mapDef.junctions[]` に `id` / `stopPoint` のみで定義。`MapScreen` は `landmarks` のみを `Landmark` コンポーネント化し、junction は描画もクリック判定もしない。BFS は landmark / junction を区別せず adjacency に含める |
| 2-5 分岐構造をデータで表現 | `edges[]` 内で同一ノード（landmark or junction）が複数エッジに現れることで自然に表現 |
| 2-6 JSON 編集だけで反映 | `maps.json` の座標/ID/edges を読み出すだけ |
| 3-1 初期位置は出発点 | `mapStore.initializeMap` が `mapDef.startId` を採用 |
| 3-2 静止 | `segments` 空時は座標スナップ |
| 3-3 startId で切替可 | JSON の `startId` を読むだけ |
| 4-1 クリックで移動開始 | `Landmark.onClick` → `mapStore.requestMove` |
| 4-2 隣接は 1 エッジで | BFS が 2 ノードのパスを返す |
| 4-3 非隣接は最短経由 | BFS による最短経路 → `segments` 複数本 |
| 4-4 同地点クリックは無視 | `requestMove` 冒頭ガード |
| 4-5 移動中クリックは無視 | `requestMove` 冒頭の `isMoving` ガード |
| 5-1〜5-4 滑らかなアニメ | `getPointAtLength` ＋ rAF ＋ `easeInOutQuad` |
| 5-5 経由ノードで停止しない | `advanceSegment` の即時連結再生 |
| 6-1 viewBox | `<svg viewBox="0 0 1920 1080">` |
| 6-2 エッジ数 = `<path>` 数 | `MapPaths` の実装 |
| 6-3 リサイズで崩れない | viewBox スケール |
| 6-4 path 追従 API | `getPointAtLength()` を使用 |

---

## 動作確認方針

CLAUDE.md の方針に従い、コード実装と型・Lint チェックまでを実装フェーズで完了させる。`npm run dev` での目視確認は **ユーザーから明示指示があった場合のみ** 実施する。実施した場合に確認する観点：

- 起動直後、村の門にキャラクターがいる
- 隣接ランドマーク（村の門 → 井戸など）をクリック→ 1 エッジで滑らかに移動する
- 非隣接ランドマーク（村の門 → ストーンサークルなど）をクリック→ 経由ランドマークを通って連続再生する
- 倒木 → 砦 のように井戸を経由する移動でも、井戸で不自然に止まらない
- 移動中の連打が無視される
- ウィンドウサイズ変更でレイアウトが崩れない

確認後の生成物（スクリーンショット等）はコミットしない。
