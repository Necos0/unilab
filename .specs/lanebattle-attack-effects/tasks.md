# タスク一覧: 陣取り合戦 演出強化（攻撃エフェクト・本陣キャラ）

## 概要

純シム（`stepSim`）→描画層（`createRenderer`）の既存系統に沿って下から積む。まず **(A) シムに攻撃イベントキューを足す**（純データのみ・DOM非依存）、次に **(B) エフェクトDOM生成部**と **(C) 本陣キャラスプライト**を作り、**(D) 描画層で両者を結線**、最後に **(E) CSS** で見た目を仕上げる。クリティカルパスは A→D。B/C/E は D の前に作れるが、動作確認は D 完了後。

合計タスク数：7件 ｜ 想定工数：約6時間

パス基準：`frontend/src/features/lanebattle/`

## タスク

- [ ] **1. シムに攻撃イベントキューを追加**
  - 内容：`createBattleState()` の返すオブジェクトに `hits: []` を足す。攻撃イベントの型は `{ fromX, fromLane, toX, toLane, side, ranged }`（純データ）。
  - ファイル：`engine/battleState.js`
  - 依存：なし
  - 完了条件：`createBattleState().hits` が空配列で返る。既存フィールド（units/base/shield 等）に影響なし。
  - 対応要件：4-1

- [ ] **2. 攻撃解決時に hit を push**
  - 内容：攻撃アクションの発生3点で `state.hits.push(hit)` する。①`stepUnits` のユニット→ユニット攻撃（`resolveAttack` 呼び出し地点）＝攻撃者 `u`→主対象 `target`。②`stepUnits` のユニット→本陣直撃＝`u`→敵本陣（x は `config.field.*BaseX`、lane は `u.lane`）。③`stepBaseDefense` の本陣→侵入ユニット＝本陣→`target`。`ranged` は `u.ranged ?? (u.range >= config.cpu.attr.rangedRange)` で判定。pierce/splash でも**主対象へ1件のみ**。DOM・乱数・時刻には触れない。
  - ファイル：`engine/stepSim.js`（必要なら小ヘルパ `pushHit`/`pushHitToBase`/`pushHitFromBase` を同ファイル内に追加）
  - 依存：タスク1
  - 完了条件：headless 検証（scratchpad で rolldown→node）で、1試合中 `state.hits` に `you`/`cpu` 両側・ユニット間／対本陣／本陣防衛の各イベントが積まれることを確認。純シムが引き続き DOM 非依存で走る。
  - 対応要件：1-1, 2-1, 3-1, 3-2, 3-3, 4-1, 6-1, 6-2

- [ ] **3. 攻撃エフェクトDOM生成モジュール**
  - 内容：`createAttackEffect(fxEl, hit)` を新規作成。hit の `fromX/toX` を `x/virtualWidth*100 %`、lane を帯中央 Y（`createRenderer` の `laneYs` と同式）へ変換。遠隔（`ranged`）＝飛翔体 `.lbf-proj`（`--dx/--dy` を付与し from→to へ移動）、近接＝被弾点 to に斬撃 `.lbf-slash`。`side` で `.you/.cpu` クラス付与。`el.addEventListener('animationend', () => el.remove())` で自走remove。
  - ファイル：`engine/laneEffect.js`（新規）
  - 依存：なし（データ構造はタスク1で確定）
  - 完了条件：ダミー hit を渡すと fxEl 配下に要素が1つ追加され、アニメ終了で DOM から消える（単体で手動確認可能な純DOM関数）。
  - 対応要件：1-2, 1-3, 1-4, 2-2, 2-3, 5-1, 5-3, 6-3

