# タスク一覧: 敵アクションカード

## 概要

プレイヤー側の鏡写しで実装。**ロジック先行**（sim→live→card_help）で動作・整合を固め、**演出は後段**（敵HPバー2行化ほか）。各段で検証する。

合計タスク数：7件 ｜ 想定工数：4〜6時間

## タスク

- [ ] **1. sim ロジック（`engine/simulateBattle.js`）**
  - 内容：`applyNodeEffect` に敵3カード分岐＋`attack`/`finisher`の反射/吸収判定、`clearTransientBuffs` の敵バフ対称拡張、`buildEvalContext` に `enemyGuardShield`/`enemyReflectActive`。state 分割代入にデフォルト（0/false）を付け未定義に強く。
  - ファイル：`src/engine/simulateBattle.js`
  - 完了条件：敵guard吸収／敵reflect跳ね返し／敵heal回復／merge透過の対称がヘッドレスで正しい。

- [ ] **2. sim 単体検証**
  - 内容：`applyNodeEffect` 直叩き＆小フローで、敵guard→次attack吸収、敵reflect→次attackが自分に返る、敵heal→enemyHp増(上限)、非敵カードは従来どおり、を確認。
  - ファイル：検証スクリプト（scratchpad）
  - 依存：1
  - 完了条件：全ケース期待どおり。

- [ ] **3. live ロジック（`stores/battleStore.js`）**
  - 内容：新 action 7種（`applyEnemyGuard`/`applyEnemyReflect`/`applyEnemyHeal`/`consumeEnemyShieldOnDamage`/`applyEnemyReflectDamage`/`clearEnemyGuard`/`clearEnemyReflect`）、効果適用分岐（attack解決＋敵3カード）、edgeバフ解除の対称、initialState（複数箇所）＋`buildEvalContext` に2変数。
  - ファイル：`src/stores/battleStore.js`
  - 依存：1
  - 完了条件：live の効果が sim と一致（`startExecution` の sim/live 比較で mismatch 警告なし）。

- [ ] **4. `card_help.json`**
  - 内容：`monster_guard`/`monster_heal`/`monster_reflect` の説明を追加（ふりがな付き）。
  - ファイル：`src/data/card_help.json`
  - 依存：なし
  - 完了条件：3種が既存形式で追加され build が通る。

- [ ] **5. 演出：敵HPバー2行化＋構え＋反射フロート**
  - 内容：`BattleScreen` の `enemyHpBox` を HP＋シールドの2行に（プレイヤー `HpBar`＋`GuardBar` の鏡）。`enemyReflectActive` 中の敵エリア表現、`applyEnemyReflectDamage` の敵→自分フロート。
  - ファイル：`src/features/battle/BattleScreen.jsx` ほか
  - 依存：3
  - 完了条件：敵シールド残量・構え・反射が視認できる。

- [ ] **6. ステージ検証（5-2/5-3）**
  - 内容：5-2（guard/heal）・5-3（reflect）実装時に、`simulateBattle` で想定解が win になることを確認。※ 本タスクはステージ実装時に回す（原案は後日）。
  - 依存：1・3
  - 完了条件：各ステージの解答が win。

- [ ] **7. 非回帰・build/lint**
  - 内容：1-1〜4-4（敵カード不使用）の展開・結末が不変、build/lint 通過。
  - 依存：1・3
  - 完了条件：既存ステージ不変、エラーなし。

## 要件トレーサビリティ
| 要件 | タスク |
|---|---|
| 1・2・3（効果・状態・解決） | 1・3 |
| 4（条件参照） | 1・3 |
| 5（整合・演出） | 2・3・5 |
| 6（help・非回帰） | 4・7 |
