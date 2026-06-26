# タスク一覧: 戦闘画面のフロチャロボパネル化

## 概要

CSS 層（`BattleScreen.module.css`）→ DOM 層（`BattleScreen.jsx`）の順でボトムアップに積む。CSS 変数と `.roboPanel` クラスを先に追加してから、JSX の `.flowchartArea` + `.playerArea` をラップする。クリティカルパスは「タスク 1（CSS）→ タスク 2（DOM）」の 2 ステップで、いずれも 30 分〜1 時間の小規模変更。React Flow / dnd-kit / `battleStore` への変更は **なし**。

合計タスク数：2件 ｜ 想定工数：1〜2時間

## タスク

- [x] **1. `BattleScreen.module.css` に CSS 変数と `.roboPanel` クラスを追加**  ✓ 完了
  - 内容：
    - `.root` セレクタの中に CSS カスタムプロパティを 3 つ追加: `--robo-frame-color`（暗い紫、`robo.png` の本体外周色から採取、仮値 `#2c1d3f`）、`--robo-frame-width`（仮値 `6px`）、`--robo-frame-radius`（仮値 `12px`）
    - 新しい `.roboPanel` クラスを追加: `flex: 55 0 0`、`display: flex`、`flex-direction: column`、`min-height: 0`、`position: relative`
    - 新しい `.roboPanel::before` 擬似要素を追加: `content: ''`、`position: absolute`、`inset: 0`、`border: var(--robo-frame-width) solid var(--robo-frame-color)`、`border-radius: var(--robo-frame-radius)`、`pointer-events: none`、`z-index: 9`
    - 既存の `.enemyArea` / `.flowchartArea` / `.playerArea` / `.root.expanded .enemyArea` / `.root.expanded .flowchartArea` は **一切無変更**
  - ファイル：`frontend/src/features/battle/BattleScreen.module.css`
  - 依存：なし
  - 完了条件：CSS ファイル単体で構文エラーなし（ビルド通る）、既存ステージ（タスク 2 未着手の段階）を開いてもレイアウトが従来どおり（`.roboPanel` クラスはまだ使われていないため見た目に変化なし）。`--robo-frame-color` の値は `robo.png` を実機で見てピクセル吸い取りツール等で確定するか、仮値のまま実装して見え方を確認後に調整する。

- [x] **2. `BattleScreen.jsx` の DOM 構造を更新（`.roboPanel` で `.flowchartArea` + `.playerArea` をラップ）**  ✓ 完了
  - 内容：
    - return 内の `<section className={rootClassName}>` の中で、`.enemyArea` の閉じタグ `</div>` の **直後** に `<div className={styles.roboPanel}>` を開く
    - 既存の `.flowchartArea` div と `.playerArea` div を `.roboPanel` の中に内包させる
    - `.roboPanel` の閉じタグ `</div>` を `.playerArea` の閉じタグの **直後** に置く
    - `.enemyArea` / `.flowchartArea` / `.playerArea` の中身・className・props は **一切無変更**（ラッパーで囲むだけ）
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`
  - 依存：タスク 1（`.roboPanel` クラスが CSS で定義されていることが前提）
  - 完了条件：
    - **戦闘画面を開くと `.flowchartArea` + `.playerArea` の周囲に紫色の長方形の枠が表示される**（要件 1-1, 1-2）
    - `ZoomButton` で拡大→縮小を繰り返しても枠が一緒に拡縮し、トランジション中に消えたり位置がずれたりしない（要件 3-1〜3-3）
    - **既存ステージ（1-X〜5-X、turn 入りステージ含む）のフローチャート描画・スロット位置・カード配置・実行動作がすべて従来どおり**（要件 4 全項目）
    - カードのドラッグ&ドロップが紫枠の上を妨げなく通過する（要件 6-1）
    - `VictoryClearOverlay` / `BattleFailOverlay` が表示される際、紫枠の前面に描画され隠れない（要件 6-2、紫枠 z-index 9 < オーバーレイ既存配置）
    - フローチャート実行中のスロット `.active` 発光・カード `.flashing` 演出が紫枠と視覚的に競合しない（要件 6-3）
    - Lint / 型チェックパス、`[battleStore]` / `[stagesLoader]` の想定外 warn が出ない

## トレーサビリティ（要件 → タスク）

| 要件 | カバーするタスク |
|---|---|
| 1: フロチャロボパネルの基本構造 | タスク1（`.roboPanel` クラスと `::before`）、タスク2（DOM ラップ） |
| 2: 装飾レベルの制約（紫枠だけ） | タスク1（`.roboPanel::before` の `border` 1 行のみ、装飾追加なし） |
| 3: 拡大／縮小モードへの追従 | タスク1（`.roboPanel` の `flex: 55 0 0`）、タスク2（DOM 構造で `.flowchartArea` を内包） |
| 4: 既存ステージへの非破壊性 | タスク1（既存 CSS クラス無変更）、タスク2（既存 JSX 構造の中身無変更）、タスク 2 完了条件で実機検証 |
| 5: 色とスタイルの統一基盤 | タスク1（CSS 変数 3 つを `.root` に追加） |
| 6: アクセシビリティと既存演出への配慮 | タスク1（`pointer-events: none` / `z-index: 9`）、タスク 2 完了条件でオーバーレイ・演出を検証 |
| 7: 小画面への配慮 | タスク 2 完了条件の実機確認時、必要なら CSS 変数を調整 |

全 7 要件がタスク 1〜2 のいずれかでカバーされます。孤立した要件はありません。

## クリティカルパス

```
タスク 1 (CSS 変数 + .roboPanel クラス)
       ↓
タスク 2 (DOM 構造の更新、紫枠を実機で確認)
```

タスク 1 を先に完了させると、CSS だけ追加した状態で既存挙動への影響ゼロが確認できる安全な中間状態に到達します。その後タスク 2 で初めて視覚的に紫枠が現れ、実機での見え方を調整できます。

## 実装の注意点

- **仮の色値で先に当てて、実機で見ながら調整**：`--robo-frame-color` の値は仮 `#2c1d3f` で書いてビルドし、実機で `robo.png` と並べて違和感がある場合のみ、ピクセル吸い取り等で正確な値に差し替える。
- **`.roboPanel::before` の z-index = 9** は `.flowchartControls`（既存 z-index 10）より下、フローチャート本体より上に配置するための値。`VictoryClearOverlay` / `BattleFailOverlay` が紫枠で隠れる場合のみ、それらの z-index を 10 以上に引き上げる（タスク 2 完了条件で実機確認）。
- **タスク 2 完了後にスクリーンショットを撮って残さない**：CLAUDE.md の規約どおり、検証用に生成した一時ファイル・スクリーンショットはリポジトリに含めない。
