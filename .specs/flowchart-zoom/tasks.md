# タスク一覧: フローチャート拡大／縮小トグル

## 概要

先に `battleStore` に拡大状態・遷移中フラグとトグルアクションを追加して土台を作る。次に `ZoomButton` を新規作成し、レイアウト用 CSS を更新（`BattleScreen` / `ResetButton`）、それから `BattleScreen.jsx` 側でボタングループとクラス付与をまとめて反映する。最後に `FlowchartArea` を改修し、`ResizeObserver` と `fitView` で CSS トランジションに追従する自動スケーリング＋`panOnScroll` による拡大時スクロールを組み込む。全タスク完了時点で、縮小⇄拡大の切替・アニメ中のブロック・両状態でのドラッグ&ドロップが揃う。

合計タスク数：5件 ｜ 想定工数：約 3.5 時間

## タスク

- [ ] **1. `battleStore` に拡大／縮小状態とトグルアクションを追加する**
  - 内容：
    - 状態：`isExpanded: boolean`（初期 `false`）、`isTransitioning: boolean`（初期 `false`）を追加
    - アクション：`toggleExpand()` を追加。`isTransitioning` が `true` のときは早期リターン（連打ガード）。そうでなければ `isExpanded` を反転し `isTransitioning = true` に設定、`setTimeout` で 250ms 後に `isTransitioning = false` を再セット
    - `initializeBattle` は変更しない（Zustand の部分マージで `isExpanded` は保たれる）
    - クラス／関数には Google 形式の日本語 docstring を付ける
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：なし
  - 完了条件：`npm run lint` がパスし、ブラウザ開発者ツールから `useBattleStore.getState().toggleExpand()` を連続で呼んでも `isTransitioning` 中は状態が変化しないことを確認できる（動作確認は最終タスクでまとめて行う）

- [ ] **2. `ZoomButton` コンポーネントを新規作成する**
  - 内容：
    - `battleStore` から `isExpanded` / `toggleExpand` を購読
    - `isExpanded` によりラベルを「↑」（縮小状態）／「↓」（拡大状態）で切替
    - `onClick={toggleExpand}` でトグル
    - CSS は既存 `ResetButton.module.css` と同じトーン（背景 `#1f1f28`、ボーダー `#3a3a45`、文字色 `#e5e5ff`、角丸 4px、パディング 0.35rem 0.75rem、ホバー・アクティブ色は `ResetButton` と同一）。位置指定は持たない（親のボタングループが担う）
    - Google 形式の日本語 docstring
  - ファイル：`frontend/src/features/battle/flowchart/ZoomButton.jsx`（新規）、`frontend/src/features/battle/flowchart/ZoomButton.module.css`（新規）
  - 依存：タスク1
  - 完了条件：`npm run lint` がパスし、他コンポーネントから import してビルドエラーが出ない

- [ ] **3. レイアウト用 CSS を更新する（`BattleScreen` / `ResetButton`）**
  - 内容：
    - `BattleScreen.module.css`：
      - `.enemyArea`、`.flowchartArea` に `transition: flex-grow 0.25s ease;` を追加
      - `.root.expanded .enemyArea { flex-grow: 0; }`、`.root.expanded .flowchartArea { flex-grow: 80; }` を追加
      - `.root.transitioning { pointer-events: none; }` を追加
      - 既存 `.flowchartArea` の `position: relative` はそのまま（絶対配置の基準）
      - 新規 `.flowchartControls { position: absolute; top: 0.5rem; right: 0.5rem; z-index: 10; display: flex; gap: 0.5rem; }`
    - `ResetButton.module.css`：`.button` から `position: absolute; top: 0.5rem; right: 0.5rem; z-index: 10;` を削除（padding・color・background・border・hover・active などは残す）
  - ファイル：`frontend/src/features/battle/BattleScreen.module.css`、`frontend/src/features/battle/flowchart/ResetButton.module.css`
  - 依存：なし（純 CSS、他タスクと並行着手可能だがレビュー範囲を絞るため順序付け）
  - 完了条件：`npm run lint` がパスし、`npm run build` が成功する（この時点ではブラウザ上でボタングループ構造がないためリセットボタンが左上に寄って見えるが、次タスクで直る）

