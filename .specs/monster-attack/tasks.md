# タスク一覧: モンスターカードによるプレイヤー被弾処理

## 概要

設計の依存関係に従って、**「データ → ロック表示 → ロック保護 → プレイヤー HP 状態 → ダメージ適用 → 演出（数字フロート → 振動・赤フラッシュ）」** の順に積み上げる。各タスクが独立して動作確認できる切れ目で区切ることで、teaching モード下でも 1 タスクごとに「実装 → 検証 → 次へ」のサイクルを回せる。

合計タスク数：14 件 ｜ 想定工数：4〜6 時間（人手の確認時間を含む）

> 凡例：
> - **新規** = ファイル新規作成 ／ **編集** = 既存ファイルへの追加・変更
> - 完了条件は teaching モードの検証ステップで Claude が `Read` で確認する観点を含む

## タスク

- [x] **1. ステージ JSON にモンスターカードのロック配置を追加**  ✓ 完了
  - 内容：`1-2`（ウルフ）ステージの `slot-2` に `lockedCard: { id: 'monster', power: 50 }` を追加する。他のステージ（`1-1` / `1-3` / `1-4`）は変更しない。
  - ファイル：`frontend/src/data/stages.json`（編集）
  - 依存：なし
  - 完了条件：JSON が壊れずパースされる（`npm run build` または `npm run dev` 起動でエラーが出ない）。`stages['1-2'].slots[1]` に `lockedCard` フィールドが追加されている。

- [x] **2. `Card.jsx` にモンスターカード仮ビジュアル分岐を追加**  ✓ 完了
  - 内容：`card.id === 'monster'` のときだけ `<img>` ではなく赤系グラデーション ＋ "MONSTER" テキストの仮ビジュアル `<div>` を描画する。`Card.module.css` に `.monsterPlaceholder` / `.placeholderInner` / `.placeholderLabel` の 3 ルールを追加する。`<span className={styles.power}>{card.power}</span>` のオーバーレイ表示は分岐の外に保ち、両ケースで共通利用する。
  - ファイル：`frontend/src/features/cards/Card.jsx`（編集）、`frontend/src/features/cards/Card.module.css`（編集）
  - 依存：なし（Task 1 と並行可）
  - 完了条件：単体検証は次のタスクと合わせて行う。本タスク時点では「分岐コードと CSS が記述されており、既存カード（attack / guard / heal）の見た目と挙動が変わらない」を確認する。

- [x] **3. `battleStore` に `buildSlotAssignmentsFromStage` を導入してロックカードを初期割当に乗せる**  ✓ 完了
  - 内容：`emptySlotAssignments(stage.slots)` を呼んでいる箇所を、新ヘルパー `buildSlotAssignmentsFromStage(stage)` に置き換える。新ヘルパーは各スロットに `lockedCard` があれば `{ instanceId: 'locked-<slotId>', id, power, locked: true }` を、なければ `null` を入れる。既存の `emptySlotAssignments` は不要になれば削除する。
  - ファイル：`frontend/src/stores/battleStore.js`（編集）
  - 依存：Task 1, Task 2
  - 完了条件：`npm run dev` 起動で `1-2` ステージに入ると、`slot-2` に赤い "MONSTER" 仮ビジュアルのカードが固定表示される。`power` 値の `50` が右下にオーバーレイ表示される。`1-1` / `1-3` / `1-4` ではモンスターカードが表示されない。

- [x] **4. `computeDropTransition` にロックカードのガードを追加**  ✓ 完了
  - 内容：関数冒頭の早期リターンガードの直後に 2 つのガードを追加する。(a) `source` がスロット ID で、そのスロットのカードが `locked: true` のときは `{}` 返却。(b) `destination` がスロット ID で、そのスロットのカードが `locked: true` のときは `{}` 返却。
  - ファイル：`frontend/src/stores/battleStore.js`（編集）
  - 依存：Task 3
  - 完了条件：本タスクの単体動作確認は Task 5 と合わせて行う（dnd-kit 側のドラッグ抑止が無いので、現時点ではドラッグは開始するが状態遷移層で弾かれる挙動になる）。コードレベルでガードが追加されていることを確認する。

