# タスク一覧: バトル失敗演出とやり直し機能（battle-fail-retry）

## 概要

実装は (1) ストア層の状態追加・アクション追加・判定変更 → (2) 軌跡可視化の各 UI コンポーネント変更 → (3) Fail オーバーレイ新規作成 → (4) `BattleScreen` 統合と関連ボタンの disable 化、の 4 ステージで進める。クリティカルパスは「ストア変更（タスク 1〜3）」で、ここが完了すれば後続の UI 変更は並列に検証できる。各 UI タスクは React DevTools で `failPhase` / `traversedEdgeIds` / `traversedNodeIds` の値を手動操作することで、後続タスク（オーバーレイ・統合）を待たずに動作確認が可能。

合計タスク数：11件 ｜ 想定工数：約 3.5〜4.5 時間

> **更新ノート（実装中の仕様変更）**：実装中に「プレイヤー HP=0 → heal で復活 → 勝利」の抜け道が見つかったため、要件 2-4 を「実行を中断しない」から「即座に Fail へ遷移」に反転した。これに伴い `requirements.md` / `design.md` を更新し、本ファイルにタスク 11（中断機構の追加）を追加した。タスク 1〜10 の番号と内容は維持。

## タスク

- [x] **1. `battleStore` に新規フィールド 3 つを追加し `initializeBattle` でクリアする**  ✓ 完了
  - 内容：`failPhase`（`null | 'shown'`）、`traversedEdgeIds`（`string[]`）、`traversedNodeIds`（`string[]`）の 3 フィールドを `useBattleStore` の初期状態に追加する。`initializeBattle(stage)` の `set(() => ({ ... }))` 内に各フィールドの初期化（`failPhase: null`、`traversedEdgeIds: []`、`traversedNodeIds: []`）を追加する。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：なし
  - 完了条件：React DevTools で `useBattleStore` の状態に 3 フィールドが存在し、ステージ進入時とリセットボタン押下時に空配列・null になることを確認できる。
  - 対応要件：要件 8-1（既存挙動の維持）、要件 1〜3 の前提条件

- [x] **2. `battleStore` に `retryFromFail` アクションを追加する**  ✓ 完了
  - 内容：`failPhase` を `null` に戻し、`currentEnemyHp` / `currentPlayerHp` を各 `maxHp` に戻し、`enemyDamageEvents` / `playerDamageEvents` / `playerHealEvents` / `traversedEdgeIds` / `traversedNodeIds` を空にするアクションを追加する。**`slotAssignments` と `handCards` は意図的に触らない**（要件 5-2 を満たすため）。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク1
  - 完了条件：React DevTools で `useBattleStore.getState().retryFromFail()` を呼び出し、上記フィールドが期待通りリセットされ、`slotAssignments` / `handCards` が変化しないことを確認できる。
  - 対応要件：要件 5-1, 5-2, 5-3, 5-4

- [x] **3. `startExecution` を変更：軌跡蓄積・勝敗判定の修正・`failPhase` セット**  ✓ 完了
  - 内容：`startExecution(stage)` の `beginSequence` を以下の 3 点で変更する。
    1. 開始時の `set` に `traversedEdgeIds: []`、`traversedNodeIds: []`、`failPhase: null` のクリアを追加。
    2. `phases.forEach` の `setTimeout` 内で `executionStep` 更新と同時に、`phase.type === 'edge'` なら `traversedEdgeIds` に `phase.id` を append、`phase.type === 'node'` なら `traversedNodeIds` に `phase.id` を append する（`set` の関数形式で不変更新）。既存のカード効果分岐（`attack` / `monster` / `heal`）はそのまま残す。
    3. 完了時 `setTimeout` の判定を `currentEnemyHp === 0` から `currentEnemyHp === 0 && currentPlayerHp > 0` に変更し、`else` 分岐で `set({ failPhase: 'shown' })` を実行する。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク1
  - 完了条件：(a) ステージ 1-1 でカードを置き勝てる構成で実行 → 既存どおり CLEAR! が表示される。(b) 弱いカードだけで実行して敵 HP > 0 で完了 → React DevTools で `failPhase === 'shown'`、`traversedEdgeIds` / `traversedNodeIds` に通過済み id が並んでいる。(c) ステージ 1-2 のモンスタースロットでプレイヤー HP=0 になる構成 → `failPhase === 'shown'` に遷移する。
  - 対応要件：要件 1-1〜1-6（軌跡蓄積）、要件 2-1〜2-6（勝敗判定）、要件 8-1, 8-3（既存挙動の維持）

