# タスク一覧: for ループノード（stage 4-2 「for 文」）

## 概要

state 層（`battleStore` の `forLoopCounters` 管理）→ 実行ロジック（execution 分岐）→ 条件式評価（`forCounter()` 構文）→ シミュレータ同期（`simulateBattle`）→ UI 層（新ノード JSX + CSS）→ 統合層（`FlowchartArea` の `nodeTypes`）というボトムアップ順で進める。各タスクは前タスクの完了に依存するが、UI（タスク5）は state を触らないので条件式評価（タスク3）以前でも作れる。stage 4-2 の JSON 定義そのものはユーザー側実装のため本タスク一覧には含めない。

合計タスク数：6件 ｜ 想定工数：4〜6 時間

## タスク

- [x] **1. `battleStore` に for ループの state・action・初期化／リセット経路を追加**  ✓ 完了
  - 内容：
    - 初期 state に **`forLoopCounters: {}`** と **`forLoopIterations: {}`** を追加
    - 新 action **`decrementForLoopCounter(forLoopId)`** を追加。`Math.max(0, current - 1)` で 0 クランプ、`counterValues` 系の不変更新パターンを踏襲
    - `initializeBattle(stage)` の set 内で **`forStarts` 走査** して以下を初期化：
      ```js
      const forLoopIterations = Object.fromEntries(
        (stage.forStarts ?? []).map((f) => [f.id, f.iterations])
      );
      // set:
      forLoopIterations,
      forLoopCounters: { ...forLoopIterations },
      ```
    - `retryFromFail` の set 内で **`forLoopCounters: { ...state.forLoopIterations }`** で復元（`forLoopIterations` は不変で残す）
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：なし
  - 完了条件：
    - 起動直後 `useBattleStore.getState().forLoopCounters === {}`、`forLoopIterations === {}`
    - `stage.forStarts` を持つステージで `initializeBattle` すると両者に対応する ID が iterations 値で埋まる
    - `decrementForLoopCounter('for-1')` を DevTools で呼ぶと `forLoopCounters['for-1']` が 1 減る（0 でクランプ）
    - `retryFromFail` で `forLoopCounters` が `forLoopIterations` の値に戻る
    - Lint / 型チェックがパスする
    - 既存の全ステージ（`forStarts` を持たない）で挙動の変化がない

- [x] **2. `battleStore` の execution ロジックに for-start / for-end を組み込む**  ✓ 完了
  - 内容：
    - `startExecution` 内の `nodeMap` 構築部に以下を追加：
      ```js
      for (const f of stage.forStarts ?? []) {
        nodeMap[f.id] = { type: 'for-start', iterations: f.iterations };
      }
      for (const f of stage.forEnds ?? []) {
        nodeMap[f.id] = { type: 'for-end', forLoopId: f.forLoopId };
      }
      ```
    - `scheduleNodePhase` 内の **card 効果分岐の直後**（`if (nodeId === 'goal')` の直前）に以下を追加：
      ```js
      if (nodeMap[nodeId]?.type === 'for-end') {
        const forLoopId = nodeMap[nodeId].forLoopId;
        get().decrementForLoopCounter(forLoopId);
      }
      ```
    - `selectNextEdge` に **for-end 分岐** を追加：
      ```js
      if (node?.type === 'for-end') {
        const forLoopId = node.forLoopId;
        const remaining = get().forLoopCounters[forLoopId] ?? 0;
        const target = remaining > 0 ? 'loop-back' : 'exit';
        return edges.find((e) => e.sourceHandle === target);
      }
      ```
    - **for-start は特別扱い不要**（既存の「card 効果なしノード」として default の `edges[0]` が返る）
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク1
  - 完了条件：
    - DevTools で `stage.forStarts` `stage.forEnds` を含む簡易ステージを流し、for-end に到達するたびに `forLoopCounters` が 1 減ることを確認
    - `sourceHandle === 'loop-back'` のエッジと `sourceHandle === 'exit'` のエッジで、for-end 到達時に **remaining > 0** なら loop-back、**== 0** なら exit へ進む
    - for-start ノードに到達しても for-start では **counter 変化が起きない**（decrement は for-end でのみ）
    - Lint / 型チェックがパスする
    - `forStarts` / `forEnds` を持たない既存全ステージの挙動が変わらない