- [x] **5. `DraggableCard` の `useDraggable` を `card.locked` で `disabled` にする**  ✓ 完了
  - 内容：既存の `disabled: victoryPhase !== null` を `disabled: victoryPhase !== null || card.locked === true` に変更する。
  - ファイル：`frontend/src/features/cards/DraggableCard.jsx`（編集）
  - 依存：Task 4
  - 完了条件：`1-2` でモンスターカードを掴もうとしてもドラッグが開始しない。手札のカードをモンスターカードのスロットへドロップしようとしても、手札・スロット割当が変化せず元に戻る。`1-1` のリセット動作が以前どおり動く（リグレッション無し）。

- [x] **6. `battleStore` にプレイヤー HP 関連の state とアクションを追加**  ✓ 完了
  - 内容：`playerData` を import する。state に `currentPlayerHp` / `maxPlayerHp` / `playerDamageEvents` / `_playerDamageCounter` の 4 件を追加（初期値 `0` / `0` / `[]` / `0`）。`initializeBattle` で `playerData.maxHp` から `maxPlayerHp` / `currentPlayerHp` を初期化、`playerDamageEvents` を `[]` にリセット。新規アクション `applyPlayerDamage(amount)` と `dismissPlayerDamageEvent(id)` を追加（敵側 `applyDamage` / `dismissDamageEvent` と完全対称）。
  - ファイル：`frontend/src/stores/battleStore.js`（編集）
  - 依存：Task 3
  - 完了条件：`npm run dev` 起動で `1-2` 戦闘画面に入っても以前どおり動く（プレイヤー HP 表示はまだ静的なまま）。React DevTools / `console.log` 等で `useBattleStore.getState()` を覗いて `currentPlayerHp: 100` / `maxPlayerHp: 100` がセットされていることを確認する。

- [x] **7. `BattleScreen` のプレイヤー HP バー表示を store 値に切り替える**  ✓ 完了
  - 内容：ローカル変数 `playerMaxHp = playerData.maxHp` を削除し、`currentPlayerHp` / `maxPlayerHp` を `useBattleStore` で購読する。プレイヤー HP バー周辺の `<HpBar />` と `<span>{playerMaxHp}/{playerMaxHp}</span>` を新しい変数で書き換える。`playerData` の import は削除する（store に移管済みのため）。
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`（編集）
  - 依存：Task 6
  - 完了条件：`1-2` でプレイヤー HP が `100/100` と動的表示される（見た目は以前と同じだが、内部的に store 経由になっている）。実行ボタン・リセット・拡大トグルの挙動が以前と変わらない。

- [x] **8. `startExecution` にプレイヤー HP リセットとモンスターカード分岐を追加**  ✓ 完了
  - 内容：`beginSequence` 冒頭の `set` に `currentPlayerHp: s.maxPlayerHp, playerDamageEvents: []` を追加する。フェーズループ内の `if (card && card.id === 'attack' && card.power > 0)` の **直下に並列で** `if (card && card.id === 'monster' && card.power > 0) { get().applyPlayerDamage(card.power); }` を追加する（`else if` ではなく独立 `if`）。
  - ファイル：`frontend/src/stores/battleStore.js`（編集）
  - 依存：Task 6
  - 完了条件：`1-2` で `slot-1` と `slot-3` に attack カードを置いて実行 → モンスターカードのスロット通過タイミングでプレイヤー HP バーの幅が `100 → 50` に滑らかに減る（数字ラベルも `50/100` に変わる）。再実行で `100/100` に戻る。`1-1` の attack カード処理は以前どおり動く。

- [x] **9. `PlayerDamageFloater` コンポーネントを新規作成**  ✓ 完了
  - 内容：`battleStore.playerDamageEvents` を購読し、各要素を `<span>-{amount}</span>` として描画する。`onAnimationEnd` で `dismissPlayerDamageEvent(id)` を呼ぶ。CSS は敵側 `DamageFloater.module.css` の `@keyframes damageFloat` と同じ形だが、フォントサイズ `1.25rem`、色 `#ff5d5d` で対称に揃える。`features/battle/player/` ディレクトリは存在しないので、ファイル作成と同時にディレクトリも作成される。
  - ファイル：`frontend/src/features/battle/player/PlayerDamageFloater.jsx`（新規）、`frontend/src/features/battle/player/PlayerDamageFloater.module.css`（新規）
  - 依存：Task 6
  - 完了条件：本タスク単体ではまだ画面に組み込まれていないため動作確認はできない。コードがビルドエラーを起こさないこと（`npm run dev` で警告 / エラーが出ない）を確認する。

