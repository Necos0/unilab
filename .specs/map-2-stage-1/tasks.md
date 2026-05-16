# タスク一覧: マップ 2 ステージ 1（map-2-stage-1）

## 概要

実装は (1) 純粋ロジックの `evaluateCondition.js` 新規作成 → (2) `stagesLoader.js` の conditions 対応 → (3) `ConditionNode` コンポーネント新規作成 → (4) `FlowchartArea` に condition ノード描画対応 → (5) `battleStore` の `startExecution` を再帰スケジュール方式に書き換え → (6) `stages.json` にステージ 2-1 追加と `demoStageId` 変更、の 6 ステージで進める。

タスク 1〜3 は完全に独立しており並列着手可能。タスク 4 はタスク 3 後、タスク 5 はタスク 1〜2 後、タスク 6 はタスク 2 と 5 が揃った時点でステージ全体の動作確認が可能。クリティカルパスはタスク 5（`startExecution` の再帰スケジュール書き換え）で、既存マップ 1 への回帰リスクを最小化するため最も慎重に進める必要がある。

合計タスク数：6 件 ｜ 想定工数：約 3〜4 時間

## タスク

- [x] **1. `evaluateCondition.js` を新規作成し、条件式の正規表現パーサーを実装する**  ✓ 完了
  - 内容：`frontend/src/engine/` ディレクトリを新規作成し、`evaluateCondition.js` を実装する。
    - `SLOT_PATTERN`（`slot('id') op literal` 用の正規表現）と `VAR_PATTERN`（`variable op literal` 用）の 2 パターンでマッチ。
    - ヘルパー関数 `parseLiteral(str)`（整数 / 文字列 / `null` / `true` / `false` を解析）と `compareValues(left, op, right)`（6 種類の演算子で比較）を実装。
    - `context.variables`（変数マップ）と `context.slot(slotId)`（関数）を引数で受け取る形にする。
    - マッチしない式は `console.warn` でログ + `false` を返す（クラッシュしない）。
    - `eval` / `new Function` を使わない。
  - ファイル：`frontend/src/engine/evaluateCondition.js`（新規）
  - 依存：なし（純粋関数、独立）
  - 完了条件：DevTools コンソールで以下の動作を確認できる（仮の context を渡してテスト）：
    - `evaluateCondition('playerHp > 50', { variables: { playerHp: 70 }, slot: () => null })` → `true`
    - `evaluateCondition('playerHp > 50', { variables: { playerHp: 30 }, slot: () => null })` → `false`
    - `evaluateCondition("slot('s1') === 'attack'", { variables: {}, slot: (id) => id === 's1' ? 'attack' : null })` → `true`
    - `evaluateCondition("slot('s2') === null", { variables: {}, slot: () => null })` → `true`
    - `evaluateCondition('reflectActive === true', { variables: { reflectActive: true }, slot: () => null })` → `true`
    - 不正な式（例：`'invalid syntax'`）で `console.warn` が出て `false` が返る
  - 対応要件：要件 2-1〜2-9

- [x] **2. `stagesLoader.js` を `conditions` フィールド対応に拡張する**  ✓ 完了
  - 内容：`expandStage` 関数に以下を追加する。
    - `expandConditions(rawConditions)` ヘルパー関数を新規追加：各 condition の `{ id, position, expression }` をそのまま返す。`rawConditions` が `undefined` または空配列なら `[]` を返す。
    - `expandStage` の戻り値オブジェクトに `conditions: expandConditions(raw.conditions)` を追加。
    - 既存の `edges: raw.edges ?? buildLinearEdges(slots)` はそのまま（線形ステージのフォールバックを維持）。
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：なし（独立）
  - 完了条件：(a) 既存ステージ（1-1〜1-4）で `stage.conditions === []` が返ることを React DevTools で確認。(b) ステージ 2-1（タスク 6 で追加）が読み込まれたとき、`stage.conditions` に 1 件の `{ id, position, expression }` が含まれている。(c) 既存ステージの実行に影響がない（マップ 1 ステージが従来通り動く）。
  - 対応要件：要件 6-1（部分）、要件 8-2

- [x] **3. `ConditionNode` コンポーネントを新規作成する**  ✓ 完了
  - 内容：以下 2 ファイルを新規作成する。
    - **`ConditionNode.jsx`**：菱形のカスタムノード。`Handle` 3 つ（`Left=target` / `Right id="true"` / `Bottom id="false"`、すべて `isConnectable={false}`）。内部に `data.expression` をテキスト表示。`useBattleStore` から `executionStep` と `traversedNodeIds` を購読して `.active` / `.traversed` クラスを条件付与（既存 `SlotNode` と同じパターン）。
    - **`ConditionNode.module.css`**：`.diamond` は `width/height: 140px`、`background: #15151c`、`clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%)`、`border` の代わりに内側 `::before` で枠線を表現（または `outline-offset` 調整）。`.expression` は中央配置、`padding: 0 1.5rem` で菱形の左右が切れないようマージン。`.handle` は不可視（既存 `SlotNode` と同じ 1px 透明）。`.active` は既存 `@keyframes slotHighlight` を再宣言、`.traversed` は固定発光（`filter: brightness(1.6) drop-shadow(...)`）。
  - ファイル：`frontend/src/features/battle/flowchart/ConditionNode.jsx`（新規）、`frontend/src/features/battle/flowchart/ConditionNode.module.css`（新規）
  - 依存：なし（独立）
  - 完了条件：単体では検証しにくいが、タスク 4 完了後に「ステージ 2-1（タスク 6）を開くと菱形ノードが表示され、内部に `playerHp > 50` のテキストが見える」状態が完了。
  - 対応要件：要件 1-1, 1-3, 1-4

