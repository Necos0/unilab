# タスク一覧: フローチャートのループ（while / do-while）構文

## 概要

クリティカルパスは「ローダーの loop 展開（タスク2）→ ステージ定義（タスク9）→
統合確認（タスク10）」。描画ハンドル（タスク3〜5）・条件方向の可変化（タスク1）・
ランタイム（タスク6〜8）はおおむね独立に進められ、最後にステージで合流して動作を
検証する。各タスクは「既存ステージ（線形・分岐 3-x）が壊れないこと」を後方互換の
完了条件に含める。

合計タスク数：11件（うち1件は任意） ｜ 想定工数：9〜11時間

> teachingモードのため、各タスクは「Claude がコード提案 → ユーザーが実装 →
> 『完了しました』報告 → Claude が検証 → docstring を Claude が記入」の流れで進める。

## タスク

- [x] **1. cond の出口方向（true/false）を可変化する**  ✓ 完了
  - 内容：条件ノードの true/false ソースハンドルの位置を `stages.json` 指定で
    変えられるようにする。ローダーは `trueDir`/`falseDir` を条件オブジェクトへ
    透過し、`FlowchartArea` が `data` に転記、`ConditionNode` が
    `directionToPosition()`（インライン純関数、`right→Right`/`left→Left`/
    `up→Top`/`down→Bottom`、不正値は warn して既定）でハンドル位置を決める。
    ハンドル id は `'true'`/`'false'` のまま（論理不変）。
  - ファイル：`frontend/src/data/stagesLoader.js`（`processSubFlow` の condition
    push と `expandConditions`）、`frontend/src/features/battle/flowchart/FlowchartArea.jsx`
    （`conditionsToNodes`）、`frontend/src/features/battle/flowchart/ConditionNode.jsx`
  - 依存：なし
  - 完了条件：既存 3-1/3-2 が既定（true=右 / false=下）で従来どおり描画される。
    条件に `trueDir`/`falseDir` を足すと向きが変わる。型/Lint パス。

- [x] **2. ローダーに loop 構文の展開（前置/後置）を実装する**  ✓ 完了
  - 内容：`flow` 要素の `item.loop` を検出し `expandLoop` で展開。merge ノード・
    cond ノード（`trueDir`/`falseDir` 付き）・body スロット列を生成し、`mode`
    （`pre`/`post`、既定 `pre`、不正値は warn して `pre`）で結線を分岐する。
    前置＝`prev→merge→cond`、`cond -false→ body[0]…body[last] -loop-out/top→ merge`、
    脱出は `cond.true`。後置＝`prev→merge→body[0]…body[last]→cond`、
    `cond -false/top→ merge`（戻り）、脱出は `cond.true`。`condition` 非文字列・
    `body` 非配列は warn してスキップ。座標は既存の column 方式＋merge 中心アンカーを踏襲。
  - ファイル：`frontend/src/data/stagesLoader.js`（`expandLoop` 追加、`processSubFlow`
    にループ分岐、`isLoop` ヘルパー）
  - 依存：タスク1（条件方向の透過を前提にする）
  - 完了条件：4-1（前置）/4-2（後置）を `flow` に書くと、期待どおりの
    `slots`/`conditions`/`mergeNodes`/`edges` に展開される。線形・分岐（3-x）の
    展開結果は不変。型/Lint パス。

- [x] **3. MergeNode に戻りエッジ受け口（Top target）を追加する**  ✓ 完了
  - 内容：`MergeNode` に `Position.Top` の target ハンドル（`id="top"`）を追加する。
    戻りエッジが merge の上辺から進入できるようにする。既存の Left(target)/
    Bottom(target,id=bottom)/Right(source) は維持。
  - ファイル：`frontend/src/features/battle/flowchart/MergeNode.jsx`
  - 依存：なし
  - 完了条件：既存の分岐ステージ（merge を使う 3-1/3-2）が従来どおり描画される。
    新 `top` ハンドルは未参照時に無害。型/Lint パス。

- [x] **4. SlotNode に戻りエッジ出口（Top source）を追加する**  ✓ 完了
  - 内容：`SlotNode` に `Position.Top` の source ハンドル（`id="loop-out"`）を
    追加する。前置ループの最終 body スロットから上向きに戻りエッジを出せるように
    する。既存の Left(target)/Top(target,id=top)/Right(source) は維持。
  - ファイル：`frontend/src/features/battle/flowchart/SlotNode.jsx`
  - 依存：なし
  - 完了条件：既存ステージのスロット描画・カード D&D・実行ハイライトが不変。
    型/Lint パス。

- [x] **5. AnimatedProgressEdge：戻りエッジの smoothstep 化と Yes/No ラベルの方向追従**  ✓ 完了
  - 内容：`shouldUseStep` に `targetHandleId === 'top'`（戻りエッジ）を OR で追加し、
    戻りエッジを `getSmoothStepPath` で上側を回す U 字経路にする。`はい`/`いいえ`
    ラベルの描画位置を、出口方向（`sourcePosition`/`sourceHandleId`）に応じた
    オフセットへ変更し、向きが変わってもエッジ根本に表示されるようにする。
  - ファイル：`frontend/src/features/battle/flowchart/AnimatedProgressEdge.jsx`
  - 依存：なし（描画ロジックのみ）
  - 完了条件：既存の false→merge(bottom) 経路は従来どおり smoothstep で描かれる。
    `targetHandle:'top'` の戻りエッジが上を回る。3-1/3-2 の Yes/No ラベルが
    既定方向で正しい位置に出る。型/Lint パス。