- [x] **3. `evaluateCondition` と `buildEvalContext` に `forCounter()` 構文を追加**  ✓ 完了
  - 内容：
    - `frontend/src/engine/evaluateCondition.js` に新パターン定数：
      ```js
      const FORCOUNTER_PATTERN = /^forCounter\(\s*(['"])([^'"]+)\1\s*\)\s*(>=|<=|===|!==|>|<)\s*(.+)$/;
      ```
    - `evaluateAtom` 内、既存の `SLOT_PATTERN` マッチの直後に **`FORCOUNTER_PATTERN` の分岐** を追加：
      ```js
      const forCounterMatch = expression.match(FORCOUNTER_PATTERN);
      if (forCounterMatch) {
        const forLoopId = forCounterMatch[2];
        const op = forCounterMatch[3];
        const rightExpr = forCounterMatch[4].trim();
        const left = context.forCounter(forLoopId);
        const right = parseLiteral(rightExpr);
        if (right === undefined) return false;
        return compareValues(left, op, right);
      }
      ```
    - `battleStore.js` の `buildEvalContext` に **`forCounter` 関数** を追加：
      ```js
      forCounter: (forLoopId) => state.forLoopCounters?.[forLoopId] ?? 0,
      ```
  - ファイル：
    - `frontend/src/engine/evaluateCondition.js`
    - `frontend/src/stores/battleStore.js`（`buildEvalContext` 部分のみ）
  - 依存：タスク1（`forLoopCounters` が state に存在する必要）
  - 完了条件：
    - `evaluateCondition("forCounter('for-1') === 2", { ..., forCounter: (id) => 2 })` が `true`
    - `evaluateCondition("forCounter('for-1') > 0", { ..., forCounter: (id) => 0 })` が `false`
    - `evaluateCondition("forCounter('unknown') === 0", { ..., forCounter: () => 0 })` が `true`（未初期化は 0 として扱う）
    - 既存の `slot()` / 変数比較の式に影響がない
    - Lint / 型チェックがパスする

- [x] **4. `simulateBattle` に for-end ミラーを追加**  ✓ 完了
  - 内容：
    - `simulateBattle` の `initialState` パラメータに **`forLoopCounters`** を追加（呼び出し側 `startExecution` で `get().forLoopCounters` を渡す）
    - `simulateBattle` 内部の walker（フェーズごとに次エッジを選ぶ関数）で、for-end 到達時に simulated counter を decrement
    - selectNextEdge に相当するロジックに、live 実装と同じ for-end 分岐（`remaining > 0 ? 'loop-back' : 'exit'`）を追加
    - 条件式評価の context に `forCounter(id)` を注入（live 側と同じロジック）
  - ファイル：`frontend/src/engine/simulateBattle.js`（既存のパスは検証時に確認）
  - 依存：タスク1、タスク3
  - 完了条件：
    - `simulateBattle` の outcome が live 実行の勝敗と一致する（DEV 環境で `[simulateBattle] outcome mismatch` の警告が出ない）
    - for ループを持つステージで `iterations` 分の反復が simulation でも起きる
    - runaway ガード（`LOOP_MAX_VISITS = 100`）が for-end のループでも既存通り動作
    - Lint / 型チェックがパスする