- [x] **10. `BattleScreen` に `PlayerDamageFloater` を配置し `playerHpBox` ラッパーを導入**  ✓ 完了
  - 内容：`BattleScreen.jsx` でプレイヤー HP の `<HpBar /> + <span>` を新クラス `playerHpBox` の `<div>` で包み、その内側に `<PlayerDamageFloater />` を配置する。`BattleScreen.module.css` に `.playerHpBox` を追加する（`display: flex; align-items: center; gap: 0.75rem; font-variant-numeric: tabular-nums; position: relative; flex-shrink: 0;`）。`PlayerDamageFloater.module.css` の `.layer` は既に `position: absolute; inset: 0; pointer-events: none;` なので、ラッパーが `position: relative` であれば自動で正しく重なる。
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`（編集）、`frontend/src/features/battle/BattleScreen.module.css`（編集）
  - 依存：Task 8, Task 9
  - 完了条件：`1-2` で実行 → モンスターカードのスロット通過時に「-50」が赤い数字で浮き上がりフェードアウトする。プレイヤー HP バーの幅変化と数字フロートが同じタイミングで始まる。手札レイアウト・実行ボタンが押せる状態は変わらない。

- [x] **11. プレイヤー HP バーの shake + flash 演出を追加**  ✓ 完了
  - 内容：`BattleScreen.jsx` で `playerDamageEvents.at(-1)?.id ?? null` を購読し、`useState` の `hitKey` を `useEffect` でセットする。`playerHpBox` の className に `hitKey ? styles.hit : ''` を OR で連結し、`onAnimationEnd={() => setHitKey(null)}` を付ける。`BattleScreen.module.css` に `.playerHpBox.hit` ルールと `@keyframes playerHit` を追加する（design.md の CSS スケッチ通り）。
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`（編集）、`frontend/src/features/battle/BattleScreen.module.css`（編集）
  - 依存：Task 10
  - 完了条件：`1-2` で実行 → モンスターカードのスロット通過時に HP バー周辺が左右に小さく振動しつつ、赤みがかったフラッシュが 0.3 秒ほどかけて 1 回走る。バー幅変化・数字フロート・shake/flash の 3 演出が同じ瞬間にスタートする。次の実行でも再度同じように発火する（一度きりではない）。

- [x] **12. `README.md` のディレクトリ構造を更新**  ✓ 完了
  - 内容：`frontend/src/features/battle/` のサブツリー記載に `player/` を追加し、その下に `PlayerDamageFloater.jsx` / `PlayerDamageFloater.module.css` を列挙する。enemy/ と同じインデント・フォーマットで揃える。「今後追加予定のディレクトリ」表からは何も削除する必要はない（player/ は予定表に無かったため）。
  - ファイル：`README.md`（編集）
  - 依存：Task 9
  - 完了条件：構造図に `frontend/src/features/battle/player/` 以下が記載されており、実際のディレクトリ内容と一致する。

