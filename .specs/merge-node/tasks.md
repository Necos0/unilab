# タスク一覧: 合流ノードの追加（merge-node）

## 概要

実装は (1) `MergeNode` コンポーネント新規作成 → (2) `stagesLoader.js` の `processSubFlow` を改修して合流ノードを自動挿入 → (3) `FlowchartArea.jsx` に `merge` nodeType と関連ロジックを追加 → (4) `battleStore.js` の `nodeMap` 構築に merge を含める、の 4 ステージで進める。

タスク 1（MergeNode 新規）とタスク 2（stagesLoader 改修）は依存関係がなく並列可能。タスク 3 はタスク 1 が必要（`MergeNode` を import）、タスク 4 はタスク 2 が必要（`stage.mergeNodes` を読み込む）。タスク 4 完了で初めてステージ 2-1 を実機で動作確認できる。

合計タスク数：4 件 ｜ 想定工数：約 1.5〜2 時間

## タスク

- [x] **1. `MergeNode` コンポーネントを新規作成する**  ✓ 完了
  - 内容：以下 2 ファイルを新規作成する。
    - **`MergeNode.jsx`**：小さな円のカスタムノード。`useBattleStore` から `executionStep` と `traversedNodeIds` を購読して `.active` / `.traversed` クラスを条件付与。Handle 3 つ（Left target、Top target（`id="top"`）、Right source）をすべて `isConnectable={false}` で配置。`data` は受け取らない（合流ノードは expression や lockedCard を持たない）。
    - **`MergeNode.module.css`**：`.circle` は `width: 16px; height: 16px; background: #f5f5f5; border-radius: 50%; box-sizing: border-box; position: relative;`。`.circle::before` で `inset: 3px; background: #15151c; border-radius: 50%;` で内側に暗色の小円を被せ、外側 3px の白い縁を残す（`ConditionNode` の枠線実装と同じパターン）。`.handle` は既存通り 1px 透明・`pointer-events: none`。`.circle.active` で `@keyframes mergeHighlight`（0.3s ease-in-out 2 alternate）を起動、`.circle.traversed` で固定発光（`filter: brightness(1.6) drop-shadow(0 0 8px rgba(229, 229, 255, 0.9))`）。
  - ファイル：`frontend/src/features/battle/flowchart/MergeNode.jsx`（新規）、`frontend/src/features/battle/flowchart/MergeNode.module.css`（新規）
  - 依存：なし
  - 完了条件：単体では検証しにくいが、タスク 3 完了後に「ステージ 2-1 のフローチャートに小さな白い円が表示される」状態が完了。
  - 対応要件：要件 1-1, 1-2, 1-3, 1-4, 1-5

- [x] **2. `stagesLoader.js` の `processSubFlow` を合流ノード自動挿入対応に改修する**  ✓ 完了
  - 内容：以下 4 点を変更する。
    1. **`ctx` に新規フィールドを追加**: `expandFlow` 内の `ctx` 初期化に `mergeCounter: 0` と `mergeNodes: []` を追加。
    2. **`processSubFlow` の条件分岐ブロックに合流ノード生成を組み込む**: True / False 経路を再帰展開した後、以下を実行：
       - `const mergeColumn = Math.max(trueResult.endColumn, falseResult.endColumn);`
       - `ctx.mergeCounter += 1;` で連番採番
       - `const mergeId = ${'`merge-${ctx.mergeCounter}`'};`
       - `ctx.mergeNodes.push({ id: mergeId, position: { x: 80 + mergeColumn * 200 - 60, y: yLevel } });`
       - True 経路の各 ending から merge.left への edge を追加（既存 `buildEdge` を使う、`targetHandle` なし）
       - False 経路の各 ending に `targetHandle: 'top'` を付与して merge へ edge を追加
       - `endings = [{ nodeId: mergeId, sourceHandle: undefined }];`（次のループで merge → 通常スロットのエッジが引かれる）
       - `column = mergeColumn;`
       既存の「False 経路の endings に `targetHandle: 'top'` を付与してから合体する処理」は **撤回**（合流ノードを介する形に切り替わるので不要）。
    3. **`expandFlow` の戻り値に `mergeNodes` を追加**:
       ```js
       return {
         slots: ctx.slots,
         conditions: ctx.conditions,
         mergeNodes: ctx.mergeNodes,  // 追加
         edges: ctx.edges,
         start: { ... },
         goal: { ... },
       };
       ```
    4. **`expandStage` の `slots` ルートにも `mergeNodes: []` を追加**: 線形ステージの戻り値に `mergeNodes: []` を含めて、後段が常に配列を前提にできるようにする。
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：なし（独立、タスク 1 と並列可能）
  - 完了条件：DevTools コンソールで `useBattleStore.getState()` の周辺で stage オブジェクトを確認し、ステージ 2-1 の `stage.mergeNodes` に 1 件（`{ id: 'merge-1', position: { x: 820, y: 120 } }`）が含まれている。マップ 1 のステージは `stage.mergeNodes` が `[]`。エッジ配列に `e-cond-1-merge-1`（`sourceHandle: 'false'`、`targetHandle: 'top'`）と `e-slot-3-merge-1`、`e-merge-1-slot-4` が含まれている。
  - 対応要件：要件 2-1〜2-7、要件 3-1〜3-3

