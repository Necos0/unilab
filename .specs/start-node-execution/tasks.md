# タスク一覧: StartNode 実行トリガー化

## 概要

データ流れの上流から順に積む: `FlowchartArea`（`startToNode` に `stage` を埋め込む）→ `StartNode`（`<button>` 化・クリックハンドラ・disabled 判定）→ `StartNode.module.css`（`<button>` 互換スタイル・`:disabled` セレクタ）→ `BattleScreen` と `PlayButton` 周辺の削除、という順序。タスク2 までで「StartNode から実行が走る」状態にし、タスク3 〜 5 で旧 PlayButton の痕跡を消す。docstring 更新は teaching モード規約により Claude が `Edit` で直接書き込む（実装ファイル本体はユーザー）。

合計タスク数：5件 ｜ 想定工数：2〜3時間

## タスク

- [ ] **1. `FlowchartArea.jsx` の `startToNode` に `stage` を渡す**
  - 内容：
    - `startToNode` のシグネチャを `startToNode(start)` → `startToNode(start, stage)` に変更
    - 戻り値の `data: {}` を `data: { stage }` に変更
    - 呼び出し側（同ファイル内 `useMemo` 内）の `startToNode(stage.start)` を `startToNode(stage.start, stage)` に変更
    - `useMemo` の依存配列に `stage` が含まれているか確認（既に `stage.slots, stage.start, stage.goal, ...` のように個別フィールドで列挙されている場合、`startToNode` が `stage` 全体を data に乗せるなら `stage` 自体を依存に追加するか、十分な個別フィールドが入っていることを確認）
  - ファイル：`frontend/src/features/battle/flowchart/FlowchartArea.jsx`
  - 依存：なし
  - 完了条件：
    - React Flow の `nodes` 配列内、`id === 'start'` のノードが `data.stage` を持つ（DevTools の React Flow デバッグで確認可能）
    - Lint/型チェックがパスする
    - 既存ステージ（1-1〜5-X）の起動でエラーが出ない

- [ ] **2. `StartNode.jsx` を `<button>` 化し、クリックで `startExecution` を発火する**
  - 内容：
    - 関数シグネチャを `function StartNode()` → `function StartNode({ data })` に変更
    - `useBattleStore` の購読を追加:
      - `isExecuting`, `isTransitioning`, `victoryPhase`, `failPhase`, `selectAllSlotsFilled`, `startExecution`
      - インポート文に `selectAllSlotsFilled` を追加: `import useBattleStore, { selectAllSlotsFilled } from '../../../stores/battleStore';`
    - `isDisabled` を算出: `isExecuting || isTransitioning || !allFilled || victoryPhase !== null || failPhase !== null`
    - `handleClick` を定義: `() => startExecution(data.stage)`
    - 返り値の最上位要素を `<div>` → `<button type="button" disabled={isDisabled} onClick={handleClick} aria-label="実行">` に変更
    - `<img>` の `src` を `/icons/flowchart/start.svg` → `/icons/flowchart/play.svg` に変更、`alt="スタート"` → `alt=""` に変更（意味は親 button の aria-label に集約）
    - 既存の `className` 算出（`marker / active / traversed`）と `<Handle>` は無変更で保持
  - ファイル：`frontend/src/features/battle/flowchart/StartNode.jsx`
  - 依存：タスク1（`data.stage` が渡ってくる前提）
  - 完了条件：
    - 全スロット未配置の状態で StartNode をクリックしても何も起きない（要件2-3）
    - 全スロット配置済み + 通常状態で StartNode をクリックすると、旧 PlayButton と完全に同じシーケンスで実行が走る（要件1-1, 1-2）
    - 実行中の StartNode が `.active` で発光、終了後 `.traversed` で固定光（要件5-2, 5-3）
    - Tab キーで StartNode にフォーカスでき、Enter / Space で実行発火（要件6-3）
    - `disabled` 時は Enter / Space を押しても発火しない（要件6-4）
    - Lint/型チェックがパスする

