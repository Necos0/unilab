# タスク一覧: フローチャートの折り返し（turn）構文

## 概要

ローダー層（`stagesLoader.js`）→ 描画層（`SlotNode` / `GoalNode` / `MergeNode` への新ハンドル追加）の順でボトムアップに積む。クリティカルパスは「ローダー: 方向対応 → turn ハンドラ → goal 配置」の 3 ステップ。ハンドル追加は React Flow のカスタムノードコンポーネントへの独立した編集なので、ローダー実装と並行可能。ランタイム（`battleStore` / `simulateBattle`）への変更はなし。

**leftward 文脈での condition 対応の拡張（タスク 6〜7）** は本仕様第 2 弾。stage 3-4 のように「turn の後に condition がある」ユースケースを正式にサポートするため、`MergeNode` への新ハンドル追加と `processSubFlow` の condition ブランチを direction-aware に拡張する。要件 9〜16 / 実装方針 1-7 / トレーサビリティを参照。

合計タスク数：7件（うち 5 件完了）｜ 想定工数：5〜7時間（タスク 1〜5）+ 3〜4時間（タスク 6〜7）

## タスク

- [x] **1. ローダー基盤: `isTurn` ヘルパー、`processSubFlow` シグネチャ拡張、`ctx` 初期化、方向対応 column 計算、`isTopLevel` 伝播**  ✓ 完了
  - 内容：
    - `isTurn(item)` ヘルパーを `isCondition` / `isLoop` と並べて追加（`typeof item?.turn === 'object' && item.turn !== null`）
    - `processSubFlow` のシグネチャに `isTopLevel = false` と `direction = 'right'` を追加
    - `expandFlow` から呼ぶときのみ `isTopLevel: true` を渡す
    - `processSubFlow` 内の通常スロット展開で x 座標計算を方向対応にする（`column` を符号付き整数として扱い、配置後に `direction === 'right' ? +1 : -1` で更新）
    - 戻り値に `direction` と `yLevel` を追加（既存の `endings` / `endColumn` に加える）
    - `expandFlow` の `ctx` 初期化に `turnCount: 0` / `afterTurn: false` を追加
    - 再帰呼び出し（`expandLoop` のループボディ、`condition` の true / false 分岐）には `isTopLevel: false` を明示的に渡す（loop / cond 内の turn を後段で弾くため）
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：なし
  - 完了条件：既存ステージ（1-X〜5-X、turn を含まない全ステージ）のローダー展開結果が **本機能導入前と完全に同一**。direction の既定値 `'right'` で従来の column 増加パスを通り、`ctx.turnCount` / `ctx.afterTurn` は初期値のままで他フィールドに影響なし。Lint / 型チェックパス。

- [x] **2. ローダー: turn 要素ハンドラ（3 層バリデーション + `maxY` 動的計算 + エッジハンドル割り当て）**  ✓ 完了（warn メッセージ修正含む）
  - 内容：
    - `processSubFlow` の `for (const item of items)` ループ内に `isTurn(item)` 分岐を追加
    - 3 層バリデーション: (a) `!isTopLevel` → warn + skip、(b) `ctx.turnCount >= 1` → warn + skip、(c) `endings[0]?.nodeId === 'start'`（先頭 turn）→ warn + skip
    - `maxY` 動的計算: `Math.max(SLOT_Y_DEFAULT, ...ctx.slots.map((s) => s.position.y), ...ctx.conditions.map((c) => c.position.y))`
    - 状態更新: `currentYLevel = maxY + LOOP_ROW_GAP`、`currentDirection = 'left'`、`column = lastSlotColumn`、`ctx.turnCount += 1`、`ctx.afterTurn = true`、`endings` は維持（次スロット展開時に正しいエッジが生成される）
    - 通常スロット展開時のエッジ生成を分岐: (a) `ctx.afterTurn` が true なら `sourceHandle: 'down-out'` / `targetHandle: 'top'`、(b) `currentDirection === 'left'` なら `sourceHandle: 'left-out'` / `targetHandle: 'right-in'`、(c) それ以外（右向き既定）はハンドル指定なし
    - `ctx.afterTurn` は 1 エッジ消費したら false に戻す
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：タスク1
  - 完了条件：`flow: [{}, {}, {"turn": {}}, {}, {}]` をローダーに渡すと、設計書「データモデル」の例と同じ `stage.slots` / `stage.edges` が生成される（slot-3 が x=280 y=280、slot-4 が x=80 y=280、エッジに `down-out` / `top` / `left-out` / `right-in` が正しく付与）。3 層バリデーションのそれぞれで意図的にマルフォームな flow を投げると `console.warn` が出る。

