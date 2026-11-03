# タスク一覧: ステージ 5-1（改）

## 概要

既存エンジンは無改変。`stages.json` の `"5-1"` を設計どおりの `flow` に差し替え、`simulateBattle` による解答クリア検証と build/lint で品質を担保する。

合計タスク数：4件 ｜ 想定工数：1〜1.5時間

## タスク

- [ ] **1. `stages.json` の `5-1` を差し替える**
  - 内容：`enemyId=black_wing_dragon` / `maxEnemyHp=270` / 手札11枚 / `flow`（while①＋if分岐、while②、`-60`→`+45`、for×5＋二重分岐＋共有`-15`→`[9]`、`[10]` に `multiplier:4`、`[1]` に `acceptOnly:guard`）を `design.md` のとおり記述。コメントなしの純 JSON。
  - ファイル：`src/data/stages.json`
  - 依存：なし
  - 完了条件：`node -e "require('./src/data/stages.json')"` でパース成功、`stagesLoader` 展開で warn が出ない。

- [ ] **2. 解答クリアをヘッドレス検証する**
  - 内容：`stagesLoader` で展開した `5-1` から `nodeMap`/`edgesBySource`/`slotMetadata` を組み立て（`battleStore.startExecution` と同手順）、**解答配置**（slot-1=防10, slot-2=防25, slot-3=回30, slot-4=回25, slot-5=攻6, slot-6=カウンター, slot-7=防10, slot-8=攻10, slot-9=攻20, slot-10=攻15）を `slotAssignments` に入れ、`initialState`（playerHp=100, enemyHp=270, forLoopCounters={'for-start-1':5}）で `simulateBattle` を実行。
  - ファイル：検証スクリプト（scratchpad・非コミット）
  - 依存：タスク1
  - 完了条件：`simulateBattle` が `'win'` を返す（要件3-1）。

- [ ] **3. 引っかけが未クリアになることを確認する**
  - 内容：`[5]`（while①の攻撃）に攻20 を置く等、設計が想定する誤配置が `'lose'`（または非 win）になることを 1〜2 ケース確認（要件3-2）。
  - ファイル：同上
  - 依存：タスク2
  - 完了条件：誤配置ケースが `'win'` を返さない。

- [ ] **4. build / lint**
  - 内容：`npm run build` と `npm run lint` を通す。
  - ファイル：—
  - 依存：タスク1
  - 完了条件：エラーなく通過（既存の無関係警告を除く）。

## 要件トレーサビリティ

| 要件 | タスク |
|---|---|
| 1・2・4（パラメータ・構造・敵カード） | 1 |
| 3（解答成立・意図保全） | 2・3 |
| 5（非回帰） | 1・4 |
