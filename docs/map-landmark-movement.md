# ランドマーククリックから移動完了までの流れ

マップ画面でユーザーがランドマークをタップしてから、プレイヤーキャラクター
が道に沿って移動し、目的地で停止するまでを、データ・状態・描画の流れに
沿って説明する。

## 全体像

```mermaid
graph TD
    U["ユーザー(クリック)"]
    L["Landmark.jsx"]
    S["mapStore"]
    BFS["findShortestPath (BFS)"]
    SEG["segments (エッジ列)"]
    P["PlayerSprite.jsx"]
    PATH["<path data-edge-id>"]
    GPL["getPointAtLength()"]
    DOM["画面に描画"]

    U -->|onClick| L
    L -->|requestMove(id)| S
    S --> BFS
    BFS -->|ノード ID 列| S
    S -->|エッジに分解| SEG
    SEG -->|購読| P
    P -->|querySelector| PATH
    PATH --> GPL
    GPL -->|x,y 座標| P
    P --> DOM
    P -->|セグメント完了| S
    S -->|advanceSegment| SEG
```

## 登場するデータ

### マップ定義 (`maps.json`)

1 マップ分は `landmarks` / `junctions` / `edges` / `startId` / `viewBox` を
持つ。グラフのノードはクリック可能な「ランドマーク」と、道の分岐点を
表すクリック不可の「分岐点（junction）」の 2 種類があり、BFS の経路探索や
移動セグメントの端点として等しく扱われる。

各ノードは見た目に関わる 2 つの座標を分けて持つ。

| フィールド | 用途 |
|---|---|
| `position` | ランドマークアイコン・ラベル・クリック判定の中心(landmark のみ) |
| `stopPoint` | 道のライン上の停止点(エッジの端点・キャラの停止位置) |

道はアイコンのど真ん中ではなく道路上を通るため、`position` と `stopPoint`
を別軸で持つことで「アイコンは目印の上、移動は道の上」という見せ方を
両立できる。

### `mapStore` (Zustand)

| フィールド | 役割 |
|---|---|
| `mapDef` | 現在表示中のマップ定義 |
| `currentLocation` | プレイヤーが今いるノード ID |
| `isMoving` | 移動中フラグ(クリック抑止 + 描画分岐) |
| `segments` | 残り移動セグメント列(`{edgeId, from, to}` の配列) |
| `adjacency` | 初期化時に 1 度だけ作る隣接リスト |

## ステップごとの流れ

### 1. ランドマークがクリックを受ける

`Landmark.jsx` は SVG `<g>` 上にヒット判定用の透明な大きい円
（`r=32`）と、見た目用の小さい円（`r=14`）、ラベルを描画する。
クリックハンドラは `isMoving` のときは早期 return し、そうでなければ
`onClick(id)` を呼ぶ。

```jsx
const handleClick = () => {
  if (isMoving) {
    return;            // 移動中の連打を握りつぶす(要件 4-5)
  }
  onClick(id);         // = mapStore.requestMove(id)
};
```

`onClick` は `MapScreen` から `mapStore.requestMove` がそのまま渡されている。
ヒット円とドット円を分けているのは、見た目を小さく保ちつつタップしやすい
当たり判定を確保するため。

### 2. `requestMove` がガード判定 → 経路探索 → セグメント化を行う

`mapStore.requestMove(targetId)` は次の順で処理する。

1. 早期 return: `isMoving` / 未初期化 / 同地点クリック / 経路なし、のいずれか。
2. `findShortestPath(adjacency, currentLocation, targetId)` で BFS。
3. 返ったノード ID 列を、隣接ペアごとにエッジを引いて「セグメント」に分解。
4. `set({ segments, isMoving: true })` で一括反映。

```js
for (let i = 0; i < path.length - 1; i += 1) {
  const edge = findEdgeBetween(state.mapDef.edges, path[i], path[i + 1]);
  segments.push({ kind: 'segment', edgeId: edge.id, from: path[i], to: path[i + 1] });
}
set({ segments, isMoving: true });
```

#### なぜ BFS か

道はすべて等しい重み 1 として扱う（要件「経由するランドマーク数が最小」）。
重みの優先度付きキューを使うダイクストラ法は不要で、BFS で十分かつ正しい。

#### なぜ「経路全体」ではなく「エッジ列」に分解するか

描画側はエッジ単位で `<path>` の `getPointAtLength()` を呼ぶため、最初から
エッジに分解しておくと「いま何本目のどの方向に進んでいるか」をストア側で
状態として保持できる。完了通知も「セグメント 1 本分」という単位で扱える。

### 3. `PlayerSprite` が `segments` を購読してアニメする

`PlayerSprite.jsx` は `mapStore.segments` を購読し、`useEffect` の中で
先頭セグメントが存在する間だけ `requestAnimationFrame` ループを起動する。

```jsx
const segment = segments[0];
if (!segment) return;             // 静止中は effect では何もしない

const pathEl = document.querySelector(`[data-edge-id="${segment.edgeId}"]`);
const total = pathEl.getTotalLength();
// 等速移動：所要時間はエッジ長に比例（duration = total / speed）。
// 進行率は線形のまま使うことで px/ms が一定になる。
const duration = total / SEGMENT_SPEED_PX_PER_MS;
const progress = Math.min(1, (now - startTimestamp) / duration);
const length = (reverse ? 1 - progress : progress) * total;
const point = pathEl.getPointAtLength(length);
setAnimPos({ x: point.x, y: point.y });
```

#### 等速移動（イージングなし、所要時間はエッジ長に比例）