- [x] **4. `FlowchartArea.jsx` を condition ノード対応に拡張する**  ✓ 完了
  - 内容：以下を変更する。
    1. `import ConditionNode from './ConditionNode';` を追加。
    2. `nodeTypes` に `condition: ConditionNode` を追加。
    3. `conditionsToNodes(conditions)` 関数を新規追加：`conditions` 配列の各要素を `{ id, type: 'condition', position, data: { expression } }` に変換。
    4. `useMemo` の `nodes` 構築で `conditionsToNodes(stage.conditions ?? [])` の結果を `result.push(...)` で追加。
    5. `edgesToFlowEdges` を拡張：シグネチャに `conditions` 引数を追加し、`validIds` セットに condition の id も含める。戻り値オブジェクトに `sourceHandle: edge.sourceHandle` を追加（undefined のときは React Flow が無視する）。
    6. `useMemo` の `edges` 構築で `edgesToFlowEdges(stage.edges, stage.slots, stage.conditions ?? [], !!stage.start, !!stage.goal)` のように呼ぶ。
  - ファイル：`frontend/src/features/battle/flowchart/FlowchartArea.jsx`
  - 依存：タスク 3
  - 完了条件：ステージ 2-1（タスク 6）を開くと、菱形 condition ノードと True / False の 2 本のエッジが正しく描画される。エッジは菱形の右頂点（True）と下頂点（False）から伸びている。
  - 対応要件：要件 1-2, 1-5, 8-3

- [x] **5. `battleStore.js` の `startExecution` を再帰スケジュール方式に書き換える**  ✓ 完了
  - 内容：既存の `phases.forEach((phase, i) => setTimeout(..., phaseStartMs[i]))` 構造を撤回し、以下の再帰スケジュール構造に置き換える。
    1. `buildNodeMap(stage)`：`{ 'start': {type:'start'}, 'slot-N': {type:'slot'}, 'cond-N': {type:'condition', expression}, 'goal': {type:'goal'} }` のマップを構築。
    2. `buildEdgesBySource(stage)`：`{ 'start': [edge], 'cond-1': [edgeTrue, edgeFalse], ... }` のマップを構築。
    3. `buildEvalContext(state)`：`{ variables: { playerHp, enemyHp, maxPlayerHp, maxEnemyHp, guardShield, reflectActive }, slot: (id) => slotAssignments[id]?.id ?? null }` を返す。
    4. `scheduleNodePhase(nodeId, delay)`：`setTimeout` でノードフェーズを実行。`executionStep` / `currentPhaseMs` / `traversedNodeIds` をセット → カード効果分岐（既存の `attack` / `monster` / `heal` / `guard` / `reflect`、condition なら何もしない）→ 次のエッジを `selectNextEdge` で選択 → `scheduleEdgePhase` を予約。`nodeId === 'goal'` で `scheduleComplete` を呼ぶ。
    5. `scheduleEdgePhase(edge, delay)`：`setTimeout` でエッジフェーズを実行。`executionStep` / `currentPhaseMs` / `traversedEdgeIds` をセット → 直前ノードに応じた `clearGuard` / `clearReflect` ガード（既存と同じ）→ `scheduleNodePhase(edge.target, EDGE_PHASE_MS)` を予約。
    6. `selectNextEdge(nodeId, nodeMap, edgesBySource)`：condition ノードなら `evaluateCondition` で評価して `sourceHandle === 'true'/'false'` のエッジを選択、それ以外なら `edges[0]`。
    7. `scheduleComplete(delay)`：`setTimeout` で勝敗判定と完了処理（既存の完了タイマーと同じ内容）。
    8. すべての `setTimeout` ID を `executionTimers` に push（既存の中断機構と整合）。
    9. `beginSequence` の最後で `scheduleNodePhase('start', 0)` を呼ぶ。
    10. `import evaluateCondition from '../engine/evaluateCondition';` を追加。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク 1（`evaluateCondition`）、タスク 2（`stage.conditions`）
  - 完了条件：(a) マップ 1 のステージ 1-1〜1-4 で従来通り線形フェーズ実行が動く（回帰なし）。(b) ステージ 2-1（タスク 6 で追加）で実行すると、`playerHp > 50` の評価結果に応じて True/False どちらかの経路を辿る。(c) Fail 中断 + やり直し時のタイマー破棄が引き続き動く。
  - 対応要件：要件 3-1〜3-6、要件 4-1〜4-3、要件 8-1, 8-4