- [x] **3. ローダー: `resolveGoalPlacement` の左向き対応 + `expandFlow` の goal エッジ生成更新**  ✓ 完了（yLevel typo 修正含む）
  - 内容：
    - `resolveGoalPlacement` に `result.direction === 'left'` ケースを追加: `position: { x: SLOT_X_START + result.endColumn * SLOT_X_STEP, y: result.yLevel }`、`targetHandle: 'right-in'`、`sourceHandle: 'left-out'` を返す
    - 既存の cond 出口ベースの placement パスと右向き既定パスは変更なし
    - `expandFlow` の最終エッジ生成箇所（goal へ向かう）で `goalPlacement.sourceHandle` を `buildEdge` に渡せるよう更新: `buildEdge({ ...ending, sourceHandle: goalPlacement.sourceHandle ?? ending.sourceHandle, targetHandle: goalPlacement.targetHandle }, 'goal')`
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：タスク1, タスク2
  - 完了条件：turn を含む flow で goal が行 2 の左端（x=-120、y=`maxY + LOOP_ROW_GAP`）に配置され、最終スロット→goal のエッジに `sourceHandle: 'left-out'` / `targetHandle: 'right-in'` が付与される。turn を含まない既存ステージでは goal 配置と最終エッジに変化なし。

- [x] **4. SlotNode に 3 つの新ハンドル追加（`down-out` / `left-out` / `right-in`）**  ✓ 完了
  - 内容：
    - `SlotNode.jsx` の return 内に 3 つの `<Handle>` 要素を追加
    - Bottom source: `type="source"` / `position={Position.Bottom}` / `id="down-out"`
    - Left source: `type="source"` / `position={Position.Left}` / `id="left-out"`
    - Right target: `type="target"` / `position={Position.Right}` / `id="right-in"`
    - すべて既存パターン踏襲: `className={styles.handle}` / `isConnectable={false}`
    - 既存ハンドル（Left target / Top target `top` / Right source / Top source `loop-out`）は無変更
  - ファイル：`frontend/src/features/battle/flowchart/SlotNode.jsx`
  - 依存：なし（ローダー実装と並行可能）
  - 完了条件：turn を含まない既存ステージで、`SlotNode` の見た目・挙動が一切変わらない（新ハンドルは透明で `pointer-events: none`、isConnectable=false により手動接続不可）。Lint / 型チェックパス。

- [x] **5. GoalNode に 1 つの新ハンドル追加（`right-in`）**  ✓ 完了
  - 内容：
    - `GoalNode.jsx` の return 内に 1 つの `<Handle>` 要素を追加
    - Right target: `type="target"` / `position={Position.Right}` / `id="right-in"`
    - 既存パターン踏襲: `className={styles.handle}` / `isConnectable={false}`
    - 既存ハンドル（Left target / Top target `top`）は無変更
  - ファイル：`frontend/src/features/battle/flowchart/GoalNode.jsx`
  - 依存：なし（タスク 4 と並行可能）
  - 完了条件：turn を含まない既存ステージで、`GoalNode` の見た目・挙動が一切変わらない。Lint / 型チェックパス。

