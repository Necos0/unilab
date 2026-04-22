# タスク一覧: カード UI 画像化と Hand / Card 分離

## 概要

以下の順で実装する。クリティカルパスは「データ構造変更 → Hand/Card 実装 → BattleScreen 組み込み → ドキュメント更新」。`features/cards/` ディレクトリは既に `Card.jsx` / `Card.module.css` の途中成果物があるため、タスク 2 で既存成果物の差分確認・整合を行う。

合計タスク数: 7 件 ｜ 想定工数: 1.5 時間

## タスク

- [x] **1. `stages.json` を拡張し、`cards` 配列を追加する**
  - 内容: `stage-00` に `cards: [{ id: "attack", power: 12 }, { id: "guard", power: 12 }, { id: "heal", power: 12 }]` を追加。配置は `enemyId` の直後、`slots` の直前。
  - ファイル: `frontend/src/data/stages.json`
  - 依存: なし
  - 完了条件: JSON として valid で、`stage-00.cards` から 3 枚のカード定義が取り出せる。

- [x] **2. `Card.jsx` / `Card.module.css` を仕様どおりに整える**
  - 内容: 途中で作成済みのファイルをスペックに合わせて確認・必要なら修正する。props は `card: { id, power }` のみ、`alt={card.id}` にし、`displayName` への依存を排除。
  - ファイル: `frontend/src/features/cards/Card.jsx`, `frontend/src/features/cards/Card.module.css`
  - 依存: なし
  - 完了条件: `card.id` と `card.power` のみを参照し、`displayName` への参照がない。

- [x] **3. `Hand.jsx` / `Hand.module.css` を新規作成する**
  - 内容: `cards` 配列を受け取って `Card` を横並びに描画する。`key` はインデックス。空配列の場合は空のコンテナを返す。CSS は `display: flex`、`gap: 0.5rem`、`height: 100%`。
  - ファイル: `frontend/src/features/cards/Hand.jsx`, `frontend/src/features/cards/Hand.module.css`
  - 依存: タスク 2
  - 完了条件: `<Hand cards={[{id:"attack",power:12}]} />` で 1 枚が描画できる。

- [x] **4. `BattleScreen.jsx` に `Hand` を組み込む**
  - 内容: `import Hand from '../cards/Hand'` を追加し、既存の `.hand` / `.card` div ブロックを `<Hand cards={stage.cards} />` に置換。docstring を「手札プレースホルダ」から「ステージの `cards` 定義を受けて手札を描画」に更新。
  - ファイル: `frontend/src/features/battle/BattleScreen.jsx`
  - 依存: タスク 3
  - 完了条件: BattleScreen から `.card` / `.hand` クラス参照が消え、`Hand` 経由で 3 枚のカードが描画される。

- [x] **5. `BattleScreen.module.css` から `.hand` / `.card` を削除する**
  - 内容: 不要になった 2 つのクラス定義を削除。`.playerArea` / `.hpBox` / `.hpText` は維持。
  - ファイル: `frontend/src/features/battle/BattleScreen.module.css`
  - 依存: タスク 4
  - 完了条件: `.hand` / `.card` セレクタが BattleScreen の CSS Module に存在しない。

- [x] **6. `cards.json` を削除し、残存 import を確認する**
  - 内容: `frontend/src/data/cards.json` を削除。リポジトリ全体を `grep -r "cards.json"` / `grep -r "cardsData"` / `grep -r "from.*data/cards"` で確認し、残存参照がないことを保証する。
  - ファイル: `frontend/src/data/cards.json`（削除）
  - 依存: タスク 4（import の移行完了後）
  - 完了条件: `cards.json` が存在せず、grep で参照が検出されない。

- [x] **7. `README.md` のディレクトリ構造図・今後追加予定表を更新する**
  - 内容: 構造図に `features/cards/`（`Card.jsx` / `Card.module.css` / `Hand.jsx` / `Hand.module.css`）を追記。`data/cards.json` の行を削除。「今後追加予定のディレクトリ」表から `frontend/src/features/cards/` の行を削除。
  - ファイル: `README.md`
  - 依存: タスク 1〜6 すべて（最終状態を反映するため）
  - 完了条件: README.md の構造図が実ディレクトリと一致し、`cards.json` の記述が残らない。

## 要件 → タスク 対応

| 要件 | 対応タスク |
|------|-----------|
| 要件1（画像表示・power オーバーレイ・pixelated・ドラッグ抑止・id を alt に） | タスク 2 |
| 要件2（Hand/Card 分離・props のみ参照・BattleScreen から DOM 消去） | タスク 2, 3, 4, 5 |
| 要件3（cards.json 削除・stages.json に cards・同一 id 複数可・移行・import 残存なし） | タスク 1, 4, 6 |
| 要件4（可変サイズ・aspect-ratio・gap） | タスク 2, 3 |
| 要件5（スコープ外の遵守） | 全タスクで D&D・選択状態・displayName を実装しないことで達成 |
