# タスク一覧: ヒールカード処理（HP回復と演出）

## 概要

`battleStore` への state・アクション追加から始め、演出コンポーネントを下から積み上げて、最後に `BattleScreen` に組み込む順序で進める。クリティカルパスは「store → 新規 Floater → BattleScreen 統合」の縦軸で、CSS（`BattleScreen.module.css` の `.healed` 追加）は独立タスクとして並走可能。

合計タスク数：8件 ｜ 想定工数：3〜5時間（teaching モード前提、コードを手で打つ時間込み）

## タスク

- [ ] **1. `battleStore` にヒール演出キュー state を追加**
  - 内容：`playerHealEvents`（空配列）と `_playerHealCounter`（0）の 2 つを store の初期 state に追加する。`initializeBattle(stage)` の `set(...)` に `playerHealEvents: []` を 1 行追加し、画面マウント・リセット時にクリアされるようにする。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：なし
  - 完了条件：戦闘画面マウント時 / リセットボタン押下時に `playerHealEvents` が `[]`、`_playerHealCounter` が `0` で初期化される（React DevTools の zustand inspector または `console.log(useBattleStore.getState())` で確認可能）。既存の attack / monster 処理が変わらず動く。
  - 対応要件：6-1, 6-6

- [ ] **2. `applyPlayerHeal` / `dismissPlayerHealEvent` アクションを追加**
  - 内容：`applyPlayerHeal(amount)` は `Math.min(maxPlayerHp, currentPlayerHp + amount)` で HP 加算（クランプ）し、`playerHealEvents` に `{ id: 'ph-${counter}', amount }` を push する。**満タン時でも push は必ず行う**点に注意（要件 2-3, 4-4）。`dismissPlayerHealEvent(id)` は `playerHealEvents.filter` で該当 id を除く。既存の `applyPlayerDamage` / `dismissPlayerDamageEvent` の対称形として実装する。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク1（state が無いとアクションが触る対象が無い）
  - 完了条件：DevTools コンソールから `useBattleStore.getState().applyPlayerHeal(5)` を呼ぶと、`currentPlayerHp` が 5 増え（`maxPlayerHp` でクランプ）、`playerHealEvents` に要素が 1 件追加される。`useBattleStore.getState().applyPlayerHeal(9999)` を呼んでも `currentPlayerHp` が `maxPlayerHp` を超えない。`dismissPlayerHealEvent('ph-0')` でその要素が消える。
  - 対応要件：1-1, 2-1, 2-2, 2-3, 4-4

- [ ] **3. `startExecution.beginSequence` に heal 分岐とクリア処理を追加**
  - 内容：`beginSequence` 冒頭の state リセット `set((s) => ({...}))` の中に `playerHealEvents: []` を 1 行追加。`phases.forEach(...)` 内の `setTimeout` コールバックの `if (phase.type === 'node')` ブロック内に、既存の `attack` / `monster` 分岐の隣（`else if` ではなく独立 `if`）として `if (card && card.id === 'heal' && card.power > 0) { get().applyPlayerHeal(card.power); }` を追加する。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク2（`applyPlayerHeal` が呼べる必要がある）
  - 完了条件：1-1 ステージで `slot-1` に `heal:12` を置いて実行ボタンを押すと、スロット通過時に `currentPlayerHp` が変化する（最初は満タンなので変わらないが、`playerHealEvents` に要素が push される）。実行ボタンを押すたびに `playerHealEvents` がクリアされてから push されていく（DevTools で観察）。既存の attack / monster 演出が壊れていない。
  - 対応要件：1-1, 1-2, 1-3, 1-4, 6-5, 6-6

- [ ] **4. `PlayerHealFloater.module.css` を新規作成**
  - 内容：`PlayerDamageFloater.module.css` を雛形に、文字色を `#7dff7d`、`@keyframes` 名を `healFloat` に変えた版を作る。`.layer` は完全に同じ（`position: absolute; inset: 0; pointer-events: none;` ＋ flex センタリング）。`.number` の `animation: healFloat 0.8s ease-out forwards;`。`@keyframes healFloat` は `damageFloat` と同じ形（translateY と opacity の 3 ステップ）。
  - ファイル：`frontend/src/features/battle/player/PlayerHealFloater.module.css`（新規）
  - 依存：なし（タスク 5 と並走可能だが、5 で import するので順序的にこちらを先に）
  - 完了条件：ファイルが作成され、CSS パース・Vite HMR でエラーが出ない。
  - 対応要件：4-2, 4-3, 4-5

