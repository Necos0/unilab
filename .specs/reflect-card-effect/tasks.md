# タスク一覧: カウンター（reflect）カード効果（reflect-card-effect）

## 概要

実装は (1) `battleStore` の状態・アクション拡張 → (2) `startExecution` のフェーズ処理拡張 → (3) `HpBar` の `reflectActive` プロパティ対応 → (4) `ReflectDamageFloater` の新規作成 → (5) `BattleScreen` の数値表示・グロー・フロート統合、の 5 ステージで進める。クリティカルパスはタスク 1〜4 のストア層変更で、ここが完了すれば反射ロジック自体は機能する。UI 系タスク（5〜8）はその後に並列着手可能。

合計タスク数：8 件 ｜ 想定工数：約 2.5〜3 時間

## タスク

- [x] **1. `battleStore` に `reflectActive` / `enemyReflectEvents` / `_enemyReflectCounter` フィールドを追加し、5 箇所で初期化する**  ✓ 完了
  - 内容：`useBattleStore` の初期状態に以下 3 フィールドを追加する。
    ```js
    reflectActive: false,
    enemyReflectEvents: [],
    _enemyReflectCounter: 0,
    ```
    さらに、`initializeBattle` / `retryFromFail` / `startExecution.beginSequence` の各 `set` ブロックに `reflectActive: false, enemyReflectEvents: []` を追加する。`applyPlayerDamage` の死亡検知ブロック（`nextHp === 0 && state.isExecuting` 分岐）に `result.reflectActive = false;` を追加する。`_enemyReflectCounter` はクリアしない（id の単調増加を保ち React の key 衝突を防ぐ）。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：なし
  - 完了条件：React DevTools で `useBattleStore` の状態に 3 フィールドが存在し、ステージ進入時・リセット時・実行開始時・Fail 遷移時にそれぞれ `reflectActive=false`、`enemyReflectEvents=[]` になることを確認できる。
  - 対応要件：要件 5-1, 5-2, 5-3, 5-4

- [x] **2. `battleStore` に 4 つの新規アクションを追加し、`applyGuard` を修正する**  ✓ 完了
  - 内容：以下 4 アクションを `useBattleStore` 内に追加する。
    - `applyReflect()`：`set({ reflectActive: true, guardShield: 0 })`（guard を上書き）。
    - `applyReflectDamage(amount)`：`set` の関数形式で `currentEnemyHp = Math.max(0, state.currentEnemyHp - amount)` を計算、`enemyReflectEvents` に `{ id: 'er-${counter}', amount }` を push、`_enemyReflectCounter` を `+1`。
    - `clearReflect()`：`set({ reflectActive: false })`。
    - `dismissEnemyReflectEvent(id)`：`set((state) => ({ enemyReflectEvents: state.enemyReflectEvents.filter((e) => e.id !== id) }))`。
    既存の `applyGuard(amount)` を `set({ guardShield: amount, reflectActive: false })` に修正する（reflect を排他クリア）。配置場所は既存の `applyGuard` / `consumeShieldOnDamage` / `clearGuard` の近く（バフ系アクションをまとめる）。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク 1
  - 完了条件：DevTools コンソールから以下を確認できる。
    - `useBattleStore.getState().applyReflect()` → `reflectActive === true`、`guardShield === 0`
    - `useBattleStore.getState().applyReflectDamage(20)` → `currentEnemyHp` が 20 減り、`enemyReflectEvents` に `{ id: 'er-0', amount: 20 }` が push される
    - `useBattleStore.getState().clearReflect()` → `reflectActive === false`
    - `useBattleStore.getState().applyGuard(30)` 後に `useBattleStore.getState().applyReflect()` → `guardShield === 0`、`reflectActive === true`
    - `useBattleStore.getState().applyReflect()` 後に `useBattleStore.getState().applyGuard(30)` → `reflectActive === false`、`guardShield === 30`
  - 対応要件：要件 1-1, 2-1, 6-1, 6-2, 7-1, 7-3