- [x] **5. `ForStartNode.jsx` / `ForEndNode.jsx` / 共通 CSS を新規作成**  ✓ 完了
  - 内容：
    - **`frontend/src/features/battle/flowchart/ForStartNode.jsx`** を新規作成。以下の骨格：
      ```jsx
      import { Handle, Position } from '@xyflow/react';
      import useBattleStore from '../../../stores/battleStore';
      import styles from './ForNode.module.css';

      function ForStartNode({ id, data }) {
        const isActive = useBattleStore(
          (s) => s.executionStep?.type === 'node' && s.executionStep?.id === id,
        );
        const isTraversed = useBattleStore((s) => s.traversedNodeIds.includes(id));
        const remaining = useBattleStore(
          (s) => s.forLoopCounters?.[id] ?? data.iterations ?? 0,
        );

        const className = [
          styles.forNode, styles.start,
          isActive && styles.active,
          isTraversed && styles.traversed,
        ].filter(Boolean).join(' ');

        return (
          <div className={className}>
            <span className={styles.count}>{remaining}</span>
            <Handle type="target" position={Position.Left} className={styles.handle} isConnectable={false} />
            <Handle type="target" position={Position.Top} id="loop-back" className={styles.handle} isConnectable={false} />
            <Handle type="source" position={Position.Right} className={styles.handle} isConnectable={false} />
          </div>
        );
      }

      export default ForStartNode;
      ```
    - **`frontend/src/features/battle/flowchart/ForEndNode.jsx`** を新規作成。以下の骨格：
      ```jsx
      import { Handle, Position } from '@xyflow/react';
      import useBattleStore from '../../../stores/battleStore';
      import styles from './ForNode.module.css';

      function ForEndNode({ id }) {
        const isActive = useBattleStore(
          (s) => s.executionStep?.type === 'node' && s.executionStep?.id === id,
        );
        const isTraversed = useBattleStore((s) => s.traversedNodeIds.includes(id));

        const className = [
          styles.forNode, styles.end,
          isActive && styles.active,
          isTraversed && styles.traversed,
        ].filter(Boolean).join(' ');

        return (
          <div className={className}>
            <Handle type="target" position={Position.Left} className={styles.handle} isConnectable={false} />
            <Handle type="source" position={Position.Top} id="loop-back" className={styles.handle} isConnectable={false} />
            <Handle type="source" position={Position.Right} id="exit" className={styles.handle} isConnectable={false} />
          </div>
        );
      }

      export default ForEndNode;
      ```
    - **`frontend/src/features/battle/flowchart/ForNode.module.css`** を新規作成。以下の骨格：
      ```css
      .forNode {
        width: 80px;
        height: 80px;
        background: #15151c;
        border: 2px solid #4a4a52;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.15s;
      }
      .forNode.start {
        clip-path: polygon(0 20%, 20% 0, 100% 0, 100% 100%, 20% 100%, 0 80%);
      }
      .forNode.end {
        clip-path: polygon(0 0, 80% 0, 100% 20%, 100% 80%, 80% 100%, 0 100%);
      }
      .count {
        font-family: 'Press Start 2P', 'Courier New', Courier, monospace;
        font-size: 1.75rem;
        color: #f5f5f5;
        pointer-events: none;
        user-select: none;
      }
      /* SlotNode / ConditionNode と同じ発光パターン */
      .forNode.active {
        animation: forHighlight calc(0.3s / var(--speed-mult, 1)) ease-in-out 2 alternate;
      }
      .forNode.traversed {
        filter: brightness(1.6) drop-shadow(0 0 10px rgba(229, 229, 255, 0.9));
      }
      @keyframes forHighlight {
        from { filter: brightness(1) drop-shadow(0 0 0 rgba(229, 229, 255, 0)); }
        to   { filter: brightness(1.6) drop-shadow(0 0 10px rgba(229, 229, 255, 0.9)); }
      }
      .handle {
        width: 1px; height: 1px;
        min-width: 0; min-height: 0;
        background: transparent;
        border: none;
        opacity: 0;
        pointer-events: none;
      }
      ```
    - docstring / コメントは空のまま作成し、検証後に Claude が `Edit` で直接書き込む（teaching モード規約）
  - ファイル：
    - `frontend/src/features/battle/flowchart/ForStartNode.jsx`（新規）
    - `frontend/src/features/battle/flowchart/ForEndNode.jsx`（新規）
    - `frontend/src/features/battle/flowchart/ForNode.module.css`（新規、両ノード共通）
  - 依存：タスク1（`forLoopCounters` が state に存在する必要）
  - 完了条件：
    - Lint / 型チェックがパスする
    - 単体としてコンポーネント import 可能
    - タスク6 の統合後、実機で 6 角形状のノードが確認できる（縦横バランスは実機を見て微調整）
    - `.active` 発光と `.traversed` 固定光が既存ノードと同じ流儀で動く

- [x] **6. `FlowchartArea.jsx` に new node types と変換関数を統合**  ✓ 完了
  - 内容：
    - import 追加：
      ```js
      import ForStartNode from './ForStartNode';
      import ForEndNode from './ForEndNode';
      ```
    - `nodeTypes` 定数を更新：
      ```js
      const nodeTypes = {
        slot: SlotNode,
        start: StartNode,
        goal: GoalNode,
        condition: ConditionNode,
        merge: MergeNode,
        'for-start': ForStartNode,
        'for-end': ForEndNode,
      };
      ```
    - 変換関数を追加：
      ```js
      function forStartsToNodes(forStarts) {
        return forStarts.map((f) => ({
          id: f.id,
          type: 'for-start',
          position: f.position,
          data: { iterations: f.iterations },
        }));
      }
      function forEndsToNodes(forEnds) {
        return forEnds.map((f) => ({
          id: f.id,
          type: 'for-end',
          position: f.position,
          data: { forLoopId: f.forLoopId },
        }));
      }
      ```
    - `FlowchartArea` 関数内の `nodes` `useMemo` に以下を追加：
      ```js
      const forStartNodes = forStartsToNodes(stage.forStarts ?? []);
      const forEndNodes = forEndsToNodes(stage.forEnds ?? []);
      result.push(...forStartNodes, ...forEndNodes);
      ```
    - `edgesToFlowEdges` の validId 構築に for-start / for-end の id を追加（未定義ノードを警告しないため）
  - ファイル：`frontend/src/features/battle/flowchart/FlowchartArea.jsx`
  - 依存：タスク5
  - 完了条件：
    - `stage.forStarts` / `stage.forEnds` を含む簡易ステージ（手動作成でよい）で、for-start と for-end のノードが指定位置に描画される
    - `sourceHandle: 'loop-back' | 'exit'` のエッジが正しく for-end から出て、それぞれ for-start と後続ノードへ到達する
    - `edgesToFlowEdges` の validation が for-start / for-end を有効 ID として認識し、警告が出ない
    - 既存のステージ（`forStarts` を持たない）で node 数・edge 数・fitBounds に変化がない
    - Lint / 型チェックがパスする

