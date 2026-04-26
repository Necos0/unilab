# タスク一覧: カード配置（ドラッグ＆ドロップ）

## 概要

まずゲーム状態の土台となる `battleStore`（Zustand）を作り、`BattleScreen` に `DndContext` を配線して状態を初期化できる状態まで持っていく。次に `DraggableCard` ラッパーを作り、`Hand` → `SlotNode` の順で接続することで、最短でドラッグ＆ドロップが動く最小ループを成立させる。最後に `DragOverlay` とハイライト CSS で視覚的フィードバックを整える。README のディレクトリ構造更新は `stores/` 新設と同じタスクに含める（CLAUDE.md の同期ルール）。

合計タスク数：7件 ｜ 想定工数：約 5.5 時間

## タスク

- [ ] **1. `battleStore.js` を新規作成し、README のディレクトリ構造を更新する**
  - 内容：Zustand で `battleStore` を実装する。
    - 状態：`handCards: CardInstance[]`、`slotAssignments: Record<slotId, CardInstance | null>`、`activeInstanceId: string | null`
    - 型：`CardInstance = { instanceId: string, id: string, power: number }`
    - アクション：
      - `initializeBattle(stage)` — `stage.cards` を `instanceId: "c-<index>"` を付けて `handCards` に展開、`stage.slots` から `slotAssignments` を全て `null` で初期化、`activeInstanceId` を `null` に
      - `beginDrag(instanceId)` — `activeInstanceId` をセット
      - `endDrag({ instanceId, source, destination })` — 設計書の 7 パターン分岐（`source='hand' | slotId`、`destination=slotId | null`）を実装し、最後に `activeInstanceId` を `null` に
    - クラス／関数の docstring は Google スタイルで日本語記述（CLAUDE.md 準拠）
  - 併せて `README.md` の「ディレクトリ構造」セクションに `frontend/src/stores/` を追加し、「今後追加予定のディレクトリ」表から `frontend/src/stores/` の行を削除する
  - ファイル：`frontend/src/stores/battleStore.js`（新規）、`README.md`
  - 依存：なし
  - 完了条件：`npm run lint` がパスし、ブラウザ開発者ツールから `useBattleStore.getState()` 相当の API で全アクションが期待通りの状態遷移を起こすことを確認できる（ブラウザ動作確認は本タスクでは任意、最終タスクでまとめて行う）。README に `stores/` が反映されている