- [ ] **4. `BattleScreen.jsx` でボタングループとクラス条件付与を反映する**
  - 内容：
    - `battleStore` から `isExpanded` / `isTransitioning` を購読
    - ルート `<section>` の className に `styles.expanded`（`isExpanded` の時）と `styles.transitioning`（`isTransitioning` の時）を条件付きで追加
    - `flowchartArea` 内の `<ResetButton />` 呼び出しを、`<div className={styles.flowchartControls}> <ZoomButton /> <ResetButton stage={stage} /> </div>` に置き換える（ZoomButton が左、ResetButton が右の並び）
    - 既存の `DndContext` / `DragOverlay` / 敵・手札描画は変更しない
    - docstring を拡大／縮小状態を扱う旨に更新
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`
  - 依存：タスク1、タスク2、タスク3
  - 完了条件：`npm run lint` / `npm run build` がパスし、ブラウザで以下が動く：
    - フローチャート右上に「↑」「リセット」が横並びで表示される
    - 「↑」を押すと敵エリアが消え、フローチャートが上方向に広がる（ただしスロットのサイズ調整はまだ未実装なので、スロット位置は元のまま）
    - 「↓」で元に戻る
    - アニメ中は他のボタンや手札のカードに触れない
    - リセットボタンを押しても拡大／縮小状態は維持される

- [ ] **5. `FlowchartArea` に自動スケーリングとスクロールを組み込む**
  - 内容：
    - `useRef` で ReactFlow インスタンスを保持し、`onInit={(instance) => { ref.current = instance; }}` で取得
    - `useEffect` で `.canvas` 要素に `ResizeObserver` を張り、resize ごとに `reactFlowInstance.fitView({ padding: 0.1, minZoom: isExpanded ? 1 : undefined, maxZoom: isExpanded ? 1 : undefined, duration: 0 })` を呼ぶ
    - `panOnScroll={isExpanded}` を `ReactFlow` に渡す（縮小時は `false`、拡大時は `true`）
    - `battleStore` から `isExpanded` を購読する（FlowchartArea は props で受け取らずストアから直接取る）
    - クリーンアップで `ResizeObserver.disconnect()` を呼ぶ
    - 既存の `nodesDraggable={false}` / `elementsSelectable={false}` / `panOnDrag={false}` / `zoomOnScroll={false}` 等は維持
    - docstring を拡大／縮小時のスケーリング戦略に言及する形で更新
    - 実装中の微調整：縮小時に React Flow が過度に拡大表示する場合は、`maxZoom: 1` を縮小時にも付けて抑える（動作確認しつつ決める）
  - ファイル：`frontend/src/features/battle/flowchart/FlowchartArea.jsx`
  - 依存：タスク1、タスク4
  - 完了条件：`npm run lint` / `npm run build` がパスし、ブラウザで以下が動く：
    - 縮小状態で戦闘画面を開くと、全スロットが縮小エリアに収まって表示される（現状 1 行なので見た目は変わらない可能性大）
    - 拡大状態に切り替えると、スロットが原寸（80×120）で表示される
    - 切替アニメ中もスロットが滑らかにスケール変化する（カクっと跳ねない）
    - 拡大状態でフローチャートがエリアに収まらない場合、スクロールホイールで表示範囲を動かせる
    - 縮小・拡大どちらの状態でも、カードのドラッグ&ドロップ（手札→スロット、スロット間入れ替え、スロット→手札への撤回）が既存仕様どおり動作する
    - アニメ中はドラッグ操作を開始できない（pointer-events: none でブロック）