- [x] **4. `AnimatedProgressEdge` に `.traversed` クラスを追加し白いネオン光を表現する**  ✓ 完了
  - 内容：`AnimatedProgressEdge.jsx` で `useBattleStore((s) => s.traversedEdgeIds.includes(id))` を購読し、`<path>` の className に CSS Modules の `.traversed` を条件付与する（`react-flow__edge-path` クラスは保持）。`AnimatedProgressEdge.module.css` に `.traversed` を追加し、`stroke: #f5f5ff` ＋ `filter: drop-shadow(0 0 4px rgba(229, 229, 255, 0.9))` で白い発光を表現する。
  - ファイル：`frontend/src/features/battle/flowchart/AnimatedProgressEdge.jsx`、`frontend/src/features/battle/flowchart/AnimatedProgressEdge.module.css`
  - 依存：タスク3
  - 完了条件：実行を完了したあと（CLEAR! でも Fail でも）、通過したエッジが白く光った状態で固定される。緑の進行アイコン（`<circle>`）はアクティブ中のみ表示される現状挙動が維持されている。
  - 対応要件：要件 1-1, 1-2, 1-5

- [x] **5. `SlotNode` に `.traversed` クラスを追加し固定ハイライトを表現する**  ✓ 完了
  - 内容：`SlotNode.jsx` で `useBattleStore((s) => s.traversedNodeIds.includes(id))` を購読し、`isTraversed` 変数を組み立てて className 配列に `isTraversed && styles.traversed` を追加する。`SlotNode.module.css` に `.slot.traversed` を追加し、既存の `.active` キーフレームの `to` 状態（`filter: brightness(1.6) drop-shadow(0 0 10px rgba(229, 229, 255, 0.9))`）と同等の光を **静的に** 適用する（アニメーションなし）。
  - ファイル：`frontend/src/features/battle/flowchart/SlotNode.jsx`、`frontend/src/features/battle/flowchart/SlotNode.module.css`
  - 依存：タスク3
  - 完了条件：実行が通過したスロットが、フェーズ点滅後も光ったまま固定される。点滅中（`.active`）と固定光（`.traversed`）が同時に当たる瞬間の見た目に違和感がない。
  - 対応要件：要件 1-3, 1-4, 1-6

- [x] **6. `StartNode` と `GoalNode` に `.traversed` クラスを追加する**  ✓ 完了
  - 内容：両ノードで `useBattleStore((s) => s.traversedNodeIds.includes('start'))` ／ `'goal'` を購読し、`.traversed` を条件付与する。`StartNode.module.css` ／ `GoalNode.module.css` に既存 `.active` の終端状態に相当する固定光スタイルの `.traversed` を追加する（既存の `startGoalHighlight` キーフレーム終端と同じ `filter` を `.marker.traversed` に当てる）。
  - ファイル：`frontend/src/features/battle/flowchart/StartNode.jsx`、`frontend/src/features/battle/flowchart/StartNode.module.css`、`frontend/src/features/battle/flowchart/GoalNode.jsx`、`frontend/src/features/battle/flowchart/GoalNode.module.css`
  - 依存：タスク3
  - 完了条件：通過後のスタートマーカー・ゴールマーカーがそれぞれ固定で光る。Fail 時はゴールマーカーまで光が伸び、勝利時も同様。
  - 対応要件：要件 1-3, 1-4, 1-6

- [x] **7. `EnemySprite` に `.dimmed` クラスを追加し失敗時の半透過を表現する**  ✓ 完了
  - 内容：`EnemySprite.jsx` で `useBattleStore((s) => s.failPhase)` を購読し、`failPhase === 'shown'` のとき `<img>` の className に `.dimmed` を付与する。既存の `.fading`（勝利時の `opacity: 0`）とは独立クラスにする。`EnemySprite.module.css` に `.dimmed { opacity: 0.4; transition: opacity 0.3s ease-out; }` を追加する。
  - ファイル：`frontend/src/features/battle/enemy/EnemySprite.jsx`、`frontend/src/features/battle/enemy/EnemySprite.module.css`
  - 依存：タスク3
  - 完了条件：実行に失敗した瞬間、敵スプライトが薄く（半透過で）表示される。0.4 の透過率は実装後に視認確認し、必要なら 0.35〜0.5 で調整する。勝利時の `.fading` 挙動は変わらない。
  - 対応要件：要件 3-5

