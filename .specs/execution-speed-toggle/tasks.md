# タスク一覧: 実行速度トグルボタン（2倍速）

## 概要

状態の根幹（`battleStore`）から積み上げる: タスク1 で `speedMultiplier` state + toggle action + リセット経路を追加 → タスク2 で `startExecution` の `setTimeout` 遅延と `currentPhaseMs` を倍率適用に書き換え → タスク3 で `SpeedToggleButton` コンポーネントを新規作成 → タスク4 で `BattleScreen` への配置と CSS variable 同期 → タスク5 で対象 CSS animation の duration を `calc()` で書き換える。タスク2 完了時点で「JS 側のみ倍速（エッジ・ノードのフェーズ時間のみ短縮）」「CSS animation は通常速度」という中間状態に到達。タスク5 完了でアニメ全体が同期して 50% に。

合計タスク数：5件 ｜ 想定工数：3〜4時間

## タスク

- [x] **1. `battleStore` に `speedMultiplier` state と `toggleSpeedMultiplier` action を追加し、リセット経路を整備**  ✓ 完了
  - 内容：
    - モジュールスコープに `const SPEED_MULTIPLIERS = [1, 2];` を追加（将来 3x/4x 拡張用、`NODE_PHASE_MS` 等と同じ場所）
    - `create((set, get) => ({ ... }))` の初期 state に `speedMultiplier: 1` を追加
    - 新規 action `toggleSpeedMultiplier()` を追加。実装は `set((s) => { const idx = SPEED_MULTIPLIERS.indexOf(s.speedMultiplier); const next = SPEED_MULTIPLIERS[(idx + 1) % SPEED_MULTIPLIERS.length]; return { speedMultiplier: next }; })`
    - リセット経路：以下の各 `set(...)` 内に `speedMultiplier: 1` を追加
      - `initializeBattle(stage)` の初期化 set
      - `startVictorySequence(enemyId)` 内の set（勝利演出開始）
      - `failPhase: 'shown'` を set している全箇所（`startExecution` 内の `scheduleComplete`・runaway 検知・LOOP_MAX_VISITS 超過、`applyPlayerDamage` の HP=0 経路など、grep で網羅）
      - `retryFromFail()` 内の set
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：なし
  - 完了条件：
    - 戦闘画面起動直後 `useBattleStore.getState().speedMultiplier === 1`
    - `useBattleStore.getState().toggleSpeedMultiplier()` 1 回呼ぶと 2、2 回呼ぶと 1 に戻る
    - 勝利・敗北・retry・マップ戻り経由で必ず 1 に戻ることを DevTools で確認
    - Lint / 型チェックがパスする
    - 既存の戦闘進行・勝利演出・敗北演出に挙動の変化がない（この時点ではまだ倍率が時間に適用されていないので何も速くならない）

- [x] **2. `startExecution` 内の `setTimeout` 遅延と `currentPhaseMs` set を倍率適用に書き換える**  ✓ 完了
  - 内容：
    - `scheduleNodePhase(nodeId, delay)` 内の `setTimeout(callback, delay)` を `setTimeout(callback, delay / get().speedMultiplier)` に変更
    - `scheduleEdgePhase(edge, delay)` 内の同様の `setTimeout` も同じく書き換え
    - `scheduleComplete(delay)` 内の `setTimeout` も同じく書き換え
    - 同じ schedule 関数内で `set({...currentPhaseMs: NODE_PHASE_MS, ...})` のように `currentPhaseMs` を set している箇所すべてを `currentPhaseMs: NODE_PHASE_MS / get().speedMultiplier`（または `EDGE_PHASE_MS / get().speedMultiplier`）に書き換え
    - `currentPhaseMs` の更新は `get().speedMultiplier` を **set 時点で読む**（クロージャでキャプチャしない）ことで「次のフェーズから倍率適用」セマンティクスを保つ
    - `TRANSITION_DURATION_MS`（拡大トランジション待機）は **触らない**（実行開始前の演出なので倍率対象外）
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク1（`speedMultiplier` state が存在することが前提）
  - 完了条件：
    - DevTools で `speedMultiplier = 2` を手動 set した状態で実行すると、エッジ進行のドット移動・ノードのハイライト時間が体感で半分になる
    - 実行途中に DevTools で `speedMultiplier` を 1 ↔ 2 に切り替えると、**現在進行中のフェーズは速さが変わらず、次のエッジ/ノードから新速度** で進む（「途中で時間が縮む」現象が起きないこと）
    - 既存の `cancelExecutionTimers`、失敗ガード（`failPhase !== null` チェック）、勝敗判定は変わらず動作する
    - Lint / 型チェックがパスする
    - **この時点では CSS animation はまだ通常速度** なので、ノードハイライト（0.3s）と DamageFloater（0.8s）は速くならない。タスク5 で揃える