- [x] **3. `startExecution` のノードフェーズに `reflect` 分岐と `monster` の `reflectActive` 判定を組み込む**  ✓ 完了
  - 内容：`startExecution` 内の `phases.forEach` の `setTimeout` コールバック、既存のノード判定ブロックで以下を変更する。
    1. 既存の `monster` 分岐を以下に変更：
       ```js
       if (card && card.id === 'monster' && card.power > 0) {
         if (get().reflectActive) {
           get().applyReflectDamage(card.power);
         } else {
           get().consumeShieldOnDamage(card.power);
         }
       }
       ```
    2. 新規に `reflect` 分岐を追加（`card.power > 0` のガードは使わない、`card.id === 'reflect'` の存在チェックのみ）：
       ```js
       if (card && card.id === 'reflect') {
         get().applyReflect();
       }
       ```
    `attack` / `heal` / `guard` 分岐は変更しない。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク 2
  - 完了条件：ステージ 1-3 で reflect カードを slot-1 に配置して実行 → slot-2 の monster(50) で `applyReflectDamage(50)` が呼ばれ、敵 HP が 0 になることを確認できる。プレイヤー HP は減らない（`applyPlayerDamage` が呼ばれない）。reflect カードを置かずに同ステージを実行 → 既存通り `consumeShieldOnDamage` 経由でプレイヤーが被弾する。
  - 対応要件：要件 1-1, 2-1, 2-2, 2-4, 2-5, 3-1, 3-2, 8-1, 8-2, 8-3

- [x] **4. `startExecution` のエッジフェーズに `clearReflect` 判定を追加する**  ✓ 完了
  - 内容：既存のエッジフェーズの判定ブロック（`if (phase.type === 'edge')` 内、`clearGuard` を呼ぶブロック）に並列で以下を追加する。
    ```js
    const isPrevReflect = prevCard && prevCard.id === 'reflect';
    if (!isPrevReflect && get().reflectActive) {
      get().clearReflect();
    }
    ```
    `isPrevGuard` 判定や `clearGuard` 呼び出しは既存のまま残す。`prevCard` の取得も共通利用する。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク 3
  - 完了条件：(a) reflect カードの直後のエッジでは `reflectActive === true` が維持される。(b) その次のノード（monster 含む）通過後の次のエッジで `reflectActive === false` になる。(c) reflect → 空きスロット（attack 等）→ ... の場合、空きスロット通過後の次のエッジで `reflectActive === false` になり、attack カードの効果は通常通り発火する。(d) シールドと reflect が同時に有効になることはない（applyGuard / applyReflect の排他制御により）。
  - 対応要件：要件 4-1, 8-4

- [x] **5. `HpBar` コンポーネントに `reflectActive` プロパティを追加し、`.fill` をオレンジ色に切替できるようにする**  ✓ 完了
  - 内容：`HpBar.jsx` のシグネチャを `function HpBar({ currentHp, maxHp, shield = 0, reflectActive = false })` に変更し、`.fill` の className を以下のように組み立てる。
    ```jsx
    const fillClassName = reflectActive
      ? `${styles.fill} ${styles.reflect}`
      : styles.fill;
    ```
    内部の `<div className={styles.fill} ...>` を `<div className={fillClassName} ...>` に変更する。
    `HpBar.module.css` で `.fill` の `transition` に `background` を追加（`transition: width 0.25s ease-out, background 0.25s ease-out;`）。`.fill.reflect` クラスを新規追加（`background: #ff8c42;`）。
  - ファイル：`frontend/src/components/HpBar.jsx`、`frontend/src/components/HpBar.module.css`
  - 依存：なし（タスク 1〜4 と並列可能）
  - 完了条件：React DevTools で HpBar の `reflectActive` を `true` にすると `.fill` がオレンジ色（`#ff8c42`）に切り替わり、`false` に戻すと緑色（`#3ad430`）に戻る。色変化が `0.25s` の transition で滑らかに行われる。`shield` プロパティの挙動は変わらない。
  - 対応要件：要件 1-2, 4-2