- [x] **8. `BattleFailOverlay` を新規作成する**  ✓ 完了
  - 内容：`VictoryClearOverlay` を踏襲した構造で、敵エリアに絶対配置されるオーバーレイを新規作成する。
    - JSX：`<div class="overlay">` 内に `<div class="failText"><span class="failTextInner">Fail</span></div>` と `<div class="buttonRow">` を配置。`buttonRow` には左から「マップへ戻る」「やり直す」の 2 ボタンを並べる。`onExitToMap` / `onRetry` を props で受け取り、それぞれのボタンの `onClick` に渡す。
    - CSS：`VictoryClearOverlay.module.css` のスタイルをベースに、`failText` のフォント色を赤系（`#ff5a5a` 起点で実装時に調整）に変更。`failTextInner` には `padding-left: 0.4em` を当ててグリフ位置補正（`l` の左寄り描画対策）。`buttonRow` は `display: flex; justify-content: center; gap: 1.5rem;` で左右 2 ボタンを中央揃え。`button` のスタイルは `VictoryClearOverlay.module.css` の `.button` と同じ意匠を使う。
  - ファイル：`frontend/src/features/battle/BattleFailOverlay.jsx`（新規）、`frontend/src/features/battle/BattleFailOverlay.module.css`（新規）
  - 依存：なし（タスク1〜3 と並列でも可だが、視覚確認のため後段に置く）
  - 完了条件：手動でこのコンポーネントをマウントすると、Fail テキストが赤色・視覚的に中央に表示され、左右 2 ボタンが中央揃えで並ぶ。`onClick` で渡したハンドラがそれぞれ呼ばれる。
  - 対応要件：要件 3-1, 3-2, 3-3, 4-1（部分）, 5-1（部分）