- [x] **6. battleStore：stage レベルの敵HP上書きを追加する**  ✓ 完了
  - 内容：`initializeBattle` で敵HP決定を `const maxEnemyHp = stage.maxEnemyHp ??
    enemy?.maxHp ?? 0;` に変更し、`stages.json` 側で `maxEnemyHp` を指定できる
    ようにする（パズル用HPを `enemies.json` を汚さず設定）。
  - ファイル：`frontend/src/stores/battleStore.js`（`initializeBattle`）
  - 依存：なし
  - 完了条件：`maxEnemyHp` 未指定の既存ステージは従来の敵HP。指定ステージはその値で
    初期化される。型/Lint パス。

- [x] **7. battleStore：周回ガード（live 保険）を追加する**  ✓ 完了
  - 内容：定数 `LOOP_MAX_VISITS = 100` を追加。`beginSequence` にクロージャ
    `nodeVisitCounts = {}` を持ち、`scheduleNodePhase` の `failPhase` ガード直後で
    当該ノードの訪問回数を加算。いずれかが 100 を超えたら `cancelExecutionTimers()`
    ＋ `set({ failPhase:'shown', isExecuting:false, executionStep:null, currentPhaseMs:null })`
    で打ち切る。
  - 位置づけ（改訂）：当初これが主検出だったが、runaway が 100 周ぶんアニメして
    から負けになり待ち時間が長い。**主検出はタスク12の実行前シミュレーション**に移し、
    本ガードは sim が runaway を見逃した場合の **live 最終保険**として残す。
  - ファイル：`frontend/src/stores/battleStore.js`（モジュール定数、`startExecution`
    内 `beginSequence`/`scheduleNodePhase`）
  - 依存：なし
  - 完了条件：通常ステージは発火せず完走。runaway は最終的に 100 周で停止し
    `executionTimers` が残らない。型/Lint パス。

- [x] **8. battleStore：未使用の buildExecutionPath を削除する**  ✓ 完了
  - 内容：`buildExecutionPath`（呼び出し元なしの死にコード）を削除し、それを参照
    する古い docstring（実行シーケンスの説明）を実体（`startExecution` の動的
    エッジ追跡＋周回ガード）に合わせて書き換える。削除前に `grep` で他参照が
    無いことを再確認する。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：なし（タスク7と同じファイルのため、続けて行うと衝突が少ない）
  - 完了条件：`buildExecutionPath` への参照がゼロ。実行は従来どおり動作。型/Lint パス。

- [x] **9. stages.json に 4-1（前置）/ 後置検証を追加し demo に載せる**  ✓ 完了（4-2 の代わりに 4-3＝後置 do-while を採用。`demoStageIds` に 4-1/4-3）
  - 内容：設計の定義どおり stage 4-1（`mode:"pre"`、`maxEnemyHp:60`、手札 攻撃15/
    防御10、body「空き→monster:20→空き」、`enemyHp <= 0`、true=down/false=right）と
    stage 4-2（`mode:"post"`、`maxEnemyHp:40`、手札 攻撃20/防御10、body「空き→
    monster:15→空き」、true=down/false=up）を追加。`demoStageIds` に `"4-1"`/`"4-2"`
    を加える。
  - ファイル：`frontend/src/data/stages.json`
  - 依存：タスク2（展開）。動作にはタスク1・3・4・5・6・7 も必要。
  - 完了条件：バトルデモから 4-1/4-2 を選べる。展開・描画でコンソールエラーが出ない。

- [x] **12. 実行前シミュレーションで無限ループを即検出する**  ✓ 完了
  - 内容：純関数モジュール `frontend/src/engine/simulateBattle.js`（新規）に
    `applyNodeEffect(state, card, multiplier)` / `clearTransientBuffs(state, prevCard)` /
    `simulateBattle({edgesBySource, nodeMap, slotAssignments, slotMetadata, initialState, maxVisits})`
    を実装（live のエッジ追跡＋数値遷移をエフェクト抜きで写す。条件は共有の
    `evaluateCondition` を使用）。`battleStore.startExecution` の `beginSequence` で
    アニメ前に `simulateBattle` を実行し、`'runaway'` なら即 `failPhase:'shown'`（アニメ
    せず負け）。それ以外は従来どおりアニメし、結果を退避。開発時（`import.meta.env.DEV`）
    のみ `scheduleComplete` で live 結果と sim 結果を突き合わせ、不一致なら `console.warn`。
    live 100周ガード（タスク7）は最終保険として残す。
  - ファイル：`frontend/src/engine/simulateBattle.js`（新規）、
    `frontend/src/stores/battleStore.js`
  - 依存：タスク2（loop 展開）、タスク6/Issue1（敵HP）。`evaluateCondition` は既存流用。
  - 完了条件：runaway なループは Play 押下で**アニメ無しに即 Fail**。終了する解は
    従来どおりアニメして勝敗が出る。既存ステージ（線形・分岐）は sim/live 結果が
    一致し警告が出ない。型/Lint パス。