- [x] **6. MergeNode に 2 つの新ハンドル追加（`right-in` / `left-out`）**  ✓ 完了
  - 内容：
    - `MergeNode.jsx` の return 内に 2 つの `<Handle>` 要素を追加
    - Right target: `type="target"` / `position={Position.Right}` / `id="right-in"`（leftward 文脈で true 分岐からの入力用）
    - Left source: `type="source"` / `position={Position.Left}` / `id="left-out"`（leftward 文脈で merge → 後続スロット出力用）
    - 既存パターン踏襲: `className={styles.handle}` / `isConnectable={false}`
    - 既存ハンドル（Left target / Top target `top` / Bottom target `bottom` / Right source）は無変更
  - ファイル：`frontend/src/features/battle/flowchart/MergeNode.jsx`
  - 依存：なし（タスク 7 と並行可能、SlotNode / GoalNode のタスク 4 / 5 と同じパターン）
  - 完了条件：rightward 文脈の既存ステージ（1-X〜5-X すべて）で `MergeNode` の見た目・挙動が一切変わらない。新ハンドルは未使用ハンドルとして無害に存在。Lint / 型チェックパス。

- [x] **7. ローダー: condition ブランチを direction-aware に拡張（実装方針 1-7 の全体）**  ✓ 完了
  - 内容：
    - `processSubFlow` の `else if (isCondition(item))` ブランチに `currentDirection` 分岐を導入
    - **1-7-1**: condition ノード配置時に `trueDir` 既定値を `currentDirection === 'left' ? 'left' : undefined` に切り替え（`falseDir` は方向不問で `undefined`、ConditionNode 側で `'down'` フォールバック）。入口エッジを `currentDirection === 'left'` のとき `sourceHandle: 'left-out'` / `targetHandle: 'right-in'` で生成。column 増分を `column += currentDirection === 'right' ? 1 : -1` に
    - **1-7-2**: true / false 再帰サブフロー呼び出しに既存どおり `direction: currentDirection` を伝播（既に存在）。false 分岐の `yLevel` は `currentYLevel + 160` のまま（要件 14-1）
    - **1-7-3**: `mergeColumn` 計算を `currentDirection === 'right' ? Math.max(...) : Math.min(...)` に切り替え（要件 9-4 / 14-4）
    - **1-7-4**: merge ノード x 座標の anchor offset を `currentDirection === 'right' ? -SLOT_X_STEP / 2 : SLOT_X_STEP / 2` に切り替え（要件 13-1）。y は共通で `currentYLevel + SLOT_HEIGHT / 2 - MERGE_SIZE / 2`
    - **1-7-5**: true → merge エッジ生成時、`currentDirection === 'left'` なら `targetHandle: 'right-in'` を付与（要件 11-5）。false → merge は方向不問で `targetHandle: 'bottom'`（既存どおり、要件 11-6）
    - **1-7-6**: merge → 後続スロットのエッジは通常スロット展開ロジック側で自動的に `currentDirection === 'left'` なら `left-out` / `right-in` を付与（タスク 2 で既に実装済み、追加実装不要）
    - `ConditionNode.jsx` は無変更（`directionToPosition(dir)` で `'left'` を自動処理する `flowchart-loop` 仕様）
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：タスク 6（MergeNode の新ハンドルが必要）
  - 完了条件：
    - **stage 3-4 が turn 込みで正常に表示される**：最後の cond が leftward 既定値（true=left / false=down）で動き、false 分岐の monster:100 が行 3（y=600 付近）に左向きで配置、merge → 後続スロット → goal までが左向きに連結
    - **既存ステージ（1-X〜5-X、turn 含むが turn 後に cond を持たない 2-2 等）のローダー出力がバイト等価**：`stage.slots` / `stage.conditions` / `stage.mergeNodes` / `stage.edges` がすべて拡張前と完全に一致（要件 16）
    - Lint / 型チェックパス。`[stagesLoader]` の想定外 warn が出ない

## トレーサビリティ（要件 → タスク）

