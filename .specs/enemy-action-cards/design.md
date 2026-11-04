# 設計書: 敵アクションカード（敵防御・敵回復・敵カウンター）

（親：`requirements.md` ／ 対象：`engine/simulateBattle.js`・`engine/evaluateCondition.js`・`stores/battleStore.js`・`data/card_help.json`）

## 概要

プレイヤー側の `guardShield` / `reflectActive` と**完全対称**な敵側 `enemyGuardShield` / `enemyReflectActive` を足し、既存のプレイヤー側ロジックを**鏡写し**する。ロジックは2系統（ヘッドレス `simulateBattle` と live `battleStore`）に同じ分岐を入れる（sim/live 整合チェックが既存で走る）。`evaluateCondition` 本体は不変で、評価コンテキストに2変数を足すだけ。

## 対称表（プレイヤー ↔ 敵）

| プレイヤー側（既存） | 敵側（新規） | 効果 |
|---|---|---|
| `guard` → `guardShield` | `monster_guard` → `enemyGuardShield` | シールド（次1マス吸収） |
| `reflect` → `reflectActive` | `monster_reflect` → `enemyReflectActive` | 反射（次1マス跳ね返し） |
| `heal` → playerHp 回復 | `monster_heal` → enemyHp 回復 | 回復（HP上限クランプ） |
| `monster`（敵攻撃）の反射/吸収判定 | `attack`/`finisher`（自攻撃）の反射/吸収判定 | 攻撃解決の鏡写し |

バフ寿命は両者とも「直後1マスのみ」。merge 透過（先日の修正）も両者に効く。

## エンジン（`simulateBattle.js`）

### applyNodeEffect（攻撃解決の鏡写し＋敵3カード）
`attack`/`finisher` の分岐に敵バフ判定を挟み、敵3カードの分岐を足す。`monster` のときの player 側処理の鏡。
```diff
   if ((card.id === 'attack' || card.id === 'finisher') && card.power > 0) {
-    enemyHp = Math.max(0, enemyHp - card.power * mult);
+    const dmg = card.power * mult;
+    if (enemyReflectActive) {
+      playerHp = Math.max(0, playerHp - dmg);           // 敵が反射 → 自分が受ける
+    } else if (enemyGuardShield > 0) {
+      const absorbed = Math.min(enemyGuardShield, dmg); // 敵シールドで吸収
+      enemyGuardShield -= absorbed;
+      enemyHp = Math.max(0, enemyHp - (dmg - absorbed));
+    } else {
+      enemyHp = Math.max(0, enemyHp - dmg);
+    }
   } else if (card.id === 'monster' && card.power > 0) {
     ... （既存：player 側の反射/シールド/被弾）
+  } else if (card.id === 'monster_guard' && card.power > 0) {
+    enemyGuardShield = card.power;   // 敵シールドをセット（累積でなく上書き）
+    enemyReflectActive = false;      // guard と reflect は排他
+  } else if (card.id === 'monster_reflect') {
+    enemyReflectActive = true;
+    enemyGuardShield = 0;
+  } else if (card.id === 'monster_heal' && card.power > 0) {
+    enemyHp = Math.min(maxEnemyHp, enemyHp + card.power);  // 敵回復（倍率なし）
   }
   ...
-  return { ...state, enemyHp, playerHp, guardShield, reflectActive };
+  return { ...state, enemyHp, playerHp, guardShield, reflectActive, enemyGuardShield, enemyReflectActive };
```
- `maxEnemyHp` を分割代入に追加（`const { maxPlayerHp, maxEnemyHp } = state;`）。
- 敵カードは `monster` と同様 **multiplier を適用しない**（敵攻撃/行動なのでプレイヤー強化の対象外）。

### clearTransientBuffs（対称拡張）
敵バフも「直前が monster_guard なら維持」「monster_reflect なら維持」、merge は透過（既存）。
```diff
 export function clearTransientBuffs(state, prevCard, prevNodeType) {
   if (prevNodeType === 'merge') return state;
   const isPrevGuard = prevCard?.id === 'guard';
   const isPrevReflect = prevCard?.id === 'reflect';
+  const isPrevEnemyGuard = prevCard?.id === 'monster_guard';
+  const isPrevEnemyReflect = prevCard?.id === 'monster_reflect';
   return {
     ...state,
     guardShield: isPrevGuard ? state.guardShield : 0,
     reflectActive: isPrevReflect ? state.reflectActive : false,
+    enemyGuardShield: isPrevEnemyGuard ? state.enemyGuardShield : 0,
+    enemyReflectActive: isPrevEnemyReflect ? state.enemyReflectActive : false,
   };
 }
```

### buildEvalContext（敵バフを変数に）
```diff
     variables: {
       playerHp: state.playerHp, enemyHp: state.enemyHp,
       maxPlayerHp: state.maxPlayerHp, maxEnemyHp: state.maxEnemyHp,
       guardShield: state.guardShield, reflectActive: state.reflectActive,
+      enemyGuardShield: state.enemyGuardShield,
+      enemyReflectActive: state.enemyReflectActive,
     },
```

### initialState（呼び出し側）
`simulateBattle` を呼ぶ側（検証ハーネス／battleStore）の `initialState` に `enemyGuardShield: 0` / `enemyReflectActive: false` を含める。

## live（`battleStore.js`）