- [x] **6. `stages.json` にステージ 2-1 を追加し、`demoStageId` を `"2-1"` に変更する**  ✓ 完了
  - 内容：以下を追加・変更する。
    1. `stages.json` の `stages` オブジェクトに `"2-1"` キーで以下の構造を追加：
       ```json
       "2-1": {
         "enemyId": "wolf",
         "cards": [
           { "id": "attack", "power": 10 },
           { "id": "heal",   "power": 10 }
         ],
         "start": { "position": { "x": -120, "y": 120 } },
         "slots": [
           { "id": "slot-1", "position": { "x": 80,  "y": 120 }, "lockedCard": { "id": "monster", "power": 50 } },
           { "id": "slot-2", "position": { "x": 280, "y": 120 } },
           { "id": "slot-3", "position": { "x": 680, "y": 120 }, "lockedCard": { "id": "attack", "power": 20 } },
           { "id": "slot-4", "position": { "x": 880, "y": 120 } }
         ],
         "conditions": [
           { "id": "cond-1", "position": { "x": 480, "y": 120 }, "expression": "playerHp > 50" }
         ],
         "goal": { "position": { "x": 1080, "y": 120 } },
         "edges": [
           { "id": "e-start-1",      "source": "start",  "target": "slot-1" },
           { "id": "e-1-2",          "source": "slot-1", "target": "slot-2" },
           { "id": "e-2-cond",       "source": "slot-2", "target": "cond-1" },
           { "id": "e-cond-true-3",  "source": "cond-1", "sourceHandle": "true",  "target": "slot-3" },
           { "id": "e-3-4",          "source": "slot-3", "target": "slot-4" },
           { "id": "e-cond-false-4", "source": "cond-1", "sourceHandle": "false", "target": "slot-4" },
           { "id": "e-4-goal",       "source": "slot-4", "target": "goal" }
         ]
       }
       ```
    2. `demoStageId` を `"1-1"` から `"2-1"` に変更。
  - ファイル：`frontend/src/data/stages.json`
  - 依存：タスク 2、タスク 5
  - 完了条件：(a) アプリ起動 → マップ画面 → 「バトルデモ」ボタン押下でステージ 2-1 に遷移する。(b) 戦闘画面でフローチャートに菱形ノードと 2 本の分岐エッジが見える。(c) 手札に `attack(10)` と `heal(10)` の 2 枚。(d) 実行すると `playerHp > 50` の評価結果に応じて分岐し、True なら attack(20) が発火、False なら slot-3 を通らず slot-4 へ。
  - 対応要件：要件 5-1〜5-3、要件 6-1〜6-4、要件 7-1〜7-3

## トレーサビリティ確認

| 要件 | 対応タスク |
|---|---|
| 1-1（condition ノードの描画） | タスク 3、タスク 4 |
| 1-2（id / position / expression 必須） | タスク 2、タスク 6 |
| 1-3（菱形 + 条件式テキスト表示） | タスク 3 |
| 1-4（True / False ハンドル 2 つ） | タスク 3 |
| 1-5（sourceHandle 対応） | タスク 4 |
| 2-1〜2-4（評価ロジックと安全性） | タスク 1 |
| 2-5〜2-9（変数 / 演算子 / 関数式 / リテラル） | タスク 1 |
| 3-1〜3-5（分岐対応のフェーズ実行） | タスク 5（`selectNextEdge`、再帰スケジュール） |
| 3-6（ランタイム計算） | タスク 5（`buildEvalContext` を実行時に呼ぶ） |
| 4-1〜4-3（通過軌跡） | タスク 5（`scheduleNodePhase` / `scheduleEdgePhase` での蓄積） |
| 5-1〜5-3（ロック attack カード） | タスク 6（既存 `lockedCard` 仕組み流用） |
| 5-4（hover 抑制） | 既存実装（reflect-card-effect 後の `.lockedCard` クラス） |
| 6-1〜6-4（ステージ 2-1 のデータ） | タスク 2（loader 対応）、タスク 6（json 追加） |
| 7-1〜7-3（demoStageId 変更） | タスク 6 |
| 8-1（マップ 1 の挙動維持） | タスク 5（線形ステージで `edges[0]` が常に選ばれる） |
| 8-2（loader の互換性） | タスク 2（`conditions ?? []` フォールバック） |
| 8-3（線形ステージの buildExecutionPath 相当） | タスク 5（線形ステージで `node.type !== 'condition'` の経路） |
| 8-4（guard / reflect カード効果の維持） | タスク 5（既存の `clearGuard` / `clearReflect` 呼び出しを `scheduleEdgePhase` 内に再配置） |