- [x] **3. `SpeedToggleButton.jsx` と `SpeedToggleButton.module.css` を新規作成**  ✓ 完了
  - 内容：
    - 新規ファイル `frontend/src/features/battle/flowchart/SpeedToggleButton.jsx` を作成
    - JSX 構造：
      ```jsx
      <button
        type="button"
        className={isFast ? `${styles.button} ${styles.active}` : styles.button}
        onClick={toggleSpeedMultiplier}
        disabled={!isExecuting}
        aria-label="2倍速切替"
        aria-pressed={isFast}
      >
        &gt;&gt;
      </button>
      ```
    - 購読する store 値：`isExecuting`、`speedMultiplier`、`toggleSpeedMultiplier`
    - `isFast = speedMultiplier === 2`（または `speedMultiplier !== 1` の方が将来拡張向き）
    - 新規ファイル `frontend/src/features/battle/flowchart/SpeedToggleButton.module.css` を作成
    - CSS は `ZoomButton.module.css` のスタイル（背景 `#1f1f28`、文字 `#e5e5ff`、角丸 `4px`、padding `0.35rem 0.6rem`、`:hover:not(:disabled)`、`:active:not(:disabled)`、`:disabled` のパターン）をベースにする
    - 新規セレクタ `.button.active` を追加：`opacity: 0.5;`（オン中の薄表示、要件1-4）
    - docstring 等のコメントは Claude が後で `Edit` で直接書き込む（teaching モード規約）
  - ファイル：`frontend/src/features/battle/flowchart/SpeedToggleButton.jsx`（新規）、`frontend/src/features/battle/flowchart/SpeedToggleButton.module.css`（新規）
  - 依存：タスク1（`speedMultiplier` / `toggleSpeedMultiplier` の store が前提）
  - 完了条件：
    - 単体としてのコンポーネントが import 可能（次のタスク4 で配置する前提）
    - `aria-label` と `aria-pressed` が正しく設定されている
    - `.button.active` で薄表示（opacity 0.5）の見た目になる（実機確認は次のタスク以降）
    - Lint / 型チェックがパスする