- [ ] **5. `PlayerHealFloater.jsx` を新規作成**
  - 内容：`PlayerDamageFloater.jsx` の構造をそのままに、購読を `playerDamageEvents` → `playerHealEvents`、削除アクションを `dismissPlayerDamageEvent` → `dismissPlayerHealEvent`、表示を `-{e.amount}` → `+{e.amount}` に置き換える。export default は `PlayerHealFloater`。
  - ファイル：`frontend/src/features/battle/player/PlayerHealFloater.jsx`（新規）
  - 依存：タスク2（`dismissPlayerHealEvent` が無いと購読できない）、タスク4（CSS Module を import する）
  - 完了条件：ファイルが作成され、type/lint エラーが出ない。まだ `BattleScreen` でマウントしていないので画面に変化はないが、import 単体で構文エラーが出ない。
  - 対応要件：4-1, 4-2, 4-3, 4-5

- [ ] **6. `BattleScreen.module.css` に `.healed` ルールと `hpBoxHealed` キーフレームを追加**
  - 内容：既存の `.playerHpBox.hit { animation: hpBoxHit 0.3s ease-out 1; }` の隣に `.playerHpBox.healed { animation: hpBoxHealed 0.3s ease-out 1; }` を追加。続けて `@keyframes hpBoxHealed` を追加（`brightness/saturate/hue-rotate(+20〜+25deg)` で 5 ステップ、shake なし）。具体値は `design.md` のキーフレーム例を参照。
  - ファイル：`frontend/src/features/battle/BattleScreen.module.css`
  - 依存：なし（タスク 7 と並走可能だが、7 でクラス名を参照するのでこちらを先に）
  - 完了条件：CSS パースエラーなし。DevTools で `playerHpBox` の要素に手動で `healed` クラスを追加すると、緑系のフラッシュアニメーションが 0.3 秒走る。
  - 対応要件：3-1, 3-2, 3-3, 3-4

