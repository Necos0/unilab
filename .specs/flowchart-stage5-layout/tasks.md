# タスク一覧: フローチャート縦レイアウト拡張（stage5 向け）

## 概要

共通部品「下回りエッジ」を描画側に 1 つ足し、ローダーに `newline` 構文と `exitRoute` タグを追加する。既存ステージ非破壊を最優先し、未使用時バイト一致で担保する。

合計タスク数：6件 ｜ 想定工数：3〜4時間

## タスク

- [ ] **1. エッジが `data` を描画コンポーネントへ運ぶことを確認／必要なら中継**
  - 内容：`FlowchartArea` の `edgesToFlowEdges` が `edge.data`（`route`/`laneY`/`loopDepth`）を React Flow edge に載せているか確認。載っていなければ中継を足す。
  - ファイル：`src/features/battle/flowchart/FlowchartArea.jsx`
  - 完了条件：`data.route`/`data.laneY` が `AnimatedProgressEdge` の props `data` に届く。

- [ ] **2. 共通部品「下回りエッジ」を `AnimatedProgressEdge` に実装**
  - 内容：`data.route === 'under'` のとき `getSmoothStepPath({…, centerY: data.laneY, offset})`。非対応時は自作直交パスにフォールバック。
  - ファイル：`AnimatedProgressEdge.jsx`
  - 依存：1
  - 完了条件：`route:'under'` のエッジが laneY まで降りて水平移動する経路になる。他エッジは不変。

- [ ] **3. `buildEdge` を `data` 対応に拡張**
  - 内容：`ending.route`/`ending.laneY`（または呼び出し時指定）を `edge.data.route`/`edge.data.laneY` に転記。`sourceHandle`/`targetHandle` と同じ任意フィールド方式。既存の `data.loopDepth` 付与箇所とも整合。
  - ファイル：`stagesLoader.js`
  - 完了条件：`data` 無しのエッジは従来と同一形。

- [ ] **4. `newline` 構文を `processSubFlow` に追加**
  - 内容：`isNewline(item)` 判定＋分岐。top-level/先頭/内側のバリデーション（`turn` 準拠、複数回可）。行ジャンプ（maxY+LOOP_ROW_GAP）、`column=0`、方向 right 維持、`ctx.afterNewline=true`/`ctx.newlineLaneY` 設定。直後スロットのエッジに `route:'under'`+`laneY` を一回付与。`ctx` 初期化に `afterNewline`/`newlineLaneY` を追加。
  - ファイル：`stagesLoader.js`
  - 依存：3
  - 完了条件：`newline` 後ノードが新行・左端に、接続エッジが under。

- [ ] **5. `expandLoop` に `exitRoute:"under"` を追加**
  - 内容：`loopDef.exitRoute === 'under'` のとき、脱出 `endings` に `route:'under'`+`laneY`（false 分岐の下）を載せ、次要素接続時に under エッジになるようにする。
  - ファイル：`stagesLoader.js`
  - 依存：3
  - 完了条件：脱出エッジが false 列の下を通る。

- [ ] **6. 検証（ヘッドレス＋非回帰＋build/lint）**
  - 内容：(a) 5-1 展開で newline 後ノードの行y・column、脱出/改行エッジの `data.route/laneY` を検査。(b) 1-1〜4-4 の展開が変更前と**一致**（スナップショット比較）。(c) build/lint。
  - ファイル：検証スクリプト（scratchpad・非コミット）
  - 依存：2,4,5
  - 完了条件：(a)(b)(c) すべて通過。

## 要件トレーサビリティ

| 要件 | タスク |
|---|---|
| 1（exitRoute） | 3・5・2 |
| 2（newline） | 3・4・2 |
| 3（非回帰） | 3・6(b) |
| 4（検証可能性） | 6 |
