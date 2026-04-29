# タスク一覧: 実行ボタン（ビジュアル進行のみ）

## 概要

まず SVG アセットと `battleStore` の拡張を並行で進め、土台を作る。次に `PlayButton` コンポーネントを作成し、`BattleScreen` に組み込んでボタンが画面に出る状態を実現する。続いて既存ボタン（Reset / Zoom）の `disabled` 化を入れて操作ロックを完成させ、最後にハイライト系（ノードの点滅 → エッジ上の光の点）を実装する。タスク 4 完了時点で「ボタンが見える・配置完了で押せる・拡大時は縮小してから実行が走る」が成立し、タスク 6・7 でビジュアル演出が完成する。

合計タスク数：7件 ｜ 想定工数：約 5 時間

## タスク

- [ ] **1. `play.svg` を新規作成する**
  - 内容：
    - `frontend/public/icons/flowchart/play.svg` を新規作成。viewBox `0 0 24 24`、緑色（`#66dd6e`）の単色で構成
    - 縦線 1 本（x=4、y=4〜20、stroke-width 3、`stroke-linecap: round`）
    - 右向き三角形（頂点 `(9, 4)`、`(9, 20)`、`(20, 12)`、塗りつぶし）
    - 結果として「左に縦線、その右に三角形の左辺」が並んで二重線に見える形状
  - ファイル：`frontend/public/icons/flowchart/play.svg`（新規）
  - 依存：なし
  - 完了条件：`npm run build` がパスし、ビルド成果物 `dist/icons/flowchart/play.svg` にファイルが含まれる

- [ ] **2. `battleStore` に実行状態とアクションを追加する**
  - 内容：
    - 状態：`isExecuting: boolean`（初期 `false`）、`executionStep: { type: 'node' | 'edge', id: string } | null`（初期 `null`）、`currentPhaseMs: number | null`（初期 `null`、エッジアニメ用）
    - 定数：`EXECUTION_PER_CARD_MS = 2000`（モジュールトップに）
    - ヘルパー関数 `buildExecutionPath(stage)`：`stage.edges` で `source -> target` のマップを構築し、`'start'` から `'goal'` まで辿って `[{type:'node',id:'start'}, {type:'edge',id:'e-start-1'}, {type:'node',id:'slot-1'}, ..., {type:'node',id:'goal'}]` の配列を返す。`'goal'` に到達できない場合は途中までで打ち切り（ガード）
    - セレクタ `selectAllSlotsFilled(state)`：`Object.values(state.slotAssignments).every((card) => card !== null)` を返すモジュールスコープの関数として export
    - アクション `startExecution(stage)`：以下の擬似コードに従う
      ```js
      if (state.isExecuting || state.isTransitioning) return;
      if (!selectAllSlotsFilled(state)) return;
      const beginSequence = () => {
        const phases = buildExecutionPath(stage);
        const T = stage.slots.length * EXECUTION_PER_CARD_MS;
        const phaseMs = T / phases.length;
        set({ isExecuting: true, currentPhaseMs: phaseMs });
        phases.forEach((phase, i) => setTimeout(() => set({ executionStep: phase }), i * phaseMs));
        setTimeout(() => set({ isExecuting: false, executionStep: null, currentPhaseMs: null }), phases.length * phaseMs);
      };
      if (state.isExpanded) {
        set({ isExpanded: false, isTransitioning: true });
        setTimeout(() => { set({ isTransitioning: false }); beginSequence(); }, TRANSITION_DURATION_MS);
      } else {
        beginSequence();
      }
      ```
    - クラス／関数の docstring は Google スタイル日本語
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：なし
  - 完了条件：`npm run lint` がパスし、ブラウザコンソールから `useBattleStore.getState().startExecution(stage)` を呼ぶと `isExecuting` が `true` になり、`phases.length × phaseMs` ms 後に `false` に戻ることを確認できる。動作中 `executionStep` が時系列に変化する