- [ ] **3. `StartNode.module.css` を `<button>` 互換に更新し、`:disabled` セレクタを追加**
  - 内容：
    - `.marker` セレクタに以下を追加（既存プロパティは保持）:
      - `pointer-events: auto;`（React Flow NodeWrapper の `pointer-events: none` を上書き）
      - `cursor: pointer;`
      - `padding: 0;`（`<button>` のブラウザデフォルトを潰す）
      - `font: inherit;`（同上）
      - `color: inherit;`（同上）
      - `transition: opacity 0.15s;`（disabled 切替を滑らかに）
    - 新規セレクタ `.marker:disabled` を追加: `opacity: 0.4; cursor: not-allowed;`
    - `.icon` の寸法 48×48 は維持。`play.svg` の見え方を実機確認し、必要なら 40〜56 の範囲で微調整
    - `.active` / `.traversed` 既存セレクタは無変更
    - 既存の枠色 `#4a4a52` と背景色 `#15151c` は無変更
  - ファイル：`frontend/src/features/battle/flowchart/StartNode.module.css`
  - 依存：タスク2（`<button>` 化されたうえで disabled 属性が付くため）
  - 完了条件：
    - `disabled` 状態の StartNode が半透明（opacity 0.4）で表示される（要件2-6）
    - ホバー時に `cursor: not-allowed` が表示される（要件2-6）
    - 拡大/縮小トランジション中・実行中・勝利演出中・失敗演出中のいずれでも視覚的に無効状態が分かる（要件2-1〜2-5 と整合）
    - `play.svg` がマーカー中央にバランスよく配置される（要件3-3）
    - 通常状態のクリックが反応する（`pointer-events: auto` 効果確認）

- [ ] **4. `BattleScreen.jsx` から `PlayButton` の参照を削除**
  - 内容：
    - 14 行目の `import PlayButton from './flowchart/PlayButton';` を削除
    - 567 行目の `<PlayButton stage={stage} />` を削除
    - `.flowchartControls` の `<div>` 構造（`.topRow` 含む）は維持（次仕様の別ボタン配置場所として残す、要件4-4）
    - 他に `PlayButton` を参照する箇所がないか grep で確認
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`
  - 依存：タスク2（StartNode 単独で実行を担えることが前提）
  - 完了条件：
    - フロチャエリア右上に PlayButton が表示されない
    - 残った ZoomButton / ResetButton は引き続き動作する（要件7-1）
    - `BattleScreen.jsx` 内に `PlayButton` 文字列が残っていない（grep で確認）
    - Lint/型チェックがパスする

- [ ] **5. `PlayButton.jsx` / `PlayButton.module.css` を削除し、参照を全消去**
  - 内容：
    - `frontend/src/features/battle/flowchart/PlayButton.jsx` を削除
    - `frontend/src/features/battle/flowchart/PlayButton.module.css` を削除
    - リポジトリ全体を grep し、`PlayButton` 文字列を持つファイルを洗い出し:
      - 他コンポーネントから import している箇所 → 削除
      - docstring・コメントが `play-button 要件 X-Y` のように旧仕様を参照している箇所 → `start-node-execution` 仕様への参照に置換、または「旧 PlayButton 仕様（廃止）」と注記
      - `StartNode.jsx` の docstring を本仕様の挙動（クリック実行・disabled 判定・アイコン差し替え）に書き直す（Claude が `Edit` で直接書き込む、teaching モード規約）
    - 旧 `/icons/flowchart/start.svg` ファイルは **削除しない**（設計書トレードオフに従い、将来再利用のため残す）
  - ファイル：
    - 削除：`frontend/src/features/battle/flowchart/PlayButton.jsx`, `frontend/src/features/battle/flowchart/PlayButton.module.css`
    - 修正：`StartNode.jsx`（docstring）、他 grep で発見したファイル
  - 依存：タスク4（BattleScreen から参照が消えてから物理削除）
  - 完了条件：
    - リポジトリ全体に `PlayButton` 文字列が残っていない（grep `-r "PlayButton"` で 0 件）
    - `StartNode.jsx` の docstring が現挙動（クリック実行・disabled 判定）を正しく説明している
    - 他 spec の `.md`（例: `play-button/requirements.md` 等）に書かれた旧挙動の説明は **更新不要**（過去のスナップショットとして保持）
    - Lint/型チェック・ビルドがパスする

## トレーサビリティ（要件 → タスク）

| 要件 | カバーするタスク |
|---|---|
| 1: クリック実行トリガー化 | タスク1（stage 配給）、タスク2（onClick → startExecution） |
| 2: 実行可否判定 | タスク2（isDisabled 算出・disabled 属性）、タスク3（:disabled CSS） |
| 3: アイコン差し替え | タスク2（`<img src>` 変更）、タスク3（必要なら寸法微調整） |
| 4: PlayButton 完全削除 | タスク4（BattleScreen から削除）、タスク5（ファイル削除・参照削除） |
| 5: 既存 StartNode 機能の維持 | タスク2（className 算出・Handle 保持）、タスク3（`.active`/`.traversed` 既存セレクタ保持）、タスク1（位置情報は無変更） |
| 6: アクセシビリティ | タスク2（`<button>` 化・aria-label・disabled 属性） |
| 7: 既存他機能との非干渉 | タスク4（`.flowchartControls` 構造維持）、タスク3（disabled CSS が他演出と競合しないことの確認） |

全7要件がタスク1〜5 のいずれかでカバーされます。孤立した要件はありません。

## クリティカルパス

```
タスク1 (FlowchartArea: data.stage を埋め込む)
       ↓