- [x] **13. リグレッション・サニティチェック（人手）**  ✓ 完了
  - 内容：design.md の「テスト戦略」シナリオ 1〜10 を実機で手動確認する。要点は次の通り：
    1. 1-2 初期表示でモンスターカードが固定表示
    2. モンスターカードがドラッグできない
    3. モンスターカードのスロットへドロップが拒否される
    4. リセットボタンでモンスターカードが残る（手札・他スロットは初期化）
    5. モンスター通過で `-50` フロート ＋ HP バー shake/flash ＋ HP `100 → 50`
    6. 再実行で `100/100` に復帰
    7. 1-1 / 1-3 / 1-4 の attack 処理が以前どおり通る
    8. 1-2 で拡大トグル → 縮小 → 実行のフローが破綻しない
  - ファイル：なし（手動確認）
  - 依存：Task 11, Task 12
  - 完了条件：すべてのシナリオで期待挙動。問題があれば該当タスクへ戻して修正再提案。

- [ ] **14. デザイン班から `monster.png` 受領後の差し替え（将来作業・本スペック対象外メモ）**
  - 内容：本スペックの実装範囲外。デザイン受領時の差し替え手順を残しておく：(1) `frontend/public/cards/monster.png` を配置、(2) `Card.jsx` の `isMonsterPlaceholder` 分岐ブロックを削除して `<img>` 描画のみ残す、(3) `Card.module.css` の `.monsterPlaceholder` / `.placeholderInner` / `.placeholderLabel` を削除。
  - ファイル：`frontend/public/cards/monster.png`（新規・将来）、`frontend/src/features/cards/Card.jsx`（編集・将来）、`frontend/src/features/cards/Card.module.css`（編集・将来）
  - 依存：本スペック完了 ＋ デザイン班からのアセット受領
  - 完了条件：差し替え後、モンスターカードが本デザインで表示され、他カードと同じ `<img src="/cards/monster.png">` フローで描画される。本スペックの完了判定からは除外する。

## 各要件への対応マトリクス（タスク粒度）

| 要件 | 対応タスク |
| ---- | ---------- |
| 1-1  | Task 1, Task 3 |
| 1-2  | Task 2 |
| 1-3  | Task 14（将来作業） |
| 2-1  | Task 1, Task 3 |
| 2-2  | Task 4, Task 5 |
| 2-3  | Task 4, Task 5 |
| 2-4  | Task 3（リセットは `initializeBattle` 経由なのでロックカードが復元される） |
| 2-5  | Task 1 |
| 3-1  | Task 6 |
| 3-2  | Task 6, Task 7 |
| 3-3  | Task 6（`applyPlayerDamage` の `Math.max(0, ...)`） |
| 3-4  | Task 8（プレイヤー HP=0 で何もしない設計を維持） |
| 4-1  | Task 8 |
| 4-2  | Task 8（条件分岐で `'monster'` 以外は適用なし） |
| 4-3  | Task 8（フェーズタイマー内で同期発火） |
| 4-4  | Task 8（`card.power > 0` ガード） |
| 5-1  | Task 8（`beginSequence` 冒頭で `currentPlayerHp = maxPlayerHp`） |
| 5-2  | Task 8（完了タイマーで `currentPlayerHp` を触らない） |
| 5-3  | Task 8 |
| 5-4  | Task 6, Task 8（リセット側は無変更で OK） |
| 6-1  | Task 7 |
| 6-2  | Task 10 |
| 6-3  | Task 7（同 store 値の購読） |
| 6-4  | Task 7（既存 `HpBar` のトランジションを流用） |
| 7-1  | Task 9, Task 10 |
| 7-2  | Task 9（`damageFloat` キーフレーム） |
| 7-3  | Task 11 |
| 7-4  | Task 9（独立 `key` で独立 animation） |
| 7-5  | Task 9, Task 11（赤系の色設計） |
| 8-1  | Task 3, Task 6（`initializeBattle` の責務範囲を維持） |
| 8-2  | Task 6, Task 8（HP は実行のみで変動） |
| 8-3  | Task 4, Task 5（既存挙動を保ったままガード追加） |
| 8-4  | Task 10（`playerHpBox` 内に絶対配置で完結） |
| 8-5  | Task 8（既存 attack 分岐を変更せず隣に追加） |