- [x] **13. cond の縦方向 exit（goal が真下/真上）を一直線に揃える**  ✓ 完了
  - 内容（ブラウザ確認で発覚した描画課題）：`trueDir:'down'` 等で goal を cond の
    下に置くと、cond 下頂点（中心 x）と goal 左ハンドル（左端 x）がズレてエッジが
    傾く。GoalNode に **Top target ハンドル**（`id="top"`）を追加し、ローダーで
    縦方向 exit の goal を **cond 中心の真下/真上に center 揃え**＋ goal への
    エッジに `targetHandle`（down→`'top'` / up→`'bottom'` / left→`'right'` / right→既定）
    を付与する。
  - ファイル：`frontend/src/features/battle/flowchart/GoalNode.jsx`、
    `frontend/src/data/stagesLoader.js`（`COND_WIDTH` 定数、`positionInDirection`/
    `computeGoalPosition` を `goalPositionFromCond`/`resolveGoalPlacement` に置換、`expandFlow`）
  - 依存：タスク2
  - 完了条件：4-1 の true エッジが cond 直下の goal へ真っ直ぐ降りる。右方向 exit の
    既存ステージ（3-x）は不変。型/Lint パス。

- [ ] **14. ループ戻りエッジが fitView で見切れないよう上部余白を確保する**
  - 内容：`fitView` はノード bbox のみに合わせ、行の上を通る戻りエッジが切れる。
    縮小表示の refit を `getNodesBounds` ＋ `fitBounds` に変え、戻りエッジ
    （`targetHandle === 'top'` のエッジが在るとき）は上方向に `LOOP_TOP_HEADROOM`
    の余白を足した bounds に合わせる。非ループ（戻りエッジ無し）は従来どおり。
  - ファイル：`frontend/src/features/battle/flowchart/FlowchartArea.jsx`
  - 依存：タスク2・3・5
  - 完了条件：4-1 の戻りエッジ全体が縮小表示で収まる。線形・分岐ステージの表示は不変。型/Lint パス。

- [ ] **10. 統合動作確認（型/Lint ＋ ユーザー主導のブラウザ確認）**
  - 内容：`npm run lint` と `npm run build`（型・ビルド）を通す。ブラウザでの
    表示・操作確認は **ユーザーの明示指示があるときのみ**（CLAUDE.md 準拠）。
    確認観点：前置 4-1（false で右ボディ反復→上側を戻る／true で下 Goal、初手成立
    なら 0 回）、後置 4-2（最低 1 回ボディ実行→成立で脱出）、戻りエッジの U 字描画、
    周回ガード（成立しない組みで 100 周 Fail）、勝敗判定、既存ステージの非回帰。
  - ファイル：（コード変更なし。確認のみ。生成物・スクショは残さない＝CLAUDE.md）
  - 依存：タスク1〜9
  - 完了条件：lint/build パス。ユーザーが 4-1/4-2 を実機確認し、前置/後置の挙動・
    戻りエッジ・勝敗・周回ガードが要件どおりであることを確認。

- [ ] **11.（任意）docs に loop の解説を追加する**（README 同期は実施済み）
  - 内容：`README.md` の構造図に `frontend/src/engine/`（`evaluateCondition.js` /
    `simulateBattle.js`）を反映済み（`simulateBattle.js` 追加に伴う必須同期）。残るは
    任意の解説 `docs/flowchart-loop.md`（loop 構文・前置/後置の結線・戻りエッジ・実行前
    シミュレーション）を既存 `docs/flowchart-rendering.md` と同じ Mermaid スタイルで作成。
  - ファイル：`docs/flowchart-loop.md`（新規・任意）、`README.md`（同期済み）
  - 依存：タスク1〜9・12
  - 完了条件：（任意）解説が実装と一致。README は同期済み。

---

## トレーサビリティ（要件 → タスク）

| 要件 | 対応タスク |
|---|---|
| 1: loop 構文＋展開 | 2 |
| 2: true/false 出口方向 | 1 |
| 3: 戻りエッジ描画 | 3, 4, 5 |
| 4: ランタイムのループ実行 | （既存エンジンで成立）9・10 で検証 |
| 5: 無限ループ防止ガード | 12（実行前 sim・主検出）＋ 7（live 保険） |
| 6: stage 4-1 | 6, 9 |
| 7: 未使用コード整理 | 8 |
| 8: 条件位置パラメータ | 2 |
| 9: 後置検証ステージ | 9 |

> 要件4は新規コードを伴わず、既存の動的エッジ追跡で満たされる。タスク9で
> 4-1/4-2 を定義し、タスク10の実機確認で「ボディ毎周回適用・条件再評価・脱出」
> を検証する位置づけ。