タスク2 (StartNode: <button>化 + クリック実行)
       ↓
タスク3 (StartNode.module.css: <button> 互換 + :disabled)
       ↓
タスク4 (BattleScreen: PlayButton JSX/import 削除)
       ↓
タスク5 (PlayButton ファイル削除 + 参照全消去 + docstring 更新)
```

タスク1 → 3 まで完了した時点で「StartNode から実行可能」「PlayButton も並存している」中間状態に到達するため、回帰確認しながら進められます。タスク4 で UI から旧 PlayButton を消し、タスク5 で物理削除と docstring を整えて完了。

## 実装の注意点

- **タスク1 の `useMemo` 依存配列**：`startToNode(stage.start, stage)` のように `stage` 全体を渡すなら、依存配列の `[stage.slots, stage.start, ...]` 個別列挙では不十分になるケースが理論上ある。実害が無さそうでも、設計の妥当性チェックとして「`stage` の他のフィールドが変わったときに StartNode が古い `stage` を参照しないか」を確認する。
- **タスク2 の `<button>` フォーカスリング**：ブラウザデフォルトの focus outline が出ると意図しない見た目になるかもしれない。気になる場合はタスク3 で `.marker:focus-visible { outline: ... }` を整える（任意）。
- **タスク3 の `.icon` 寸法**：48×48 のまま `play.svg`（viewBox 24×24）を入れると等比拡大されて見える。見え方の好みで 40〜56 の範囲で調整する。`width` だけ書いて `height` を省略しても aspect-ratio で揃うが、明示しておく方が安全。
- **タスク4 の `.flowchartControls` 配置**：`<PlayButton>` を消すと右上の `flex-direction: column` の縦配置でスペースが空く。`.topRow` の `ZoomButton` + `ResetButton` だけ残る形になるが、次仕様の別ボタンを置く想定なので空きスペースを潰すスタイル調整は **本仕様ではしない**。
- **タスク5 の grep**：`PlayButton` だけでなく `play-button` 仕様番号への参照（例: `play-button 要件 5-1`）も検出する。`grep -rE "PlayButton|play-button" frontend/src` で網羅。
- **テスト生成物を残さない**：実機確認のスクリーンショット・Playwright MCP 出力など、確認用ファイルはリポジトリに含めない（CLAUDE.md 規約）。