- [x] **9. `BattleScreen` に Fail フェーズの統合を行う**  ✓ 完了
  - 内容：以下を `BattleScreen.jsx` および `BattleScreen.module.css` に統合する。
    1. `useBattleStore((s) => s.failPhase)` と `useBattleStore((s) => s.retryFromFail)` を購読する。
    2. ルートクラス組み立てに `failPhase && styles.failed` を追加し、`BattleScreen.module.css` に `.root.failed { pointer-events: none; }` を追記する。
    3. `BackToMapButton` のマウント条件を `victoryPhase !== 'cleared' && failPhase !== 'shown'` に変更する（既存条件を AND 拡張）。
    4. `enemyHpBox` の className に `failPhase === 'shown' && styles.dimmed` を追加し、`BattleScreen.module.css` に `.enemyHpBox.dimmed { opacity: 0.4; transition: opacity 0.3s ease-out; }` を追加する。
    5. `victoryPhase === 'cleared'` のオーバーレイ表示分岐の後ろに、`failPhase === 'shown'` のとき `<BattleFailOverlay onExitToMap={onExitToMap} onRetry={retryFromFail} />` をマウントする分岐を追加する（敵エリア内）。
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`、`frontend/src/features/battle/BattleScreen.module.css`
  - 依存：タスク2、タスク7、タスク8
  - 完了条件：(a) 失敗 → Fail オーバーレイ表示、敵スプライト＋敵 HP バーが半透過、画面ロック、右上 `BackToMapButton` 非表示。(b)「やり直す」→ Fail オーバーレイが消え、敵 HP・プレイヤー HP が満タンに戻り、敵スプライトが完全表示に戻り、軌跡の白い光がすべてクリアされる。スロット配置は保持されている。(c)「マップへ戻る」→ マップ画面へ遷移する。(d) ステージ進入時／勝利時の挙動が回帰していない。
  - 対応要件：要件 2-6, 3-1, 3-3, 3-4, 3-6, 3-7, 4-1, 4-2, 5-1, 5-2, 5-3, 5-4, 5-5, 5-6, 8-2

- [x] **10. `PlayButton` と `ResetButton` の disable 条件に `failPhase` を追加する**  ✓ 完了
  - 内容：両ボタンの `isDisabled` 計算に `useBattleStore((s) => s.failPhase)` の購読を追加し、`failPhase !== null` を OR 条件として加える。`PlayButton.jsx` は既存の `victoryPhase !== null` と並列に、`ResetButton.jsx` も同様に追加する。
  - ファイル：`frontend/src/features/battle/flowchart/PlayButton.jsx`、`frontend/src/features/battle/flowchart/ResetButton.jsx`
  - 依存：タスク3、タスク9
  - 完了条件：Fail オーバーレイ表示中、`PlayButton` と `ResetButton` が `disabled` 状態になっており、CSS の `:disabled` スタイル（半透明＋ `not-allowed` カーソル）が反映される。「やり直す」直後の操作可能状態（A 状態）では両ボタンが通常通り押せる。
  - 対応要件：要件 7-1, 7-2, 7-4

- [x] **11. `applyPlayerDamage` に死亡検知を追加し、`startExecution` に中断ガードを追加する（要件 2-4 抜け道防止）**  ✓ 完了
  - 内容：実行中にプレイヤー HP が 0 になった時点で即座に Fail フェーズへ遷移し、残りのフェーズ実行を打ち切るための中断機構を追加する。
    1. `applyPlayerDamage(amount)` の `set` コールバック内で、HP 減算後の `nextHp === 0 && state.isExecuting` を満たすとき、戻り値オブジェクトに `failPhase: 'shown'`、`isExecuting: false`、`executionStep: null`、`currentPhaseMs: null` を加える。1 トランザクションで状態を一括遷移させ、途中状態を観測されないようにする。
    2. `startExecution` の `phases.forEach((phase, i) => setTimeout(() => {...}, ...))` の `setTimeout` コールバック先頭に `if (get().failPhase !== null) return;` を追加し、中断後の軌跡 push・カード効果発火を全面ブロックする。
    3. `startExecution` の完了タイマー（`setTimeout(() => {...}, phases.length * phaseMs)`）コールバック先頭にも同じ `if (get().failPhase !== null) return;` を追加し、中断後の勝敗判定を抑止する。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク3
  - 完了条件：(a) ステージ 1-2 で `attack=80` が当たって敵 HP=0、その後モンスタースロットを通ってプレイヤー HP=0 → React DevTools で `failPhase === 'shown'`、`executionStep === null`、相打ち判定で Fail になる（CLEAR! が出ない）。(b) ステージ 1-2 で `attack=80` を slot-1、`heal=10` を slot-3、モンスター被弾でプレイヤー HP=0 になる構成 → モンスタースロット通過直後に即 Fail へ遷移し、後続の heal カードが発火しない（プレイヤー HP は 0 のまま）。(c) 通常の失敗（敵 HP > 0 で完了）と勝利は引き続き想定どおり動作する。
  - 対応要件：要件 2-4, 2-5

## トレーサビリティ確認

| 要件 | 対応タスク |
|---|---|
| 1-1, 1-2, 1-5（エッジ通過軌跡） | タスク3（蓄積）、タスク4（描画） |
| 1-3, 1-4, 1-6（ノード固定ハイライト） | タスク3（蓄積）、タスク5（SlotNode）、タスク6（Start/Goal） |
| 2-1, 2-2, 2-3（正常完了時の勝敗判定） | タスク3（判定変更） |
| 2-4（HP=0 で即座に Fail へ中断） | タスク11（applyPlayerDamage 死亡検知 + startExecution 中断ガード） |
| 2-5（中断後は勝敗判定を実行しない） | タスク11（完了タイマー早期 return） |
| 2-6, 2-7（操作ロック） | タスク9（`.root.failed` の付与） |
| 3-1, 3-2, 3-3（Fail オーバーレイ表示） | タスク8（コンポーネント）、タスク9（マウント） |
| 3-4（右上 BackToMapButton の出し分け） | タスク9 |
| 3-5（敵スプライト半透過） | タスク7 |
| 3-6（敵 HP バー半透過） | タスク9 |
| 3-7（軌跡維持） | タスク3（クリアのタイミングをやり直し時のみに限定） |
| 4-1, 4-2（マップへ戻る） | タスク8（ボタン）、タスク9（ハンドラ配線） |
| 5-1〜5-6（やり直すと配置保持） | タスク2（アクション）、タスク9（配線） |
| 6-1〜6-3（リセットボタンの挙動） | 既存 `initializeBattle` 挙動を維持（タスク1で 3 フィールド初期化を追加） |
| 7-1, 7-2, 7-4（disable） | タスク10 |
| 7-3（ZoomButton は既存仕様踏襲） | 変更なしで自動的に満たす |
| 8-1, 8-2（CLEAR! 演出維持） | タスク3（勝利分岐は既存どおり）、タスク9（既存マウント分岐は変更しない） |
| 8-3, 8-4（モンスター・回復カード演出維持） | タスク3（カード効果分岐は既存どおり） |
| 8-5（A 状態の `endDrag` 不変） | `retryFromFail` が `slotAssignments` / `handCards` を触らない設計（タスク2） |
