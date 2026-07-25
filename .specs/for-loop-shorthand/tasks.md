# タスク一覧: for ループ短縮記法（stagesLoader 拡張）

## 概要

`stagesLoader.js` の **1 ファイル改修** で完結する。既存の `expandLoop` / `processSubFlow` / `collectSlotTypeIds` のパターンを踏襲し、for-loop 用の関数・分岐・ctx フィールドを追加する。基盤（ctx / expandStage / expandFlow の空配列付与）→ 中核関数（`expandForLoop`）→ 統合（`processSubFlow` if/else 分岐）→ ヘルプ統合（`collectSlotTypeIds`）の順で積む。各タスクは前タスクの完了に依存するが、タスク1 の基盤だけを入れた状態でも既存ステージは無変化のまま安全に運用できる。

合計タスク数：4件 ｜ 想定工数：1〜2 時間

## タスク

- [x] **1. 基盤の追加（`isForLoop` 型ガード、ctx フィールド、空配列付与）**  ✓ 完了
  - 内容：
    - モジュールトップレベルに **`isForLoop(item)`** 関数を追加（`isLoop` の直下が適切な配置場所）:
      ```js
      function isForLoop(item) {
        return typeof item?.for === 'object' && item.for !== null;
      }
      ```
    - `expandFlow` 内の `ctx` 初期化に 3 フィールド追加:
      ```js
      const ctx = {
        slotCounter: 0,
        condCounter: 0,
        mergeCounter: 0,
        forCounter: 0,          // 新規
        slots: [],
        conditions: [],
        mergeNodes: [],
        forStarts: [],          // 新規
        forEnds: [],            // 新規
        edges: [],
        turnCount: 0,
        afterTurn: false,
      };
      ```
    - `expandFlow` の return object に 2 フィールド追加:
      ```js
      return {
        slots: ctx.slots,
        conditions: ctx.conditions,
        mergeNodes: ctx.mergeNodes,
        forStarts: ctx.forStarts,   // 新規
        forEnds: ctx.forEnds,       // 新規
        edges: ctx.edges,
        start: { position: { x: -120, y: 120 } },
        goal: { position: goalPlacement.position },
      };
      ```
    - `expandFlow` の不正入力フォールバック（`Array.isArray(flow) === false` の分岐）の return にも `forStarts: []` / `forEnds: []` を追加
    - `expandStage` の **slots ルート**（`raw.flow` が無い分岐）の stage オブジェクトに `forStarts: []` / `forEnds: []` を追加（`mergeNodes: []` の直後）
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：なし
  - 完了条件：
    - **既存の全ステージ**（`for` 要素を含まない）を含む `stages.json` 全体で挙動が無変化（`window.__stages = stagesData; console.log(stagesData.stages)` で目視、または各 stage の `slots.length` / `edges.length` を before/after で比較）
    - `expandStage` の戻り値がすべてのステージで `forStarts: []` / `forEnds: []` を持つ
    - `expandFlow` の戻り値も同上
    - Lint / 型チェックがパスする
    - `isForLoop({})` が `false`、`isForLoop({ for: {} })` が `true`、`isForLoop({ for: null })` が `false`、`isForLoop({ for: true })` が `false`、`isForLoop({ for: "3" })` が `false`（型ガード確認）