- [ ] **3. `PlayButton` コンポーネントを新規作成する**
  - 内容：
    - ストアから以下を購読：
      - `isExecuting`、`isTransitioning`、`startExecution`
      - `selectAllSlotsFilled`（セレクタとして購読）
    - `disabled` 判定：`isExecuting || isTransitioning || !allSlotsFilled`
    - クリック：`startExecution(stage)`
    - 内部に `<img src="/icons/flowchart/play.svg" alt="" draggable={false} />`、`aria-label="実行"`
    - CSS（`PlayButton.module.css`）：
      - `.button { padding: 0.35rem 0.75rem; display: inline-flex; align-items: center; justify-content: center; background: #1f1f28; border: 1px solid #3a3a45; border-radius: 4px; cursor: pointer; transition: background-color 0.15s, border-color 0.15s, opacity 0.15s; }`
      - `.button:hover:not(:disabled) { background: #2a2a33; border-color: #5a5a66; }`
      - `.button:active:not(:disabled) { background: #15151c; }`
      - `.button:disabled { opacity: 0.4; cursor: not-allowed; }`
      - `.icon { width: 1rem; height: 1rem; display: block; }`
    - Google 形式の日本語 docstring
  - ファイル：`frontend/src/features/battle/flowchart/PlayButton.jsx`（新規）、`frontend/src/features/battle/flowchart/PlayButton.module.css`（新規）
  - 依存：タスク1、タスク2
  - 完了条件：`npm run lint` がパスし、他コンポーネントから import してビルドエラーが出ない