セグメントごとに固定時間（例: 800ms）でアニメすると、長いエッジほど
速く見え、短いエッジほど遅く見えてしまい「ランドマーク間の歩く速度」
が不揃いになる。これを防ぐため、duration をエッジ長に応じて算出する
方式（`duration = totalLength / SEGMENT_SPEED_PX_PER_MS`）を採用し、
進行率にイージングを掛けずに線形のまま `length` を求める。結果として
全セグメントで `px/ms`（= キャラの見かけの速度）が一定になる。

#### `<path data-edge-id>` を経由する理由

`MapPaths.jsx` は各エッジの SVG `<path>` に `data-edge-id` を付けて描画して
いる。`PlayerSprite` は DOM を `querySelector` で引いて `getPointAtLength`
を呼ぶことで、二次ベジェ曲線に沿った正確な点を毎フレーム得る。直線補間
だと曲がった道の上をキャラが滑って見えるため、わざと曲線描画 + 曲線サンプ
リングにしている。

#### 順走 / 逆走の向き

エッジ定義の `from`/`to` 順とセグメントの進行方向が逆になり得るので、
`reverse = segment.from === edge.to` を見て `length` を `1 - eased` で反転
する。これがないと「片方向にだけ正しく進んで、逆方向は止まって見える」
バグになる。

#### `<path>` がまだ DOM にいない初回フレーム対策

`querySelector` が `null` を返すフレームでは何もせずに `requestAnimationFrame`
で次フレームに再試行する。マウント直後に effect が `<path>` より先に走って
しまうレースを防ぐため。

#### 静止位置を `state` に持たない理由

`segments` が空の静止時、effect 内で同期的に `setState` するとリアクトの
`set-state-in-effect` 警告に抵触する。代わりに render 側で
`findNodeById(mapDef, currentLocation).stopPoint` を直接参照して描画する
（`idlePosition`）。これにより静止 ⇄ 移動の切替で描画位置が一意に決まる。

#### 連続するセグメント間でジャンプしない理由

セグメント完了時に「目的地の `stopPoint` に明示スナップ」してから
`advanceSegment` を呼ぶ。完了直後の `currentLocation` は新しい起点 ID に
更新され、その `stopPoint` は前セグメントの最終位置と同一なので、次の
effect 実行までの 1 フレームで描画位置がずれない。

### 4. `advanceSegment` がストアを 1 セグメント進める

セグメント完了時、`PlayerSprite` は `mapStore.advanceSegment()` を呼ぶ。

```js
advanceSegment: () => set((state) => {
  if (state.segments.length === 0) return {};
  const [head, ...rest] = state.segments;
  return {
    currentLocation: head.to,
    segments: rest,
    isMoving: rest.length > 0,    // 残りがあれば true のまま連続再生
  };
}),
```

- `currentLocation` を到達ノードに進める。
- 残りセグメントがあれば `isMoving=true` のまま、次の effect 実行で連続再生。
- 残りが空なら `isMoving=false` にして、ランドマークのクリック抑止を解除。

### 5. 描画位置が反映され、必要なら次のセグメントへ

ストアの更新で `PlayerSprite` が再レンダリングされ、`useEffect` の依存
（`segments`）が変わって effect が再走する。

- 残りセグメントがあるとき: 新しい `segments[0]` で `<path>` を引き直して
  アニメ続行。
- 空のとき: effect 内では何もせず、render 側の `idlePosition` で目的地に
  停止して見える。

## 1 クリックのライフサイクル(時系列)

```
t=0 ms     : ユーザーがランドマーク B をクリック
             → Landmark.handleClick(B) → mapStore.requestMove("B")
t=0 ms     : BFS で [A, j1, B] を得て、segments=[{A→j1},{j1→B}]、isMoving=true
t=0 ms+    : PlayerSprite の effect が再走、segments[0]={A→j1} のループ開始
t=~0..d1   : A→j1 を等速で線形補間描画（d1 = エッジ長 / SPEED）
t=~d1      : 完了スナップ → advanceSegment()
             → currentLocation="j1"、segments=[{j1→B}]、isMoving=true
t=~d1+     : effect 再走、{j1→B} のループ開始
t=~d1+d2   : 完了スナップ → advanceSegment()
             → currentLocation="B"、segments=[]、isMoving=false
             → ランドマークが再びクリック可能になる
```

## 関連ファイル一覧

| ファイル | 役割 |
|---|---|
| `frontend/src/data/maps.json` | ランドマーク・分岐点・エッジ・開始地点の静的定義 |
| `frontend/src/features/map/MapScreen.jsx` | マップ画面のルート、ストア初期化、ランドマーク列の描画 |
| `frontend/src/features/map/Landmark.jsx` | 1 ランドマークの描画とクリック受付(`isMoving` で抑止) |
| `frontend/src/features/map/MapPaths.jsx` | エッジを `<path data-edge-id>` として描画(二次ベジェ) |
| `frontend/src/features/map/PlayerSprite.jsx` | プレイヤー描画と `requestAnimationFrame` 駆動の補間移動 |
| `frontend/src/features/map/findShortestPath.js` | BFS で最短経路(エッジ数最小)を求める純関数 |
| `frontend/src/features/map/findNodeById.js` | landmark / junction を横断してノード定義を引く純関数 |
| `frontend/src/stores/mapStore.js` | 現在地・移動中フラグ・残りセグメントの一元管理 |

## 関連する設計ドキュメント

- 要件定義: `.specs/map-landmark-movement/requirements.md`
- 設計書: `.specs/map-landmark-movement/design.md`
- タスク一覧: `.specs/map-landmark-movement/tasks.md`