- [x] **2. `expandForLoop` 関数を新規追加**  ✓ 完了
  - 内容：
    - `expandLoop` の直下（またはその近く、ファイル内の関連関数のまとまりの中）に **`expandForLoop(forDef, { column, yLevel, endings, ctx })`** を新規追加
    - 実装内容（design.md の API 節を参照、要点は以下）:
      1. **バリデーション**（`Number.isInteger(forDef.iterations) && forDef.iterations >= 1` と `Array.isArray(forDef.body)`、不正時は `console.warn` + `return { endings, column }` でスキップ）
      2. `ctx.forCounter += 1` して `forStartId = 'for-start-${N}'` / `forEndId = 'for-end-${N}'` を採番
      3. `ctx.forStarts.push({ id, iterations: forDef.iterations, position: { x: SLOT_X_START + column * SLOT_X_STEP, y: yLevel } })`
      4. 入口エッジ: `for (const ending of endings) ctx.edges.push(buildEdge(ending, forStartId))`
      5. body を **`processSubFlow`** に **再帰委譲**:
         ```js
         const bodyResult = processSubFlow(forDef.body, {
           startColumn: column + 1,
           yLevel,
           prevNodeId: forStartId,
           prevSourceHandle: undefined,
           ctx,
           isTopLevel: false,
           direction: 'right',
         });
         ```
      6. `ctx.forEnds.push({ id: forEndId, forLoopId: forStartId, position: { x: SLOT_X_START + bodyResult.endColumn * SLOT_X_STEP, y: yLevel } })`
      7. body 末尾 → for-end エッジ: `for (const ending of bodyResult.endings) ctx.edges.push(buildEdge(ending, forEndId))`
      8. loop-back エッジ: `ctx.edges.push(buildEdge({ nodeId: forEndId, sourceHandle: 'loop-back', targetHandle: 'loop-back' }, forStartId))`
      9. 次要素向けに exit endings を返す:
         ```js
         return {
           endings: [{ nodeId: forEndId, sourceHandle: 'exit' }],
           column: bodyResult.endColumn + 1,
         };
         ```
    - docstring はスケルトンのみ書き、検証後に Claude が `Edit` で直接充実させる（teaching モード規約）
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：タスク1（`ctx.forCounter` / `ctx.forStarts` / `ctx.forEnds` が存在する必要）
  - 完了条件：
    - 関数単体として定義される（この段階では `processSubFlow` から呼ばれないので、実運用には出ない）
    - Lint / 型チェックがパスする
    - 既存の全ステージで挙動無変化

- [x] **3. `processSubFlow` の if/else チェーンに `isForLoop` 分岐を追加**  ✓ 完了
  - 内容：
    - `processSubFlow` 内の if/else チェーンの **`isLoop(item)` 分岐の直後・`isCondition(item)` 分岐の直前** に以下を追加:
      ```js
      } else if (isForLoop(item)) {
        const forResult = expandForLoop(item.for, { column, yLevel, endings, ctx });
        endings = forResult.endings;
        column = forResult.column;
      }
      ```
    - この時点で **`{ "for": {...} }` 要素を含む flow ステージが完全に展開できる**（stage 4-2 ドラフト等の JSON が動く）
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：タスク2
  - 完了条件：
    - 簡易テスト JSON（`{ "for": { "iterations": 3, "body": [{}, {}] } }` を含む flow）を仮に `stages.json` に追加して起動 → for-start / for-end / body slots / loop-back エッジ / exit エッジが正しく生成される
    - stage の展開結果を DevTools で確認:
      - `stage.forStarts.length === 1`
      - `stage.forEnds.length === 1`
      - `stage.forStarts[0].iterations === 3`
      - `stage.forEnds[0].forLoopId === stage.forStarts[0].id`
      - `stage.edges` に loop-back エッジ（`sourceHandle: 'loop-back'`, `targetHandle: 'loop-back'`）が 1 本含まれる
      - `stage.edges` に exit エッジ（source=for-end-1, sourceHandle: 'exit'）が 1 本含まれる
    - **既存の全ステージで挙動無変化**（`for` を含まないので新分岐に落ちない）
    - Lint / 型チェックがパスする

- [x] **4. `collectSlotTypeIds` の `visitFlow` に `isForLoop` 分岐を追加**  ✓ 完了
  - 内容：
    - `collectSlotTypeIds` 内の `visitFlow` の for-loop 判定を追加:
      ```js
      const visitFlow = (items) => {
        if (!Array.isArray(items)) return;
        for (const item of items) {
          if (isLoop(item)) {
            ids.add('loop');
            visitFlow(item.loop.body);
          } else if (isForLoop(item)) {          // 新規
            ids.add('counter');                    // 既存 counter ヘルプを流用
            visitFlow(item.for.body);              // ネスト再帰
          } else if (isCondition(item)) {
            ids.add('condition');
            visitFlow(item.true);
            visitFlow(item.false);
          } else if (!isTurn(item)) {
            visitSlot(item);
          }
        }
      };
      ```
    - **`isForLoop(item)` を `isCondition(item)` の前に置く**（要件 8-1、for → counter ヘルプ流用）
    - body 内も再帰することでネスト for も検出（要件 8-2）
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：タスク1（`isForLoop` が定義済み）
  - 完了条件：
    - `for` 要素を含むステージの `stage.slotTypeIds` に `'counter'` が含まれる（新規 `'for'` は追加されない）
    - `for` 要素を含まない既存ステージの `slotTypeIds` は無変化
    - ネストした for でも `'counter'` は 1 回だけ含まれる（Set の重複排除）
    - `for` ステージに入場したとき、`progressStore.markSlotTypesSeen(stage.slotTypeIds)` により counter マスヘルプの伏せ字が解除される
    - Lint / 型チェックがパスする