- [ ] **2. `BattleScreen` に `DndContext` を配線し、ストアを初期化する**
  - 内容：
    - `BattleScreen` をマウント時に `initializeBattle(stage)` を呼ぶ（`useEffect` でステージをストアに流し込む）
    - ルート直下を `DndContext` でラップ。`PointerSensor` と `TouchSensor` を `activationConstraint: { distance: 4 }` で登録
    - `onDragStart={(e) => beginDrag(e.active.id)}`、`onDragEnd={(e) => endDrag({ instanceId: e.active.id, source: e.active.data.current?.source, destination: e.over?.id ?? null })}`
    - ステージ由来の `stage.cards` を `Hand` に prop で渡していた箇所を削除（今後 `Hand` はストア購読に切り替わる）。スロット定義（`stage.slots` / `stage.edges`）は React Flow のレンダリングに必要なので `FlowchartArea` には引き続き渡す
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`
  - 依存：タスク1
  - 完了条件：`npm run lint` がパスし、既存レンダリングに視覚的退行がないこと（敵・スロット・手札が従来通り表示される）。ドラッグは未実装のため実際に持ち上がらないが、コンソールにエラーが出ないことを確認

- [ ] **3. `DraggableCard` コンポーネントを新規作成する**
  - 内容：既存の `Card` を `useDraggable` でラップする薄いコンポーネントを作る。
    - props：`card: CardInstance`、`source: 'hand' | string`
    - `useDraggable({ id: card.instanceId, data: { source } })`
    - `ref` / `listeners` / `attributes` をルート div に適用し、中に `<Card card={card} />` を描画
    - ストアから `activeInstanceId` を購読し、自身が対象のとき CSS Modules で半透明スタイル（`opacity: 0.3`）を付与
    - Docstring（Google 形式、日本語）
  - ファイル：`frontend/src/features/cards/DraggableCard.jsx`（新規）、`frontend/src/features/cards/DraggableCard.module.css`（新規）
  - 依存：タスク1
  - 完了条件：`npm run lint` がパスし、単体では使用箇所がないが、他コンポーネントから import してビルドエラーが出ない

- [ ] **4. `Hand` をストア購読＋`DraggableCard` 描画に切り替える**
  - 内容：
    - `cards` props を廃止し、`useBattleStore((s) => s.handCards)` で手札を購読
    - 各カードを `DraggableCard` で描画（`source='hand'`）
    - 同一 `id` カードが複数あっても `instanceId` を `key` として使い、React 警告を避ける
    - Docstring の更新（props なし、ストア駆動であることを記述）
  - ファイル：`frontend/src/features/cards/Hand.jsx`
  - 依存：タスク1、タスク2、タスク3
  - 完了条件：`npm run lint` がパスし、ブラウザで手札が従来通り表示され、手札カードをマウスで掴んで動かせる（現段階ではドロップ先が未実装なので、離すと元に戻るだけでよい）

- [ ] **5. `SlotNode` を Droppable 化し、配置済みカードを `DraggableCard` で描画する**
  - 内容：
    - `SlotNode` で `useDroppable({ id: props.id })` を登録
    - ストアから `slotAssignments[props.id]` と `activeInstanceId` を購読
    - 割当があれば `<DraggableCard card={assigned} source={props.id} />` を内側に描画
    - 割当があるかどうかで、ルートの CSS クラスを切替（割当あり：空きスロットの点線枠は消し、カードが収まる見た目に／割当なし：既存の点線枠）
    - 既存の `Handle` 2 つ（source / target）は残し、見た目は今まで通り非表示のまま
    - Docstring 更新
  - ファイル：`frontend/src/features/battle/flowchart/SlotNode.jsx`、`frontend/src/features/battle/flowchart/SlotNode.module.css`
  - 依存：タスク1、タスク3、タスク4
  - 完了条件：`npm run lint` がパスし、ブラウザで以下が動く：
    - 手札のカードをスロットにドロップ → 手札から消えてスロットに表示される
    - スロット上のカードを別の空きスロットにドロップ → 移動する
    - 配置済みスロットに別のカードをドロップ → 元のカードが手札末尾に戻り、新カードが配置される
    - スロット上のカードをスロット外にドロップ → 手札に戻り、スロットは空になる
    - 手札のカードをスロット外にドロップ → 手札のまま（何も起きない）

- [ ] **6. 視覚フィードバックを仕上げる（`DragOverlay` とハイライト）**
  - 内容：
    - `BattleScreen` に `DragOverlay` を追加。`activeInstanceId` が `null` でないときだけ中身をレンダリングし、ストアから対象の `CardInstance` を引いて `<Card card={...} />` を表示
    - `SlotNode.module.css` にハイライト用のクラスを追加：
      - ドラッグ中（`activeInstanceId !== null`）：全スロットに控えめな枠色変更（例：`#6a6a78` → `#9a9aab`）
      - `isOver === true`：強めのアクセント（例：枠色をさらに明るく、背景を薄く塗る）
    - `SlotNode.jsx` で `useDroppable` から返る `isOver` と、ストアから購読した `activeInstanceId` の有無でクラスを付け替え
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`、`frontend/src/features/battle/flowchart/SlotNode.jsx`、`frontend/src/features/battle/flowchart/SlotNode.module.css`
  - 依存：タスク5
  - 完了条件：`npm run lint` がパスし、ブラウザで以下が確認できる：
    - カードをドラッグすると、掴んだカードがポインタに追従する（`DragOverlay`）
    - ドラッグ中、手札の元位置は半透明化している
    - ドラッグ中、スロットからドラッグしたときは元のスロットが空表示になっている
    - ドラッグ中、全スロットの枠色がわずかに変化してドロップ候補であることを示す
    - ポインタがスロット上にあるとき、そのスロットだけ強めにハイライトされる
    - 同じスロットに戻すようにドロップしても状態が変わらない（要件 3-4）

- [ ] **7. リセットボタンを実装する**
  - 内容：
    - 新規コンポーネント `ResetButton` を作成し、クリック時に `initializeBattle(stage)` を再実行して手札・スロットを初期化する。`stage` は `BattleScreen` から props で受け取る
    - 見た目は既存のダーク基調に合わせた控えめなボタン（背景 `#1f1f28`、文字 `#e5e5ff`、角丸、`ZoomButton` と同じパディング比率）。**ボタン内容は `/icons/flowchart/reset.svg` の円環状矢印アイコンを `<img>` で表示** し、テキストは表示しない（意味は `aria-label="リセット"` で支援技術に伝える）。要件7-6
    - SVG アセット（円環状矢印）を `frontend/public/icons/flowchart/reset.svg` に新規作成。viewBox `0 0 24 24`、`currentColor` 指定でボタンの文字色を継承させる
    - `BattleScreen.module.css` の `flowchartArea` を `position: relative` にし、`ResetButton` を親の `.flowchartControls`（`flowchart-zoom` スペックで導入）の中に並べて配置
    - Docstring（Google 形式、日本語）
  - ファイル：`frontend/src/features/battle/flowchart/ResetButton.jsx`（新規）、`frontend/src/features/battle/flowchart/ResetButton.module.css`（新規）、`frontend/src/features/battle/BattleScreen.jsx`、`frontend/src/features/battle/BattleScreen.module.css`、`frontend/public/icons/flowchart/reset.svg`（新規）
  - 依存：タスク1、タスク2
  - 完了条件：`npm run lint` / `npm run build` がパスし、ブラウザで以下が確認できる：
    - フローチャート領域の右上に円環状矢印アイコンのリセットボタンが表示される
    - スロットにカードを配置した状態でボタンを押すと、全てのスロットが空になり、手札が `stages.json` の初期順序で復元される
    - スロットが全て空のときにボタンを押しても状態が変わらずエラーも出ない（冪等）
    - `ZoomButton` と並んだときに高さ・縦中央位置が揃って見える
