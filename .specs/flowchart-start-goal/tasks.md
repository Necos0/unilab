# タスク一覧: フローチャートのスタート／ゴールマーカー

## 概要

まず SVG アセットを `public/icons/flowchart/` に追加し、同時に README のディレクトリ構造を更新する（CLAUDE.md の同期ルール）。次に `StartNode` / `GoalNode` のコンポーネントを 1 タスクで作成（構造がほぼ同じなのでセットで進めるほうが効率的）。続いて `stages.json` に `start` / `goal` 定義と関連エッジを追加し、最後に `FlowchartArea.jsx` でノード生成・`nodeTypes` 登録・整合性チェックの拡張をまとめて反映する。タスク 4 完了時点でブラウザで「→」「🏁」が表示され、エッジが繋がった状態が確認できる。

合計タスク数：4件 ｜ 想定工数：約 2 時間

## タスク

- [ ] **1. SVG アセットを追加し README を更新する**
  - 内容：
    - `public/icons/flowchart/start.svg` を新規作成。viewBox `0 0 80 80`、内容は右向きの矢印（線太さ 6〜8px、`stroke-linecap: round` で柔らかい印象）。色は `#e5e5ff`
    - `public/icons/flowchart/goal.svg` を新規作成。viewBox `0 0 80 80`、内容はモノクロの旗（左に縦のポール、右に三角の旗のシルエット）。色は `#e5e5ff`
    - `README.md` の「ディレクトリ構造」セクションに `public/icons/flowchart/` を追加し、配下に `start.svg` と `goal.svg` を載せる。「今後追加予定のディレクトリ」表に `public/icons/` がある場合は説明文を整理する（必要なら `flowchart/` に絞った形で残す）
  - ファイル：`frontend/public/icons/flowchart/start.svg`（新規）、`frontend/public/icons/flowchart/goal.svg`（新規）、`README.md`
  - 依存：なし
  - 完了条件：`npm run build` がパスし、ビルド成果物の `dist/icons/flowchart/start.svg` などにファイルが含まれる。README の構造図に新規ディレクトリ・ファイルが反映されている

- [ ] **2. `StartNode` と `GoalNode` コンポーネントを新規作成する**
  - 内容：
    - `StartNode.jsx`：
      - React Flow カスタムノードとして実装。`useDroppable` は使わない（要件 4-1 を構造的に保証）
      - `<img src="/icons/flowchart/start.svg" alt="スタート" />` でアイコン描画
      - 右辺に `<Handle type="source" position={Position.Right} isConnectable={false} />` を 1 つだけ持つ
      - Google 形式の日本語 docstring
    - `StartNode.module.css`：
      - `.marker { width: 80px; height: 120px; display: flex; align-items: center; justify-content: center; pointer-events: none; }`
      - `.icon { width: 48px; height: 48px; }`
      - `.handle { width: 1px; height: 1px; opacity: 0; pointer-events: none; background: transparent; border: none; }`（`SlotNode.module.css` の `.handle` と同等）
    - `GoalNode.jsx`：StartNode と同構造だが `<Handle type="target" position={Position.Left} ... />` を持ち、アイコンは `goal.svg`、`alt="ゴール"`
    - `GoalNode.module.css`：StartNode と同じスタイル（将来別調整できるよう独立ファイル）
  - ファイル：`frontend/src/features/battle/flowchart/StartNode.jsx`（新規）、`StartNode.module.css`（新規）、`GoalNode.jsx`（新規）、`GoalNode.module.css`（新規）
  - 依存：タスク1
  - 完了条件：`npm run lint` / `npm run build` がパスする。他コンポーネントから import してビルドエラーが出ない（この時点では未使用でも import 経路上の問題が無いことを確認）

- [ ] **3. `stages.json` に `start` / `goal` とエッジを追加する**
  - 内容：
    - 既存の `1-1` ステージに以下を追加：
      - `"start": { "position": { "x": -120, "y": 120 } }`
      - `"goal": { "position": { "x": 680, "y": 120 } }`
    - `edges` 配列の先頭と末尾に以下を追加：
      - 先頭：`{ "id": "e-start-1", "source": "start", "target": "slot-1" }`
      - 末尾：`{ "id": "e-3-goal", "source": "slot-3", "target": "goal" }`
    - 既存の `e1-2`、`e2-3` はそのまま残す
  - ファイル：`frontend/src/data/stages.json`
  - 依存：なし（タスク 4 が完成しないと実際の描画には反映されないが、データだけ先に入れて差し支えない）
  - 完了条件：`npm run lint` / `npm run build` がパスする。JSON 構文エラーなく既存ステージが従来どおり読み込める（フローチャート描画自体は次タスクまで変わらない）

- [ ] **4. `FlowchartArea` でマーカーを統合する**
  - 内容：
    - 新規ヘルパー関数を追加：
      - `startToNode(start)`：`start` が無ければ `null`、あれば `{ id: 'start', type: 'start', position: start.position, data: {} }`
      - `goalToNode(goal)`：`goal` が無ければ `null`、あれば `{ id: 'goal', type: 'goal', position: goal.position, data: {} }`
    - `edgesToFlowEdges` のシグネチャを `(edges, slots, hasStart, hasGoal)` に拡張し、`validIds` セットに `hasStart` の場合は `'start'`、`hasGoal` の場合は `'goal'` を追加
    - `nodes` を `useMemo` で組み立てる際に `slotsToNodes(stage.slots)` の結果に `startNode` と `goalNode` を結合（`null` でないものだけ）
    - `edges` の `useMemo` 呼び出しを新シグネチャに合わせる
    - `nodeTypes` に `start: StartNode`、`goal: GoalNode` を追加
    - import 文に `StartNode` / `GoalNode` を追加
    - docstring を「スタート／ゴールマーカーも含めて描画する」旨に更新
  - ファイル：`frontend/src/features/battle/flowchart/FlowchartArea.jsx`
  - 依存：タスク2、タスク3
  - 完了条件：`npm run lint` / `npm run build` がパスする。ブラウザで以下が動く：
    - フローチャートの最左に「→」マーカー、最右にモノクロ旗マーカーが表示される
    - スタート → slot-1、slot-3 → ゴールの矢印が描画される
    - スタート／ゴール上にカードをドロップしようとしても置けず、ドラッグ元（手札 or 元スロット）に戻る
    - ドラッグ中にスタート／ゴールがハイライトされない
    - 拡大／縮小切替時もスタート／ゴールが既存スロットと一緒にスケール変化する
    - リセットボタンを押してもスタート／ゴールの表示は変わらない
    - 仮に `stages.json` から `start` 定義を一時的に外しても、エッジの整合性チェックで警告を出しつつ画面はクラッシュせず描画される