- [x] **6. `ReflectDamageFloater` コンポーネントを新規作成する**  ✓ 完了
  - 内容：以下 2 ファイルを新規作成する。既存の `DamageFloater.jsx` / `DamageFloater.module.css` を踏襲し、色のみオレンジ（`#ff8c42`）に変更する。
    - `ReflectDamageFloater.jsx`：`useBattleStore` から `enemyReflectEvents` と `dismissEnemyReflectEvent` を購読し、各イベントを `<span>` で `-${amount}` 形式のフロートとして描画。`onAnimationEnd` で `dismiss(id)`。
    - `ReflectDamageFloater.module.css`：`.layer` は `DamageFloater` と同じ（`position: absolute; inset: 0; pointer-events: none;`）、`.number` は `color: #ff8c42`、`text-shadow: 0 0 4px #000, 0 2px 0 #000`、アニメーション名を `reflectFloat` にして `@keyframes reflectFloat`（0% → 20% → 100% の移動・スケール・opacity 変化は同じ）を定義。
  - ファイル：`frontend/src/features/battle/enemy/ReflectDamageFloater.jsx`（新規）、`frontend/src/features/battle/enemy/ReflectDamageFloater.module.css`（新規）
  - 依存：タスク 2（`enemyReflectEvents` / `dismissEnemyReflectEvent` を購読するため）
  - 完了条件：DevTools コンソールから `useBattleStore.getState().applyReflectDamage(30)` を呼ぶと、敵エリアに `-30` のオレンジ色フロートが上方向に浮かんで消える（ただし、まだ `BattleScreen` にマウントしていなければ表示されない。タスク 8 で統合）。
  - 対応要件：要件 7-1, 7-2, 7-3

- [x] **7. `BattleScreen` に `reflectActive` 購読を追加し、HpBar への prop 渡し・数値分子のオレンジ表示・`reflecting` クラス付与を統合する**  ✓ 完了
  - 内容：`BattleScreen.jsx` に以下を変更する。
    1. `guardShield` の購読近くに `const reflectActive = useBattleStore((s) => s.reflectActive);` を追加。
    2. プレイヤー側の `<HpBar>` 呼び出しに `reflectActive={reflectActive}` を追加：
       ```jsx
       <HpBar currentHp={currentPlayerHp} maxHp={maxPlayerHp} shield={guardShield} reflectActive={reflectActive} />
       ```
    3. HP 数値の分子クラス判定を 3 分岐に拡張：
       ```jsx
       <span
         className={
           guardShield > 0
             ? styles.hpNumeratorShielded
             : reflectActive
               ? styles.hpNumeratorReflect
               : undefined
         }
       >
         {currentPlayerHp + guardShield}
       </span>
       ```
    4. `playerHpBox` の className 配列に `reflectActive && styles.reflecting` を追加：
       ```jsx
       className={[
         styles.playerHpBox,
         isPlayerHit && styles.hit,
         isPlayerHealed && styles.healed,
         isShielded && styles.shielded,
         reflectActive && styles.reflecting,
       ].filter(Boolean).join(' ')}
       ```
    `BattleScreen.module.css` に以下を追加：
    ```css
    .hpNumeratorReflect {
      color: #ff8c42;
      text-shadow: 0 0 4px rgba(255, 140, 66, 0.6);
      transition: color 0.25s ease-out;
    }
    .playerHpBox.reflecting {
      box-shadow: 0 0 12px 4px rgba(255, 140, 66, 0.7);
      transition: box-shadow 0.25s ease-out;
    }
    ```
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`、`frontend/src/features/battle/BattleScreen.module.css`
  - 依存：タスク 2、タスク 5
  - 完了条件：(a) ステージ 1-3 で reflect カードを slot-1 に配置して実行 → reflect 通過時にプレイヤー HP バー fill がオレンジ色に切替、`playerHpBox` にオレンジグロー、HP 数値の分子（左側）がオレンジに変色する。(b) 次の monster 通過後の次のエッジで `reflectActive === false` に戻り、HP バーが緑、グロー消滅、分子の色も通常に戻る。(c) `guardShield > 0` の状態と `reflectActive === true` の状態が同時に成立しないこと（バフ排他制御の動作確認）。
  - 対応要件：要件 1-2, 1-3, 1-4, 4-2, 4-3, 4-4

- [x] **8. `BattleScreen` に `ReflectDamageFloater` を敵エリアにマウントする**  ✓ 完了
  - 内容：`BattleScreen.jsx` のインポートに `import ReflectDamageFloater from './enemy/ReflectDamageFloater';` を追加し、敵エリア内の既存 `<DamageFloater />` の直後に `<ReflectDamageFloater />` を配置する。
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`
  - 依存：タスク 6
  - 完了条件：(a) ステージ 1-3 で reflect → monster の流れを実行 → 敵エリアに `-50` のオレンジ色フロートが浮かび、敵 HP バーが減る。プレイヤー HP は変動しない。(b) reflect を置かないステージで monster 被弾時は従来通り赤系のダメージフロート（`DamageFloater`）が表示され、オレンジフロートは出ない。(c) 同時に両系統が発火することはない（反射成立時は `applyEnemyDamage` を通らないため）。
  - 対応要件：要件 2-3, 7-2, 7-4