- [ ] **4. `BattleScreen` に `PlayButton` を統合し、`.executing` クラスとボタングループ縦並びを反映する**
  - 内容：
    - `BattleScreen.module.css`：
      - `.flowchartControls` を `flex-direction: column; align-items: stretch;` に変更
      - 新規 `.flowchartControls > .topRow { display: flex; gap: 0.5rem; }` を追加
      - 新規 `.root.executing { pointer-events: none; }` を追加
    - `BattleScreen.jsx`：
      - `import PlayButton from './flowchart/PlayButton';`
      - `useBattleStore((s) => s.isExecuting)` を購読
      - ルート `<section>` の className 計算で `isExecuting && styles.executing` を追加
      - `.flowchartControls` の中身を以下に置き換え：
        ```jsx
        <div className={styles.flowchartControls}>
          <div className={styles.topRow}>
            <ZoomButton />
            <ResetButton stage={stage} />
          </div>
          <PlayButton stage={stage} />
        </div>
        ```
      - docstring を「実行ボタンも含む 3 ボタン構成」と書き換え
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`、`frontend/src/features/battle/BattleScreen.module.css`
  - 依存：タスク3
  - 完了条件：`npm run lint` / `npm run build` がパスし、ブラウザで以下が動く：
    - フローチャート右上に `[Zoom][Reset]` の横並びがあり、その下に細長い `Play` ボタン
    - 全スロットを埋めると Play ボタンがハッキリした見た目に、空きがあれば薄くなる（disabled）
    - Play ボタンを押すと、拡大中なら 0.25 秒で縮小してから（縮小中なら即）実行が始まる
    - 実行中は手札のドラッグ・他ボタンクリックが効かない
    - 実行が終わったら全ロックが解除され、配置は実行前と同じ

- [ ] **5. `ResetButton` / `ZoomButton` を `disabled` 化する**
  - 内容：
    - `ResetButton.jsx`：`useBattleStore((s) => s.isExecuting || s.isTransitioning)` を購読し、`<button disabled={lockState}>` を渡す
    - `ZoomButton.jsx`：同上
    - CSS（`ResetButton.module.css` / `ZoomButton.module.css`）：
      - `.button:disabled { opacity: 0.4; cursor: not-allowed; }` を追加
      - 既存の `:hover` を `:hover:not(:disabled)` に書き換え（disabled 時にホバー反応しないため）
      - 同様に `:active` も `:not(:disabled)` 対応に
  - ファイル：`frontend/src/features/battle/flowchart/ResetButton.jsx`、`frontend/src/features/battle/flowchart/ResetButton.module.css`、`frontend/src/features/battle/flowchart/ZoomButton.jsx`、`frontend/src/features/battle/flowchart/ZoomButton.module.css`
  - 依存：タスク2
  - 完了条件：`npm run lint` がパスし、ブラウザで実行中に Reset/Zoom ボタンを押しても反応しない（クリックが効かず、見た目が薄く・カーソルが not-allowed になる）

- [ ] **6. `StartNode` / `SlotNode` / `GoalNode` にハイライト演出を組み込む**
  - 内容：
    - 各ノードコンポーネント（`StartNode.jsx` / `SlotNode.jsx` / `GoalNode.jsx`）で `useBattleStore((s) => s.executionStep?.type === 'node' && s.executionStep?.id === MY_ID)` を購読
      - `MY_ID` は `StartNode` → `'start'`、`GoalNode` → `'goal'`、`SlotNode` → `props.id`
      - 真のとき className に `styles.active` を追加
    - CSS：
      - `StartNode.module.css` / `GoalNode.module.css`：`.marker.active` でアイコンを発光させる（例：`filter: drop-shadow(0 0 6px #fff) brightness(1.5);` を `animation: highlight 0.2s ease-in-out 3 alternate;` の `keyframes` 内に組み込み）
      - `SlotNode.module.css`：`.slot.active.filled` で内側の `DraggableCard` を点滅（同様の `animation` で `brightness` を変化させる）
      - `@keyframes` の名前は `playHighlight` 等、既存と衝突しないものに
    - SlotNode は親に `.active` を付け、子の `DraggableCard`（`.fill > div`）の `filter` プロパティを波及させる
  - ファイル：`frontend/src/features/battle/flowchart/StartNode.jsx`、`StartNode.module.css`、`SlotNode.jsx`、`SlotNode.module.css`、`GoalNode.jsx`、`GoalNode.module.css`
  - 依存：タスク2
  - 完了条件：`npm run lint` / `npm run build` がパスし、ブラウザで Play ボタン押下後、スタートマーカー → 各カード → ゴールマーカーが順番に点滅・発光する（エッジは未実装なので光の点はまだ見えない）

- [ ] **7. `AnimatedProgressEdge` を作成し、エッジ上に光の点を走らせる**
  - 内容：
    - 新規 `AnimatedProgressEdge.jsx`：
      - React Flow のカスタムエッジ仕様に従い、`{ id, sourceX, sourceY, targetX, targetY, markerEnd }` を props で受ける
      - `getStraightPath({ sourceX, sourceY, targetX, targetY })` で `[edgePath]` を取得
      - `useBattleStore((s) => s.executionStep?.type === 'edge' && s.executionStep?.id === id)` で `isActive` を購読
      - `useBattleStore((s) => s.currentPhaseMs ?? 666)` で `phaseMs` を購読
      - JSX：
        ```jsx
        <>
          <path id={`edge-${id}`} className="react-flow__edge-path" d={edgePath} markerEnd={markerEnd} />
          {isActive && (
            <circle r="4" fill="#66dd6e">
              <animateMotion dur={`${phaseMs}ms`} path={edgePath} fill="freeze" />
            </circle>
          )}
        </>
        ```
      - Google 形式の日本語 docstring
    - `FlowchartArea.jsx`：
      - `import AnimatedProgressEdge from './AnimatedProgressEdge';`
      - 新規定数 `const edgeTypes = { 'animated-progress': AnimatedProgressEdge };` をモジュールトップに
      - `edgesToFlowEdges` の戻り値の各エッジに `type: 'animated-progress'` を追加
      - `<ReactFlow>` プロップに `edgeTypes={edgeTypes}` を追加
  - ファイル：`frontend/src/features/battle/flowchart/AnimatedProgressEdge.jsx`（新規）、`frontend/src/features/battle/flowchart/FlowchartArea.jsx`
  - 依存：タスク2、タスク6
  - 完了条件：`npm run lint` / `npm run build` がパスし、ブラウザで Play ボタン押下後の以下が確認できる：
    - スタートマーカー → エッジ上を緑の光の点が走る → スロット 1 のカード点滅 → 次のエッジ → ... → ゴールマーカー の流れが視覚的に追える
    - 各フェーズの所要時間がほぼ等しく、全体で「スロット数 × 2 秒」程度
    - 実行が終わったら全ハイライトが消え、配置は実行前と同じ
    - 拡大状態から Play を押すと、まず縮小されてから実行が始まる
    - 実行中は手札・他ボタンが操作できない