- [x] **4. `BattleScreen.jsx` で `SpeedToggleButton` を配置し、CSS variable `--speed-mult` を root に同期**  ✓ 完了
  - 内容：
    - `BattleScreen.jsx` の import に `import SpeedToggleButton from './flowchart/SpeedToggleButton';` を追加
    - `.flowchartControls` 内、`.topRow` の `<div>` 直後（旧 `PlayButton` の位置）に `<SpeedToggleButton />` を追加：
      ```jsx
      <div className={styles.flowchartControls}>
        <div className={styles.topRow}>
          <ZoomButton />
          <ResetButton stage={stage} />
        </div>
        <SpeedToggleButton />
      </div>
      ```
    - CSS variable 同期：
      - `BattleScreen` 関数本体の冒頭付近で `useRef`/`useEffect` を使う
      - `const rootRef = useRef(null);`
      - `const speedMultiplier = useBattleStore((s) => s.speedMultiplier);`
      - `useEffect(() => { if (rootRef.current) { rootRef.current.style.setProperty('--speed-mult', String(speedMultiplier)); } }, [speedMultiplier]);`
      - return 内の `<section className={rootClassName}>` を `<section ref={rootRef} className={rootClassName}>` に変更
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`
  - 依存：タスク3（`SpeedToggleButton` の存在が前提）
  - 完了条件：
    - 戦闘画面右上、`.topRow` の下に `>>` ボタンが表示される（旧 PlayButton の位置）
    - 実行中以外は disabled（半透明、`cursor: not-allowed`）
    - 実行中はクリック可能で、押すと薄く（active）になる
    - もう一度押すと元に戻る
    - DevTools の `.root` 要素の Computed Styles で `--speed-mult` が `1` または `2` に同期されているのを確認
    - **この時点では CSS animation はまだ通常速度のままで、JS タイマー側だけ倍速** で動く（混在状態を確認、タスク5 で揃える）
    - Lint / 型チェックがパスする

- [x] **5. 対象 CSS animation の `animation-duration` を `calc(<base> / var(--speed-mult, 1))` に書き換える**  ✓ 完了
  - 内容：以下の 16 個の animation について、`animation` shorthand の duration 部分（または `animation-duration` 個別プロパティ）を `calc(<旧 duration> / var(--speed-mult, 1))` に変更
    - `SlotNode.module.css` の `.slot.active` (`slotHighlight` 0.3s)
    - `SlotNode.module.css` の `.slot.counterFlash` (`counterFlash` 0.36s)
    - `StartNode.module.css` の `.marker.active` (`startGoalHighlight` 0.3s)
    - `GoalNode.module.css` の `.marker.active` (`startGoalHighlight` 0.3s)
    - `ConditionNode.module.css` の `.diamond.active` (`conditionHighlight` 0.3s)
    - `MergeNode.module.css` の `.circle.active` (`mergeHighlight` 0.3s)
    - `BattleScreen.module.css` の `.enemyHpBox.hit` (`hpBoxHit` 0.3s)
    - `BattleScreen.module.css` の `.playerHpBox.hit` (`hpBoxShakeX` 0.3s + `hpBoxDamageGlow` 0.5s、両方とも書き換え)
    - `BattleScreen.module.css` の `.playerHpBox.healed` (`hpBoxHealGlow` 0.5s)
    - `BattleScreen.module.css` の `.playerHpBox.shielded` (`hpBoxShielded` 500ms)
    - `BattleScreen.module.css` の `.enemyHpBox.shakenVert` (`hpBoxShakeVert` 300ms)
    - `BattleScreen.module.css` の `.playerHpBox.shakenVert` (`hpBoxShakeVert` 0.3s + `hpBoxReflectGlow` 0.5s、両方とも書き換え)
    - `DamageFloater.module.css` の `damageFloat` 0.8s
    - `PlayerDamageFloater.module.css` の `damageFloat` 0.8s
    - `ReflectDamageFloater.module.css` の `reflectFloat` 0.8s
    - 書き換え例：
      ```css
      /* 旧 */
      animation: slotHighlight 0.3s ease-in-out 2 alternate;
      /* 新 */
      animation: slotHighlight calc(0.3s / var(--speed-mult, 1)) ease-in-out 2 alternate;
      ```
    - **触らない**: 
      - `VictoryClearOverlay` 関連の animation（勝利演出は通常速度のまま、要件4-6）
      - `BattleFailOverlay` 関連の animation（敗北演出は通常速度のまま、要件4-7）
      - `AnimatedProgressEdge.module.css` 全般（ドット移動・線描画は JS の `currentPhaseMs` で既にスケール済み、CSS variable 経由ではない）
    - 各 CSS rule のコメントを必要に応じて更新（speed-mult 経由でスケールされる旨を一言追記。本仕様規約により Claude が `Edit` で直接書き込む）
  - ファイル：
    - `frontend/src/features/battle/flowchart/SlotNode.module.css`
    - `frontend/src/features/battle/flowchart/StartNode.module.css`
    - `frontend/src/features/battle/flowchart/GoalNode.module.css`
    - `frontend/src/features/battle/flowchart/ConditionNode.module.css`
    - `frontend/src/features/battle/flowchart/MergeNode.module.css`
    - `frontend/src/features/battle/BattleScreen.module.css`
    - `frontend/src/features/battle/enemy/DamageFloater.module.css`
    - `frontend/src/features/battle/enemy/ReflectDamageFloater.module.css`
    - `frontend/src/features/battle/player/PlayerDamageFloater.module.css`
  - 依存：タスク4（`--speed-mult` が root に同期されていることが前提。デフォルト値 `1` でフォールバックするので、もしタスク4 が未実装でも CSS は壊れないが、検証のためにはタスク4 が必要）
  - 完了条件：
    - 倍速トグルオン中、実行すると：エッジ進行（タスク2 で達成済）・ノードハイライト・HP バー演出・DamageFloater すべてが 50% の所要時間になり、テンポが揃って速くなる
    - 倍速トグルオフ（1x）に戻すと通常テンポに戻る
    - 勝利演出（VictoryClearOverlay）と敗北演出（BattleFailOverlay）は **速くならない**（要件4-6, 4-7）
    - DevTools で `--speed-mult` を手動で 3 や 4 に変更すると、対象 animation がさらに速くなる（拡張性の確認）
    - Lint / 型チェックがパスする
    - リポジトリ全体の戦闘画面動作が通常時（1x）と完全に等価に見える（regression なし）

## トレーサビリティ（要件 → タスク）

| 要件 | カバーするタスク |
|---|---|
| 1: ボタンの配置と外観 | タスク3（SpeedToggleButton 作成）、タスク4（配置） |
| 2: 押下可能タイミング | タスク3（`disabled={!isExecuting}`） |
| 3: トグル機構と倍率の適用 | タスク1（toggleSpeedMultiplier action）、タスク2（setTimeout/currentPhaseMs 倍率適用） |
| 4: 倍率適用範囲 | タスク2（JS タイマー・currentPhaseMs）、タスク5（CSS animation 16 個） |
| 5: 実行終了時のリセット | タスク1（リセット経路の整備、5 経路すべて） |
| 6: 将来拡張可能な構造 | タスク1（`SPEED_MULTIPLIERS` 配列、number 保持）、タスク5（`calc(<base> / var())` の一般化された式） |
| 7: アクセシビリティと非干渉 | タスク3（`aria-label`/`aria-pressed`/`<button>` 標準挙動）、タスク2 と タスク5（時間だけ変えて実行ロジック自体は無変更） |

全7要件がタスク1〜5 のいずれかでカバーされます。孤立した要件はありません。

## クリティカルパス

```
タスク1 (battleStore: speedMultiplier state + toggle action + リセット経路)
       ↓