## トレーサビリティ（要件 → タスク）

| 要件 | カバーするタスク |
|---|---|
| 1: `for-start` ノード追加 | タスク5（JSX + CSS）、タスク6（`nodeTypes` 統合） |
| 2: `for-end` ノード追加 | タスク5、タスク6 |
| 3: for ループの実行セマンティクス | タスク1（state と初期化）、タスク2（execution 分岐）、タスク4（simulateBattle 同期） |
| 4: 残回数の可視化と分岐条件 | タスク3（`forCounter()` 構文）、タスク5（`ForStartNode` の `remaining` 表示） |
| 5: stage 4-2 基盤保証 | タスク6（`FlowchartArea` の変換関数）、タスク1〜4 で全機構提供 |
| 6: 見た目のバリアント | タスク5（CSS `clip-path` で左右対称形状、`.active` / `.traversed` 発光） |
| 7: 既存機能との互換性 | タスク1〜6 のすべてで `forStarts` / `forEnds` が空の場合にノーオペを保証 |
| 8: 実行速度と加速機構との整合 | タスク2（既存 `scheduleNodePhase` の枠内で動作、`nodePhaseMs / speedMultiplier` が自動適用）、タスク5（CSS animation-duration も `calc(<base> / var(--speed-mult, 1))`） |

全 8 要件がタスク1〜6 のいずれかでカバーされます。孤立した要件はありません。

## クリティカルパス

```
タスク1 (battleStore: state / init / retry)
       ↓
タスク2 (battleStore: execution 分岐)
       ↓
タスク3 (evaluateCondition: forCounter 構文)
       ↓
タスク4 (simulateBattle: for-end ミラー)

タスク5 (ForStartNode / ForEndNode / CSS)
       ↓
タスク6 (FlowchartArea 統合)
```

タスク1〜4 は state / 実行 / 評価の縦のスタックで、タスク5〜6 は UI 層。タスク5 はタスク1 の `forLoopCounters` を購読するので 1 完了後に着手可能。

## 実装の注意点

- **タスク2 の decrement タイミング**：`scheduleNodePhase` 内で `set()` で `executionStep` を更新 → その後同期的に `decrementForLoopCounter` を呼ぶ → `selectNextEdge` は次のイベントループで呼ばれる。`get()` は set 反映後の値を返すので、decrement 結果が selectNextEdge から正しく参照できる
- **タスク3 の `FORCOUNTER_PATTERN` の順序**：`evaluateAtom` 内で `SLOT_PATTERN` の直後に置く。`VAR_PATTERN` は `\w+` で始まるため、`forCounter(...)` の `(` 部分でマッチしないが、pattern 順序を明確にしておく
- **タスク4 の simulateBattle パス**：`simulateBattle.js` の正確なファイル位置は実装前に `grep -rn "simulateBattle" frontend/src` で確認する
- **タスク5 の CSS `clip-path` 数値**：`polygon(0 20%, 20% 0, ...)` の 20% は「角を斜めに切る」の斜め幅。実機で見て違和感があれば 15% or 25% に調整可能
- **タスク5 の `.count` サイズ**：1.75rem を基準に、80×80 のノード内でバランスよく大きく見える値を実機で微調整
- **タスク6 の `validIds` 拡張**：`edgesToFlowEdges` の validation ロジックに for-start / for-end の id を追加しないと、それらを source/target にするエッジが警告と共にスキップされる
- **for-start と for-end の `id` 命名**：本仕様では規約を強制しないが、ステージ実装者が `for-start-1` / `for-end-1` のように対を分かる命名にすると管理しやすい
- **ネストした for ループ**：本仕様は複数の for-start / for-end 対の共存に対応（`forLoopCounters` は Map なので複数 ID を持てる）。ステージ側で正しく edges を組めば入れ子も動作する