| 要件 | カバーするタスク |
|---|---|
| 1: turn 構文の追加とローダー認識 | タスク1（`isTurn`）, タスク2（バリデーション） |
| 2-1〜2-4: 折り返し後のレイアウト | タスク1（column 計算）, タスク2（turn ハンドラの状態更新）, タスク3（goal 配置） |
| 2-5: false 分岐ありの動的 y 計算 | タスク2（`maxY` 動的計算） |
| 2-6: 垂直下エッジの視覚横切り許容 | （実装タスクなし、設計の未確定セクションで明文化済み） |
| 3: 折り返し時のエッジ描画 | タスク2（エッジハンドル割り当て）, タスク3（goal エッジ） |
| 4: ハンドル構成の拡張 | タスク4（SlotNode）, タスク5（GoalNode） |
| 5: 将来拡張を見込んだスキーマ | タスク1（`isTurn` でオブジェクト判定）, タスク2（複数 turn の warn + skip） |
| 6: turn の配置制約 | タスク1（`isTopLevel` 伝播）, タスク2（バリデーション 1） |
| 7: 既存ステージへの非破壊性 | 各タスクの完了条件で「既存ステージへの影響なし」を担保 |
| 8: ランタイムでの実行 | （実装タスクなし、`battleStore` / `simulateBattle` への変更なし、設計で明示済み） |
| 9-1〜9-3: leftward cond 配置と direction 伝播 | タスク7（1-7-1 / 1-7-2） |
| 9-4〜9-5: mergeColumn 計算と column 増減の direction 対応 | タスク7（1-7-3 / 1-7-1） |
| 10-1〜10-4: trueDir / falseDir の direction-aware 既定値 | タスク7（1-7-1 の既定値分岐） |
| 11-1〜11-6: leftward cond 周辺のエッジハンドル | タスク7（1-7-1 入口 / 1-7-5 true→merge / 1-7-6 merge→後続） |
| 12: MergeNode のハンドル拡張 | タスク6 |
| 13-1〜13-3: merge ノードの座標計算 direction-aware | タスク7（1-7-4） |
| 14-1〜14-4: false 分岐の行配置と column 採用 | タスク7（1-7-2 / 1-7-3） |
| 15-1〜15-5: stage 3-4 への適用（具体成果物） | タスク7 全体の完了条件（stages.json への変更なし、leftward 既定値で動く） |
| 16-1〜16-3: 既存ステージ非破壊性の再確認 | タスク6 / タスク7 の完了条件（バイト等価担保） |

要件 2-6 と要件 8 は実装タスクを持たない（設計判断として「変更しない」/「ステージデザイナーの責務」と明文化されているため）。それ以外の全要件はタスク 1〜7 のいずれかでカバーされる。

## クリティカルパス

```
第 1 弾（タスク 1〜5、完了済み）:
タスク1 (基盤) → タスク2 (turn ハンドラ) → タスク3 (goal 配置)
タスク4 (SlotNode) / タスク5 (GoalNode) は並行可能

第 2 弾（タスク 6〜7、leftward cond 拡張）:
タスク6 (MergeNode ハンドル) → タスク7 (ローダー condition direction-aware)
```

タスク 4（SlotNode）とタスク 5（GoalNode）は **タスク 1〜3 と並行可能**（独立した React コンポーネント編集）。ただし turn を含むステージを実機で動かすにはタスク 1〜5 すべてが完了している必要がある（ローダーが新ハンドル ID を指定したエッジを出力しても、ハンドル側が無いと React Flow が接続できないため）。

タスク 6（MergeNode）は **タスク 1〜5 と並行可能**（独立した React コンポーネント編集）。ただしタスク 7 のローダー側で `right-in` / `left-out` ハンドルを使うエッジを出力するため、タスク 7 開始時点でタスク 6 が完了している必要がある。

実装順序の推奨（第 1 弾は完了済み、第 2 弾を新規に進める）:

1. ~~タスク 1（基盤、既存挙動の非破壊性を確認）~~ ✓
2. ~~タスク 4（SlotNode ハンドル、独立で完結）~~ ✓
3. ~~タスク 5（GoalNode ハンドル、独立で完結）~~ ✓
4. ~~タスク 2（turn ハンドラ）~~ ✓
5. ~~タスク 3（goal 配置）~~ ✓
6. **タスク 6（MergeNode ハンドル、独立で完結）** ← 第 2 弾のスタート
7. **タスク 7（ローダー condition direction-aware）** ← 仕上げ、stage 3-4 で動作確認

この順序だと、タスク 6 を完了した時点で「既存ステージの動作確認」をして非破壊性を確認でき、その後タスク 7 で leftward cond 機能を完成させる流れになる。タスク 7 完了時点で stage 3-4 が turn 込みで正常表示されることが最終ゴール。