### 効果適用（node phase, 〜1102-1120）：attack 解決の鏡写し＋敵3カード
```diff
   if (card && (card.id === 'attack' || card.id === 'finisher') && card.power > 0) {
-    get().applyEnemyDamage(card.power * multiplier);
+    const dmg = card.power * multiplier;
+    if (get().enemyReflectActive) get().applyEnemyReflectDamage(dmg);        // 敵反射 → 自分が受ける
+    else if (get().enemyGuardShield > 0) get().consumeEnemyShieldOnDamage(dmg); // 敵シールド吸収
+    else get().applyEnemyDamage(dmg);
   }
   ... （monster/heal/guard/reflect は既存のまま）
+  if (card && card.id === 'monster_guard' && card.power > 0) get().applyEnemyGuard(card.power);
+  if (card && card.id === 'monster_reflect') get().applyEnemyReflect();
+  if (card && card.id === 'monster_heal' && card.power > 0) get().applyEnemyHeal(card.power);
```

### 新 action（既存のプレイヤー側 action の鏡写し）
| 新 action | 鏡の元 | 実装 |
|---|---|---|
| `applyEnemyGuard(amount)` | `applyGuard` | `set({ enemyGuardShield: amount, enemyReflectActive: false })`＋敵シールド演出 |
| `applyEnemyReflect()` | `applyReflect` | `set({ enemyReflectActive: true, enemyGuardShield: 0 })` |
| `applyEnemyHeal(amount)` | `applyPlayerHeal` | `currentEnemyHp = min(maxEnemyHp, +amount)`＋回復フロート（敵側） |
| `consumeEnemyShieldOnDamage(amount)` | `consumeShieldOnDamage` | 敵シールドで吸収し残りを `applyEnemyDamage` |
| `applyEnemyReflectDamage(amount)` | `applyReflectDamage` | `applyPlayerDamage(amount)`＋反射フロート（敵→自分向き） |
| `clearEnemyGuard()` / `clearEnemyReflect()` | `clearGuard` / `clearReflect` | `set({ enemyGuardShield: 0 })` / `set({ enemyReflectActive: false })` |

### edge フェーズのバフ解除（〜1180、対称）
プレイヤー側の clear と同じ並びで敵バフも解除（merge 透過は既存ガードを流用）。
```diff
   const isPrevMerge = nodeMap[prevNodeId]?.type === 'merge';
   if (!isPrevMerge) {
     if (!isPrevGuard && get().guardShield > 0) get().clearGuard();
     if (!isPrevReflect && get().reflectActive) get().clearReflect();
+    if (prevCard?.id !== 'monster_guard' && get().enemyGuardShield > 0) get().clearEnemyGuard();
+    if (prevCard?.id !== 'monster_reflect' && get().enemyReflectActive) get().clearEnemyReflect();
   }
```

### initialState（複数箇所）＋ buildEvalContext（1034）
- `enemyGuardShield: 0` / `enemyReflectActive: false` を state 初期値（589/693）、`startExecution`（1000/1013）、Fail リセット（1311 付近）、`secondPhase` 遷移に追加。
- `buildEvalContext`（1034）に `enemyGuardShield` / `enemyReflectActive` を追加。

### 演出（プレイヤー側の対称）
- **敵シールド表示（HPバー2行化）**：ワールド5以降、敵 HP 表示を**2行**にし、HP バーの下（または上）に `enemyGuardShield` のシールドバーを並べる（プレイヤー側 `HpBar`＋`GuardBar` の鏡写し。`BattleScreen` の `enemyHpBox`）。
- **敵カウンター構え**：`enemyReflectActive` 中は敵 HP バー/敵エリアをオレンジ系に（プレイヤーの反射表示の鏡）。
- **反射ダメージフロート**：`applyEnemyReflectDamage` 時に「敵→自分向き」のフロータ（既存 `enemyReflectEvents` の逆向き版、または `playerDamageEvents` に反射フラグ）。
- 演出はロジックと分離可能。まずロジック（効果・状態・条件・sim 整合）を入れ、視覚は次段で調整してよい（要件5-2は満たすが見た目の作り込みは後追い可）。

## `card_help.json`
`monster_guard` / `monster_heal` / `monster_reflect` の3エントリを追加（ふりがな付き、§1 の名称）。既存カードの説明形式に合わせる。

## 検証方針
- **ヘッドレス単体**：`applyNodeEffect` 直叩きで、敵guard→次attack吸収／敵reflect→次attackが自分に返る／敵heal→enemyHp増（上限）／merge透過の対称、を確認。
- **ステージ**：5-2（guard/heal）・5-3（reflect）を `simulateBattle` で解答クリア検証（想定解が win）。
- **sim/live 整合**：`startExecution` の既存 sim/live 比較で mismatch 警告が出ないこと。
- **非回帰**：1-1〜4-4（敵カード不使用）の展開・結末が不変。build/lint 通過。

## トレードオフ・未確定
| 項目 | 対応 |
|---|---|
| 反射フロートの実装（新キュー vs 既存流用） | live 実装時に既存 `playerDamageEvents`/`enemyReflectEvents` を見て軽い方を選ぶ |
| 敵シールド/構えの見た目 | プレイヤー側 CSS/コンポーネントの鏡写し。細部は目視調整 |
| multiplier×敵カード | 敵カードには適用しない（`monster` と対称）で確定 |

## 要件トレーサビリティ
| 要件 | 設計 |
|---|---|
| 1（3種効果） | applyNodeEffect ＋ live 効果分岐 ＋ 新 action |
| 2（状態・寿命） | enemyGuardShield/enemyReflectActive ＋ clearTransientBuffs/edge clear 対称 |
| 3（攻撃解決） | attack/finisher の反射→吸収→全部（sim/live 両方） |
| 4（条件参照） | buildEvalContext に2変数（sim/live） |
| 5（整合・演出） | 同一ロジック＋sim/live比較＋敵側演出 |
| 6（help・非回帰） | card_help 追加＋既存ステージ不変 |