タスク2 (startExecution: setTimeout/currentPhaseMs 倍率適用)
       ↓
タスク3 (SpeedToggleButton 単体作成: .jsx + .module.css)
       ↓
タスク4 (BattleScreen: 配置 + CSS variable 同期)
       ↓
タスク5 (CSS animation 16 個を calc() で書き換え)
```

中間状態：
- **タスク2 完了時点**：DevTools で `speedMultiplier` を手動で 2 に set すれば、JS タイマー側だけ 2 倍速（エッジ進行は速くなるが、ノードハイライト・HP 演出は通常速度）。混在状態
- **タスク4 完了時点**：ボタンから倍速切替可能、JS 側は 2 倍速、CSS animation は通常速度（混在）
- **タスク5 完了時点**：JS と CSS が揃って 2 倍速、テンポが完全同期

## 実装の注意点

- **タスク1 のリセット経路の網羅**：`failPhase: 'shown'` を set している箇所は **複数ある**（HP=0 経路、runaway 検知、LOOP_MAX_VISITS 超過、最終 `scheduleComplete`）。grep で `failPhase:.*'shown'` を網羅して、それぞれの set に `speedMultiplier: 1` を加える必要がある。
- **タスク2 の「クロージャでキャプチャしない」**：`set()` 内で `currentPhaseMs: NODE_PHASE_MS / get().speedMultiplier` のように **set 時点で `get()` を呼ぶ** こと。例えば `const m = get().speedMultiplier;` を schedule 関数の冒頭でキャプチャしてしまうと、ユーザーがトグルしても次のフェーズに反映されない。
- **タスク3 の SVG ファイル不要**：アイコンはテキスト `>>`（HTML エスケープで `&gt;&gt;` または JSX 文字列で `'>>'`）。ZoomButton と整合する。
- **タスク4 の `ref` 付与位置**：`<section className={rootClassName} ref={rootRef}>` の **`ref` は `className` のすぐ隣** に置く。BattleScreen の return 文の最上位 `<section>` 要素 1 箇所だけ。
- **タスク5 の `calc()` 構文**：`calc(0.3s / var(--speed-mult, 1))` のように **空白を入れる**（`/` の前後）。空白がないと CSS パーサーが解釈を間違う場合がある。
- **タスク5 で「触らない」アニメ**：`AnimatedProgressEdge.module.css` の `.drawingPath` と `@keyframes drawPath` は **JS の `currentPhaseMs` 経由でスケール済み**なので CSS variable を入れる必要はない。むしろ入れると二重スケールになるので注意。
- **テスト生成物を残さない**：Playwright MCP 等のスクリーンショット・ログはリポジトリに含めない（CLAUDE.md 規約）。
