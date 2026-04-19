# タスク一覧: フローチャートの描画

## 概要

下から積み上げる順で実装する：

1. **データ層**（`stages.json`）を先に確定させ、以降のコンポーネントが参照できるようにする
2. **末端コンポーネント**（`SlotNode`）を作り、単体で見た目を確認できる状態にする
3. **コンテナ**（`FlowchartArea`）でステージデータを React Flow に流し込む
4. **画面統合**（`BattleScreen`）でプレースホルダを差し替える
5. **ドキュメント更新**（`README.md`）でディレクトリ構造を実装に追従させる

クリティカルパスはタスク1→2→3→4の一直線。タスク5は4と並行可能。

合計タスク数：5件 ｜ 想定工数：約6〜8時間

## タスク

- [x] **1. ステージデータ JSON の作成**  ✓ 完了
  - 内容：動作確認用に 1 ステージのスロット・エッジ定義を作成する。スロット3個を直列に接続（`slot-1 → slot-2 → slot-3`）する構成。
  - ファイル：`frontend/src/data/stages.json`
  - 依存：なし
  - 完了条件：
    - `stages.json` に `stages[0]` として `id: "stage-00"`・slots 3件・edges 2件が含まれる
    - 各スロットに `id` と `position: { x, y }` が定義されている
    - 各エッジに `id`・`source`・`target` が定義されている
    - JSON として valid（`node -e "JSON.parse(require('fs').readFileSync('frontend/src/data/stages.json'))"` が通る）

- [x] **2. `SlotNode` コンポーネントの作成**  ✓ 完了
  - 内容：React Flow のカスタムノードとして空きスロット（点線枠）を描画する。`source` / `target` の Handle は非表示で保持する（エッジがきれいに接続されるため）。
  - ファイル：
    - `frontend/src/features/flowchart/SlotNode.jsx`
    - `frontend/src/features/flowchart/SlotNode.module.css`
  - 依存：なし
  - 完了条件：
    - 点線ボーダー・角丸・カード型比率（幅:高さ ≒ 1:1.4）で空き枠が描画される
    - `Handle` が `source`（右端）と `target`（左端）に存在するが視覚的には見えない
    - Google docstring 形式のコメントがクラス/関数に付与されている（CLAUDE.md 準拠）
    - 1 ファイル 1 クラス（コンポーネント）を守っている

- [x] **3. `FlowchartArea` コンポーネントの作成**  ✓ 完了
  - 内容：React Flow キャンバスを描画し、`stages.json` のスロット/エッジを React Flow 用のノード/エッジに変換する。不正エッジ（source/target が存在しない）は silent に除外（`console.warn` のみ）。パン・ズーム・ドラッグ・選択は全て無効化し、`fitView` で初期表示する。
  - ファイル：
    - `frontend/src/features/flowchart/FlowchartArea.jsx`
    - `frontend/src/features/flowchart/FlowchartArea.module.css`
  - 依存：タスク1、タスク2
  - 完了条件：
    - `slotsToNodes` / `edgesToFlowEdges` が同ファイル内に定義されている
    - エッジに `markerEnd: MarkerType.ArrowClosed` が付与され、向きが視覚的に分かる
    - `nodesDraggable`, `nodesConnectable`, `elementsSelectable`, `panOnDrag`, `zoomOnScroll`, `zoomOnPinch`, `zoomOnDoubleClick` が全て `false`
    - `proOptions={{ hideAttribution: true }}` が設定されている
    - 不正エッジを渡したときに例外が飛ばず、該当エッジだけが描画されない（コンソールに warn が出る）

- [x] **4. `BattleScreen` への組み込み**  ✓ 完了
  - 内容：戦闘画面中段のプレースホルダ文言（「[フローチャートエリア] ここにノードを配置」）を `<FlowchartArea stage={stage} />` に置き換える。`stages.json` から `stages[0]` を読み込んで渡す。`.flowchartArea` の CSS を React Flow のキャンバスが親いっぱいに広がるよう調整する。
  - ファイル：
    - `frontend/src/features/battle/BattleScreen.jsx`
    - `frontend/src/features/battle/BattleScreen.module.css`
  - 依存：タスク3
  - 完了条件：
    - `npm run dev` でブラウザ表示すると中段にスロット3個と矢印付きエッジ2本が表示される
    - 中段の領域サイズが変わっても初期表示時にスロットが画面に収まる（`fitView`）
    - 既存の上段（敵エリア）・下段（HP・手札）の表示・比率に影響がない
    - `npm run lint` が通る

- [x] **5. README のディレクトリ構造更新**  ✓ 完了
  - 内容：CLAUDE.md のディレクトリ運用ルールに従い、`README.md` の「ディレクトリ構造」セクションに新規ディレクトリを追加し、「今後追加予定のディレクトリ」表から該当行を削除する。
  - ファイル：`README.md`
  - 依存：タスク1、タスク2、タスク3（実在するディレクトリを反映するため）
  - 完了条件：
    - ディレクトリ構造の ASCII ツリーに以下が追加されている：
      - `frontend/src/data/` と `stages.json`
      - `frontend/src/features/flowchart/` と配下の4ファイル（`FlowchartArea.jsx`, `FlowchartArea.module.css`, `SlotNode.jsx`, `SlotNode.module.css`）
    - 「今後追加予定のディレクトリ」表から `frontend/src/features/flowchart/` と `frontend/src/data/` の行が削除されている
    - 実装内容（タスク1〜4）とツリーが完全一致している

## 要件トレーサビリティ

| 要件 | 対応タスク |
|---|---|
| 要件1-1（全スロット描画） | タスク3（`slotsToNodes`）、タスク4（戦闘画面で実表示） |
| 要件1-2（空き枠と分かる外観） | タスク2（`SlotNode` の点線枠） |
| 要件1-3（位置情報通りに配置） | タスク1（position 定義）、タスク3（React Flow への受け渡し） |
| 要件2-1（全エッジ描画） | タスク3（`edgesToFlowEdges`）、タスク4（戦闘画面で実表示） |
| 要件2-2（向きが分かる矢印） | タスク3（`MarkerType.ArrowClosed`） |
| 要件2-3（不正エッジを除外） | タスク3（`edgesToFlowEdges` 内のフィルタリング） |
| 要件3-1（JSON を `data/` 配下） | タスク1 |
| 要件3-2（ID・位置・始点/終点が取り出せる） | タスク1（スキーマ定義） |
| 要件3-3（1 ステージのみ） | タスク1 |