- [ ] **7. `BattleScreen.jsx` に isPlayerHealed 派生計算と PlayerHealFloater マウントを追加**
  - 内容：以下を順に行う。
    1. `PlayerHealFloater` を import（既存の `PlayerDamageFloater` import の隣）。
    2. `lastPlayerDamageId` / `consumedPlayerDamageId` / `isPlayerHit` の 3 行の隣に、対称形で `lastPlayerHealId` / `consumedPlayerHealId` / `isPlayerHealed` の 3 行を追加。
    3. `playerHpBox` の className を `[styles.playerHpBox, isPlayerHit && styles.hit, isPlayerHealed && styles.healed].filter(Boolean).join(' ')` の形に変更。
    4. `onAnimationEnd` を `event.animationName` で分岐するように変更：`'hpBoxHit'` なら `setConsumedPlayerDamageId(lastPlayerDamageId)`、`'hpBoxHealed'` なら `setConsumedPlayerHealId(lastPlayerHealId)`。
    5. `playerHpBox` の子要素として `<PlayerHealFloater />` を `<PlayerDamageFloater />` の隣に追加。
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`
  - 依存：タスク3（heal 分岐が無いと演出が起動しない）、タスク5（`PlayerHealFloater` が無い）、タスク6（`.healed` クラスが無い）
  - 完了条件：1-2 ステージで `slot-1` に attack カード、`slot-3` に `heal:5` を配置して実行 → モンスター（`slot-2`）通過で HP `100 → 50`、続けて heal 通過で HP `50 → 55` になり、緑フラッシュ（`playerHpBox` 全体）と「+5」の緑文字フロートが表示される。被弾演出（赤フラッシュ + 「-50」フロート）も従来どおり動く。
  - 対応要件：1-3, 3-1, 4-1, 4-3, 6-4, 6-5

- [ ] **8. サニティチェック（手動動作確認）**
  - 内容：以下のシナリオを `npm run dev` で順に確認する：
    1. **満タンでも演出は出る**：1-1 ステージで `slot-1` に `heal:12` を置いて実行 → `100/100` から動かないが、緑フラッシュと「+12」のフロートが出る。
    2. **削れた状態からの回復**：1-2 で `slot-1` 空・`slot-3` に `heal:5` → モンスター通過で `100 → 50`、heal 通過で `50 → 55`、HP バーが滑らかに伸びる。
    3. **オーバーヒール**：1-1 で `heal:12 / heal:3 / heal:12` を 3 スロット全部に置いて実行 → HP は満タン維持、3 連続で緑フラッシュ + フロートが順次走る。
    4. **再実行で HP リセット**：シナリオ 2 のあと再度実行 → 開始時に `100/100` に戻り、同じ結果が再現される。
    5. **被弾演出が壊れていない**：1-2 でモンスター通過時に赤フラッシュと「-50」が以前どおり出る。
    6. **拡大時実行**：1-1 で拡大トグル → 実行ボタン → 縮小トランジション後にシーケンス開始、緑演出が崩れない。
    7. **マップへ戻る → 再戦闘**：演出途中でマップへ戻り、別ステージへ入って戻る → `playerHealEvents` の残骸無し（フローター数字が出っぱなしになっていない）。
  - ファイル：なし（動作確認のみ）
  - 依存：タスク1〜7すべて
  - 完了条件：上記 7 シナリオすべてが期待通り動く。回帰として、攻撃カード処理（敵 HP 減少 + 白フラッシュ + 「-N」）と勝利演出（CLEAR! オーバーレイ）が以前どおり動く。
  - 対応要件：全要件のエンドツーエンド検証

## 要件 → タスク トレーサビリティ

| 要件 | カバーするタスク |
| ---- | ---------------- |
| 1-1 (heal 通過時に power を加算) | 2, 3 |
| 1-2 (heal 以外は HP 不変)        | 3 (`if` 分岐の選択性) |
| 1-3 (ハイライトと同期)            | 3 (`setTimeout` 内で同フェーズ実行) |
| 1-4 (`power` 0/欠損は適用なし)    | 3 (`card.power > 0` ガード) |
| 2-1 (`maxHp` クランプ)            | 2 (`Math.min`) |
| 2-2 (満タン時は変化なし)          | 2 (`Math.min` の結果) |
| 2-3 (満タン時も演出再生)          | 2 (HP 変化なしでも push)、7 (購読側がマウント) |
| 3-1 (緑フラッシュ起動)            | 6, 7 |
| 3-2 (0.2〜0.4s で 1 回明滅)       | 6 (`hpBoxHealed 0.3s`) |
| 3-3 (位置・サイズ不変・重ね描き)  | 6 (`filter` のみ・`translate` 不使用) |
| 3-4 (緑系で識別)                   | 6 (`hue-rotate(+20〜+25deg)`) |
| 4-1 (「+N」フロート出現)           | 5 (`+{e.amount}`) |
| 4-2 (0.6〜1.0s で上昇＋フェード)   | 4 (`healFloat 0.8s`) |
| 4-3 (緑系の文字色)                 | 4 (`color: #7dff7d`) |
| 4-4 (満タン時も `power` 値を表示)  | 2 (HP 変化なしでも `amount = power` を push) |
| 4-5 (複数フロート干渉なし)         | 4 (独立 `<span>` + 独立 `key`) |
| 5-1 (HP バー滑らか増加)            | 既存 `HpBar.module.css` の `transition: width 0.25s ease-out` で対応（変更不要） |
| 5-2 (バーと数値ラベルの同期)       | 既存 `BattleScreen.jsx` のストア購読で対応（変更不要） |
| 6-1 (リセット時は手札・配置のみ初期化) | 1 (`initializeBattle` で `playerHealEvents` クリアのみ・HP は既存挙動維持) |
| 6-2 (拡大トグル等で HP 不変)        | （副作用を出さない実装＝該当タスクで明示的に変更しない） |
| 6-3 (実行後の `slotAssignments` / `handCards` 維持) | 同上 |
| 6-4 (拡大切替時のレイアウト維持)    | 7 (`PlayerHealFloater` を `playerHpBox` 内絶対配置で完結) |
| 6-5 (attack/monster 処理の維持)    | 3 (隣接 `if` 追加で既存分岐に手を入れない)、7 (`onAnimationEnd` 分岐で被弾の id 進行を保つ) |
| 6-6 (実行開始 HP リセットと整合)   | 3 (`beginSequence` 冒頭で `playerHealEvents` クリア) |