## トレーサビリティ確認

| 要件 | 対応タスク |
|---|---|
| 1-1（reflectActive を true にセット） | タスク 2、タスク 3 |
| 1-2（HP バー .fill をオレンジに） | タスク 5、タスク 7 |
| 1-3（playerHpBox にグロー） | タスク 7 |
| 1-4（分子をオレンジ表示） | タスク 7 |
| 2-1（反射ダメージ適用） | タスク 2、タスク 3 |
| 2-2（プレイヤー HP 不変・被弾演出なし） | タスク 3（applyReflectDamage は applyPlayerDamage を呼ばない） |
| 2-3（オレンジフロート発火） | タスク 6、タスク 8 |
| 2-4（赤フロート発火しない） | タスク 3（applyEnemyDamage ルートを通らない） |
| 2-5（反射で敵 HP=0 → 勝利演出） | タスク 2（applyReflectDamage で `currentEnemyHp` 減算）、既存完了タイマーの判定 |
| 3-1, 3-2（モンスター以外なら effect なし） | タスク 3、タスク 4 |
| 4-1（次のエッジで clearReflect） | タスク 4 |
| 4-2（.fill 緑に戻る） | タスク 5、タスク 7 |
| 4-3（分子色を通常に戻す） | タスク 7（条件付与解除 + CSS transition） |
| 4-4（グローのフェードアウト） | タスク 7（`.reflecting` 除去 + transition） |
| 5-1〜5-4（初期化・リセット時のクリア） | タスク 1 |
| 6-1（reflect で guard 上書き） | タスク 2（applyReflect 内で guardShield: 0） |
| 6-2（guard で reflect 上書き） | タスク 2（applyGuard 修正） |
| 7-1（enemyReflectEvents に push） | タスク 2 |
| 7-2（ReflectDamageFloater 描画） | タスク 6、タスク 8 |
| 7-3（dismissEnemyReflectEvent） | タスク 2、タスク 6（onAnimationEnd で呼ぶ） |
| 7-4（既存 DamageFloater と独立） | タスク 6（別キュー・別フロート系統） |
| 8-1（attack 維持） | タスク 3（attack 分岐は変更なし） |
| 8-2（heal 維持） | タスク 3（heal 分岐は変更なし） |
| 8-3（guard 維持、reflect でない場合） | タスク 3（guard 分岐は変更なし、ただし applyGuard 修正で reflectActive をクリア） |
| 8-4（reflect → 空きスロットの他カード） | タスク 4（独立 if 分岐 + エッジでの clearReflect） |
| 8-5（勝利判定は reflectActive に非依存） | タスク 3（既存 `currentEnemyHp === 0` 判定をそのまま使う） |
| 8-6（Fail 中断機構の維持） | タスク 1（死亡検知ブロックに reflectActive: false のみ追加） |