- [x] **3. `FlowchartArea.jsx` に `merge` nodeType と関連ロジックを追加する**  ✓ 完了
  - 内容：以下 5 点を変更する。
    1. `import MergeNode from './MergeNode';` を追加。
    2. `nodeTypes` に `merge: MergeNode` を追加。
    3. **`mergeNodesToNodes(mergeNodes)` 関数を新規追加**: `mergeNodes` 配列の各要素を `{ id, type: 'merge', position, data: {} }` に変換。
    4. **`useMemo` の `nodes` 構築で `stage.mergeNodes` を含める**:
       ```jsx
       const conditionNodes = conditionsToNodes(stage.conditions ?? []);
       const mergeNodes = mergeNodesToNodes(stage.mergeNodes ?? []);  // 追加
       // ...
       result.push(...conditionNodes);
       result.push(...mergeNodes);  // 追加
       ```
       `useMemo` の依存配列にも `stage.mergeNodes` を追加。
    5. **`edgesToFlowEdges` のシグネチャと `validIds` を拡張**: 引数に `mergeNodes` を追加し、`validIds` セットに merge id を含める。呼び出し側（`edges` の `useMemo`）も `stage.mergeNodes ?? []` を渡す。依存配列にも `stage.mergeNodes` を追加。
  - ファイル：`frontend/src/features/battle/flowchart/FlowchartArea.jsx`
  - 依存：タスク 1（`MergeNode` を import）、タスク 2（`stage.mergeNodes` を読む）
  - 完了条件：ステージ 2-1 を表示すると、`slot-3`（locked attack）と `slot-4`（空き）の間に小さな白い円（`merge-1`）が描画される。条件分岐から False 経路エッジが merge の top に上から入り、True 経路エッジが merge の left に水平で入り、merge の right から `slot-4` へ水平直線で出ていく。
  - 対応要件：要件 1-2、要件 3-2

- [x] **4. `battleStore.js` の `nodeMap` に merge ノードを登録する**  ✓ 完了
  - 内容：`startExecution` 内の `beginSequence` 関数の `nodeMap` 構築箇所に、合流ノードを `{ type: 'merge' }` で登録する処理を追加する。
    ```js
    const nodeMap = {};
    nodeMap['start'] = { type: 'start' };
    nodeMap['goal'] = { type: 'goal' };
    for (const slot of stage.slots ?? []) {
      nodeMap[slot.id] = { type: 'slot' };
    }
    for (const c of stage.conditions ?? []) {
      nodeMap[c.id] = { type: 'condition', expression: c.expression };
    }
    for (const m of stage.mergeNodes ?? []) {  // 追加
      nodeMap[m.id] = { type: 'merge' };
    }
    ```
    `scheduleNodePhase` のカード効果分岐（`attack` / `monster` / `heal` / `guard` / `reflect`）には **追加コード不要**：合流ノードには `slotAssignments[mergeId]` が存在しないため `card` が `undefined` になり、すべての効果分岐ガード（`card && card.id === 'xxx'`）が自動的にスキップされる。`executionStep` のセットと `traversedNodeIds` への追加は既存ロジックで通常通り行われる。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク 2（`stage.mergeNodes` が存在することが前提）
  - 完了条件：(a) ステージ 2-1 を実行すると、`merge-1` ノードを通過する瞬間に `.active` クラスで点滅、通過後は `.traversed` クラスで固定光が残る。(b) 合流ノード通過時にプレイヤー HP / 敵 HP / シールド等は一切変動しない（素通り）。(c) ノードフェーズ時間（`NODE_PHASE_MS`）を通常通り消費して次のエッジへ進む。(d) マップ 1 のステージ（`stage.mergeNodes` が `[]`）が引き続き動作する（ループが 0 回なので追加コードは効かない）。
  - 対応要件：要件 4-1, 4-2, 4-3、要件 7-1〜7-4、要件 8-1〜8-3

## トレーサビリティ確認

| 要件 | 対応タスク |
|---|---|
| 1-1〜1-3（MergeNode の描画と Handle 構成） | タスク 1 |
| 1-4（`.active` 点滅） | タスク 1（CSS）、タスク 4（`executionStep` の購読は MergeNode 内で実装） |
| 1-5（`.traversed` 固定光） | タスク 1（CSS）、タスク 4（`traversedNodeIds` の購読は MergeNode 内で実装） |
| 2-1〜2-3（自動挿入と id 採番） | タスク 2 |
| 2-4〜2-7（エッジ自動付与と合流先 goal 対応） | タスク 2 |
| 3-1〜3-3（`mergeNodes` フィールド追加） | タスク 2 |
| 4-1（カード効果分岐を発火しない） | タスク 4（追加コード不要、既存の `card` undefined チェックで自動スキップ） |
| 4-2（通過軌跡への追加） | タスク 4（既存 `traversedNodeIds.push` ロジックがそのまま機能） |
| 4-3（ノードフェーズ時間消費） | タスク 4（既存 `NODE_PHASE_MS` がそのまま使われる） |
| 5-1〜5-4（エッジの描画） | タスク 2（エッジ生成）、既存の `AnimatedProgressEdge` の判定がそのまま機能 |
| 6-1〜6-3（入れ子分岐対応） | タスク 2（`ctx.mergeCounter` がグローバル、再帰呼び出しで各レベルが独立） |
| 7-1〜7-4（ステージ 2-1 の動作確認） | タスク 2、3、4 完了後にユーザーが実機確認 |
| 8-1（マップ 1 への影響なし） | タスク 2（`slots` ルートで `mergeNodes: []` を返す）、タスク 4（空配列のループは効果なし） |
| 8-2（マップ 1 演出維持） | タスク 1（独立ファイル）、タスク 3（既存 nodeType は変更なし） |
| 8-3（既存ノード描画への影響なし） | タスク 3（`merge: MergeNode` の追加で他に影響なし） |