- [ ] **4. 本陣キャラスプライトモジュール**
  - 内容：`createBaseSprite(fieldEl, { side, baseX, framePath, frames, frameMs, facing, scale })` を新規作成。固定位置（`left: baseX/virtualWidth*100%`、盤面下寄せ）に `.lbf-basechar` を置き、`facing` で `scaleX(±1)`、`scale` で大きさ調整。`setFrame(i)` でコマ画像差し替え、`remove()` で撤去。hero 用 framePath は `heroSpritePath`、dragon_final 用は `getEnemyFramePath('dragon_final','idle',i)` を呼び出し側から渡す。
  - ファイル：`engine/baseSprite.js`（新規）、流用：`src/features/map/heroSpritePath.js`・`src/features/battle/enemy/enemySpritePath.js`
  - 依存：なし
  - 完了条件：hero（4コマ・右向き）と dragon_final（3コマ・左向き・大きめ）の2体が指定位置に生成でき、`setFrame` でコマが変わる。HPバー柱 `.lbf-base` と重ならない z/配置。
  - 対応要件：7-1, 7-2, 7-4, 7-5

- [ ] **5. 描画層でキュー消費・本陣キャラ idle・片付けを結線**
  - 内容：`createRenderer` 初期化で ①`.lbf-fx` 層を `fieldEl` 直下に1枚作る、②`createBaseSprite` で hero/dragon_final を生成。`sync(state, dt)` 末尾で `for (const h of state.hits) createAttackEffect(fxEl, h); state.hits.length = 0;`、および各本陣キャラの `animT += dt` で `frameMs` ごと `setFrame`。`destroy()` で `.lbf-fx`・本陣キャラを撤去。`MatchView` の結線は変更不要。
  - ファイル：`engine/createRenderer.js`
  - 依存：タスク2, 3, 4
  - 完了条件：実機で攻撃のたびにエフェクトが元→先に出て自走で消え、本陣に hero/dragon が idle 表示される。試合終了・リセットでエフェクト／キャラが残らない（`state.hits` のリセットは `createRuntime` のリセット経路でも空化）。
  - ファイル（リセット保険）：`engine/createRuntime.js`
  - 対応要件：1-5, 4-2, 4-3, 4-4, 7-3, 7-6

- [ ] **6. CSS（ピクセルアート調の見た目）**
  - 内容：`.lbf-fx`（`position:absolute; inset:0; pointer-events:none; overflow:hidden`）、`.lbf-proj`／`.lbf-slash`（`image-rendering: pixelated`、`.you`=寒色／`.cpu`=暖色）、`@keyframes projFly`（translate 0→`--dx,--dy`＋フェード, 約180–220ms）・`@keyframes slashPop`（拡大→フェード, 約140ms）、`.lbf-basechar`（配置・大きさ・向き）を追加。過剰装飾は避け短時間で消す。
  - ファイル：`lanebattle.css`
  - 依存：タスク3, 4（クラス名確定後）
  - 完了条件：連射しても画面を覆わず、本編のドット絵意匠に馴染む。味方／敵のエフェクトが色で見分けられる。
  - 対応要件：2-2, 5-1, 5-3

- [ ] **7. 通し検証・ビルド/lint**
  - 内容：headless で push が崩れていないか最終確認し、`npm run build` と `npm run lint` を通す。試合開始→戦闘→決着→リセットでエフェクト・本陣キャラが期待どおり出入りすることを実機で確認。
  - ファイル：（検証のみ、恒久ファイル追加なし。temp は scratchpad）
  - 依存：タスク5, 6
  - 完了条件：build・lint がパスし、要件1〜7の受け入れ基準を満たす（ダメージ数値は出さない＝スコープ外のまま）。
  - 対応要件：4-1, 4-4, 5-2（非目標の維持）

## トレーサビリティ（要件→タスク）

| 要件 | タスク |
|------|-------|
| 1 攻撃モーション表示 | 2, 3, 5 |
| 2 向きが分かる | 2, 3, 6 |
| 3 対象の種類（対ユニット/対本陣/本陣防衛） | 2, 3 |
| 4 既存設計・性能整合 | 1, 2, 5, 7 |
| 5 トーン・非目標（数字出さない） | 3, 6, 7 |
| 6 近接/遠隔の出し分け | 2, 3 |
| 7 本陣キャラ | 4, 5 |