## トレーサビリティ（要件 → タスク）

| 要件 | カバーするタスク |
|---|---|
| 1: `for` 要素の flow 内サポート | タスク1（`isForLoop`）、タスク3（if/else 分岐） |
| 2: `iterations` と `body` フィールド | タスク2（`expandForLoop` のバリデーション + body 展開） |
| 3: body 内のネスト構造 | タスク2（`processSubFlow` 再帰呼び出し）、タスク3（既存の condition / loop 分岐と同居） |
| 4: 座標の自動計算 | タスク2（`bodyResult.endColumn` 継承、y は同一） |
| 5: ID の一貫性 | タスク1（`ctx.forCounter` 共有）、タスク2（採番ロジック） |
| 6: エッジの自動生成 | タスク2（5 種類のエッジ生成）、タスク3（exit エッジは endings 経由で次要素展開時に生成） |
| 7: `forStarts` / `forEnds` 統合 | タスク1（`ctx` / `expandFlow` return / `expandStage` slots ルート） |
| 8: `collectSlotTypeIds` 統合 | タスク4 |
| 9: 既存機能との非干渉 | タスク1（既存 return は現状維持で新フィールド追加のみ）、タスク3（既存 if/else 分岐は無変更） |
| 10: バリデーションと警告 | タスク2（`expandForLoop` の validate）、タスク3（既存 turn ガード継承） |

全 10 要件がタスク1〜4 のいずれかでカバーされます。孤立した要件はありません。

## クリティカルパス

```
タスク1 (基盤: isForLoop, ctx, expandFlow/expandStage の空配列付与)
       ↓
タスク2 (expandForLoop 関数実装)
       ↓
タスク3 (processSubFlow if/else 分岐でワイヤリング)

タスク4 (collectSlotTypeIds visitFlow 分岐)  ← タスク1 完了後から並行可
```

タスク4 はタスク1 完了後から着手可能（`isForLoop` があれば動く）。タスク2, 3 と並行実装可能。

## 実装の注意点

- **タスク1 の `expandStage` slots ルート**：既存の stage オブジェクト構築のフィールド並びを崩さず、`mergeNodes: []` の直後に `forStarts: []` / `forEnds: []` を追加する。フィールド順序は動作に影響しないが、diff の読みやすさで既存パターンに揃える
- **タスク2 の `processSubFlow` 呼び出しの `isTopLevel: false`**：これにより body 内での turn 要素が既存ガード（"turn must be at flow top level" warn + skip）で自動的に弾かれる。要件 10-3 を追加コードなしで達成する仕組み
- **タスク2 の bodyResult.direction**：`processSubFlow` は `direction` フィールドも返すが、for の body 内で turn は disallowed なので `bodyResult.direction === 'right'` のはず。将来 body 内 turn を許可するときは for-end の位置計算を direction-aware に改修する必要がある（本仕様のスコープ外）
- **タスク2 の空 body**：`processSubFlow([])` は `{ endings: [{ nodeId: forStartId, sourceHandle: undefined }], endColumn: column + 1, ... }` を返す。この場合、for-end は `forStartColumn + 1` に配置され、for-start → for-end の直接エッジ 1 本と loop-back で構成される。実行時は空ループとして `iterations` 回だけ回る
- **タスク3 の分岐配置順序**：`isLoop → isForLoop → isCondition` の順で置く。既存の `isTurn` 分岐は if/else チェーンの最初、`else`（通常スロット）は最後を維持
- **タスク4 の分岐配置順序**：`visitFlow` でも同じ順序（`isLoop → isForLoop → isCondition → !isTurn の else`）に揃える
- **stage 4-2 の JSON 定義**：本仕様のスコープ外（ユーザー側実装）。タスク3 完了時点で `{ "for": { "iterations": 3, "body": [...] } }` シンタックスが使えるようになる
- **デバッグの実験用ステージ**：本仕様に含めず、ユーザー側の stages.json 追加や DevTools で確認する
