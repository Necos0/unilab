# タスク一覧: ガードバーの再設計（guard-bar-redesign）

## 概要

実装は (1) `HpBar` の簡素化と `icon` props 追加 → (2) `GuardBar` の新規作成 → (3) `battleStore` の `applyGuard` クランプ追加と `consumeShieldOnDamage` 遅延追加 → (4) `BattleScreen` のプレイヤー HUD 差し替え、の 4 タスクで進める。

タスク 1〜3 は依存関係なく並列着手可能（HpBar 改修、GuardBar 新規、battleStore 改修は互いに独立）。タスク 4 は 1 と 2 が揃わないと差し替えできず、3 も実行時の挙動確認に必要。クリティカルパスは「タスク 4 で実機確認」のため、1〜3 をできる限り並列で進めるとよい。

合計タスク数：4 件 ｜ 想定工数：約 2〜2.5 時間

## タスク

- [x] **1. `HpBar` を簡素化し `icon` props を追加する**  ✓ 完了
  - 内容：以下 2 ファイルを編集する。
    - **`HpBar.jsx`**：
      - `shield` props を撤去（受け取りも参照も削除）
      - `normalizedShield` / `total` / `shieldRatio` / `scale` の計算を削除し、`hpRatio = clampedHp / maxHp` に戻す
      - `<div className={styles.shield} ... />` の JSX 要素を削除
      - `style={{ '--shield-scale': scale }}` を削除
      - `icon` props（ReactNode, デフォルト `null`）を新設
      - 外側を `<div className={styles.row}>` で包み、`icon` を `.frame` の左に並べる（`icon == null` のときは描画しない）
      - JSDoc を新仕様に合わせて全面書き直し（既存 docstring の `shield` / `--shield-scale` 説明は teaching モードのルールに従い検証完了後に Claude が更新）
    - **`HpBar.module.css`**：
      - `.frame` の `width: calc(180px * var(--shield-scale, 1))` を `width: 180px` に戻す
      - `.frame` の `transition: width 0.25s ease-out` を削除（width が静的になるため不要）
      - `.shield` セレクタとその全プロパティを削除
      - `.row { display: flex; align-items: center; gap: 4px; }` を追加
      - `.icon { width: 14px; height: 14px; flex: 0 0 14px; }` を追加
  - ファイル：`frontend/src/components/HpBar.jsx`、`frontend/src/components/HpBar.module.css`
  - 依存：なし
  - 完了条件：(a) `HpBar` が新シグネチャ `({ currentHp, maxHp, reflectActive = false, icon = null })` でコンパイルエラーなく動作する。(b) 敵 HP バー（`<HpBar currentHp={...} maxHp={...} />` 呼び出し、`icon` 未指定）の見た目が従来通り（左アイコンなし、緑塗りのみ）。(c) `icon` props にダミー JSX を渡すと左側に表示される（タスク 4 で検証）。
  - 対応要件：要件 1-4（HP バー左アイコン）、要件 1-6（HP バー右側ガード延長撤去）、要件 6-3（マップ 1 後方互換、敵 HP バー無変更）

- [x] **2. `GuardBar` コンポーネントを新規作成する**  ✓ 完了
  - 内容：以下 2 ファイルを新規作成する。
    - **`GuardBar.jsx`**：
      - props は `({ current, max })`。`max <= 0` または `max == null` のときは `null` を返す（HpBar と同じガード規約）
      - `clampedCurrent = Math.max(0, Math.min(max, current))`、`ratio = clampedCurrent / max`
      - 外側 `<div className={styles.row}>` 内に盾 SVG（`.icon`）と `<div className={styles.frame}>` を並べる
      - `.frame` 内に `<div className={styles.fill} style={{ width: ratio * 100 + '%' }} />`
      - 盾 SVG は `<rect>` ベース（設計書「アイコン SVG」セクションの形状を採用）、`fill="#4a8ef0"`、`shapeRendering="crispEdges"`、`viewBox="0 0 14 14"`
      - `clampedCurrent === 0` でも `.frame` を必ず描画する（要件 1-5）
      - JSDoc を Google スタイルで記述（teaching モード上、検証完了後に Claude が追記）
    - **`GuardBar.module.css`**：
      - `.row` / `.icon` / `.frame` の値は HpBar.module.css と完全に揃える（180×14px、3px 白枠、`#0b0b10` 背景、`box-sizing: content-box`、`image-rendering: pixelated`）
      - `.fill` の `background: #4a8ef0`、`box-shadow: 0 0 6px rgba(120, 180, 255, 0.5)`（既存 `.shield` のグロー演出を流用）
      - `.fill` の `transition: width 0.25s ease-out`（HpBar と完全一致、遅延同期のため）
  - ファイル：`frontend/src/components/GuardBar.jsx`（新規）、`frontend/src/components/GuardBar.module.css`（新規）
  - 依存：なし（独立、タスク 1 と並列可能）
  - 完了条件：単体ではテストしにくいが、タスク 4 完了後に「`<GuardBar current={50} max={100} />` で青塗りが 50% の幅で描画される」「`current=0` でも空のバー枠が表示される」「左に小さな盾アイコンがある」状態になる。
  - 対応要件：要件 1-1（HP 真上に表示）、要件 1-2（同サイズ）、要件 1-3（盾アイコン）、要件 1-5（空時も常時表示）、要件 2-1〜2-3（`maxPlayerHp` 連動）、要件 5-2（盾 SVG）、要件 5-3（バー高さに収まる）

- [x] **3. `battleStore` の `applyGuard` クランプと `consumeShieldOnDamage` 遅延を追加する**  ✓ 完了
  - 内容：`battleStore.js` を以下 3 点で変更する。
    1. **モジュールスコープに定数を追加**: 既存の `NODE_PHASE_MS` の隣（モジュール冒頭の定数群）に `const GUARD_TO_HP_DELAY_MS = 250;` を追加。
    2. **`applyGuard` を関数形式 `set` に変更してクランプを掛ける**:
       ```js
       applyGuard: (amount) => set((state) => ({
         guardShield: Math.min(amount, state.maxPlayerHp),
         reflectActive: false,
       })),
       ```
       `reflectActive: false` は既存 mutex を維持（要件 7-1）。
    3. **`consumeShieldOnDamage` の HP 減算を `setTimeout` で遅延**:
       ```js
       consumeShieldOnDamage: (amount) => {
         const shield = get().guardShield;
         if (shield > 0) {
           const absorbed = Math.min(shield, amount);
           const remaining = amount - absorbed;
           set({ guardShield: shield - absorbed });
           if (remaining > 0) {
             const tid = setTimeout(() => {
               if (get().failPhase !== null) return;
               get().applyPlayerDamage(remaining);
             }, GUARD_TO_HP_DELAY_MS);
             executionTimers.push(tid);
           }
         } else {
           get().applyPlayerDamage(amount);
         }
       },
       ```
       `executionTimers.push(tid)` で既存の中断機構と統合する（`cancelExecutionTimers` でクリアされる）。`failPhase !== null` ガードで Fail 中の暴走を防ぐ。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：なし（独立、タスク 1, 2 と並列可能）
  - 完了条件：(a) `applyGuard(200)` を `maxPlayerHp = 100` の状態で呼ぶと `guardShield === 100` になる（DevTools コンソールで `useBattleStore.getState()` を確認）。(b) `applyGuard(50)` の後、`applyGuard(20)` を呼ぶと `guardShield === 20`（上書き動作）。(c) `consumeShieldOnDamage` が呼ばれて両方消費する場合、ガード減少と HP 減少の間に 250ms の間が空く（タスク 4 完了後に実機で目視確認）。(d) リトライ時の `cancelExecutionTimers` でガード遅延タイマーがクリアされる（タスク 4 完了後に「ガード吸収中に Fail」シナリオで確認）。
  - 対応要件：要件 3-2（クランプ）、要件 4-5/4-6（段階遅延）、要件 7-1（mutex 既存維持）、要件 6-5（リトライ時の `guardShield` リセット）

- [x] **4. `BattleScreen` のプレイヤー HUD を 2 段バースタックに差し替える**  ✓ 完了
  - 内容：以下 2 ファイルを変更する。
    - **`BattleScreen.jsx`**：
      - 冒頭の import 群に `import GuardBar from '../../components/GuardBar';` を追加
      - プレイヤー HUD 描画箇所（既存 line 404 周辺、`<HpBar ... shield={guardShield} reflectActive={reflectActive} />` の部分）を以下に置き換える：
        ```jsx
        <div className={styles.playerStatusBars}>
          <GuardBar current={guardShield} max={maxPlayerHp} />
          <HpBar
            currentHp={currentPlayerHp}
            maxHp={maxPlayerHp}
            reflectActive={reflectActive}
            icon={<CrossIcon />}
          />
        </div>
        ```
      - `CrossIcon` 関数コンポーネントをこのファイル内（または `HpBar.jsx` 内）に定義（設計書「アイコン SVG / 十字」の形状を採用）
      - HP 数値表示の `<span>` ブロックは旧仕様（合算分子 + 条件付きクラス）を維持する。GuardBar 自身は塗り幅で表示するが、テキスト側でも合算値を出すことでプレイヤーは具体的な数値も読み取れる（要件 8）。
        ```jsx
        <span className={styles.hpText}>
          <span
            className={guardShield > 0
              ? styles.hpNumeratorShielded
              : reflectActive
                ? styles.hpNumeratorReflect
                : undefined}>
            {currentPlayerHp + guardShield}
          </span>
          /{maxPlayerHp}
        </span>
        ```
      - 既存 `prevGuardShieldRef` 周辺の「ガード付与時のフィードバック処理」は維持する（要件 3-3 のバー塗り幅変化に併せて発火する想定の演出があるなら、新仕様でも同じトリガで動く）
    - **`BattleScreen.module.css`**：
      - `.hpNumeratorShielded` セレクタを維持し、`color: #4a8ef0`（GuardBar の `.fill` 背景色と同じ）で青色化（要件 8-2）
      - `.hpNumeratorReflect` セレクタを維持し、`color: #ff8c42`（HpBar の `.fill.reflect` 背景色と同じ）でオレンジ化（要件 8-3）
      - `.playerStatusBars { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }` を追加（必要なら `width` 指定で枠サイズを合わせる）
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`、`frontend/src/features/battle/BattleScreen.module.css`
  - 依存：タスク 1（新 HpBar インターフェース）、タスク 2（GuardBar）。タスク 3 は描画には不要だが実行時の段階遅延挙動の確認に必要
  - 完了条件：(a) アプリ起動 → ステージ 2-1 などガードカードのあるステージに進入し、フローチャートを実行。(b) HP バーの真上に同サイズの空ガードバーが表示されている（青塗りなし、外枠と左の盾アイコンのみ）。(c) HP バー左に小さな白い十字アイコン、Guard バー左に小さな青い盾アイコン。(d) guard カード（power=10）を通過するとガードバーが 10/100 相当の幅まで青く塗られる。(e) 続けて敵モンスター攻撃（power=20）を受けると、まずガードバーが 10 → 0 に減少し、約 250ms 後に HP バーが 100 → 90 に減少する（2 段階アニメーション）。(f) マップ 1 のステージ（1-1〜1-4）でも敵 HP バーが従来通り表示される。(g) Fail 発生 → やり直すボタンで `guardShield` が 0 にリセットされ、空のガードバーに戻る。
  - 対応要件：要件 1-1〜1-6（バー配置・アイコン・常時表示）、要件 4-4〜4-6（段階遅延の視覚効果）、要件 6-3〜6-5（既存ステージ・リトライへの非破壊性）、要件 8-1〜8-4（HP 数値テキストの合算分子 + 条件付き色付け）

## トレーサビリティ確認

| 要件 | 対応タスク |
|---|---|
| 1-1（HP 真上に Guard バー） | タスク 2、タスク 4 |
| 1-2（HP と同サイズ） | タスク 2（CSS を HpBar と完全一致） |
| 1-3（盾アイコン） | タスク 2（SVG 埋め込み） |
| 1-4（十字アイコン） | タスク 1（`icon` props 受口）、タスク 4（`<CrossIcon />` 注入） |
| 1-5（空時も常時表示） | タスク 2（`current=0` でも `.frame` 描画） |
| 1-6（HP バー右側ガード延長撤去） | タスク 1（`.shield` 撤去） |
| 2-1〜2-3（最大値 = `maxPlayerHp`） | タスク 4（`max={maxPlayerHp}` 渡し）、タスク 2（`current/max` 比率計算） |
| 3-1（上書きセット、既存挙動維持） | タスク 3（`applyGuard` を `set` 関数形式に） |
| 3-2（`maxPlayerHp` クランプ） | タスク 3（`Math.min(amount, state.maxPlayerHp)`） |
| 3-3（バー幅トランジション） | タスク 2（CSS transition） |
| 3-4（連続通過で最後の値が残る） | タスク 3（既存 `applyGuard` の上書きを維持） |
| 4-1〜4-3（吸収優先順位） | タスク 3（既存 `consumeShieldOnDamage` ロジック維持） |
| 4-4（即時視覚反映） | タスク 3（`set({ guardShield: ... })` 同期反映） |
| 4-5/4-6（段階遅延） | タスク 3（`setTimeout(GUARD_TO_HP_DELAY_MS)`） |
| 5-1（十字 SVG） | タスク 4（`CrossIcon` 定義） |
| 5-2（盾 SVG） | タスク 2（GuardBar 内に埋め込み） |
| 5-3（バー高さに収まるサイズ） | タスク 1, 2（`.icon { width: 14px; height: 14px }`） |
| 5-4（カラーパレット統一） | タスク 1（白系十字）、タスク 2（青系盾） |
| 6-1（heal カード無影響） | コード変更なし、既存挙動維持 |
| 6-2（reflect カード無影響） | タスク 3（`applyReflect` 触らず）、タスク 1（HpBar の reflect 表示は維持） |
| 6-3（マップ 1 動作） | タスク 1（敵 HP バー後方互換）、タスク 4（プレイヤー側のみ変更） |
| 6-4（ステージ 2-1 動作） | タスク 4 完了条件 (d), (e) |
| 6-5（リトライ時 `guardShield` リセット） | タスク 3（`executionTimers` push で `cancelExecutionTimers` 連携） |
| 7-1〜7-5（mutex、既存挙動維持） | タスク 3（`applyGuard` の `reflectActive: false` 維持）、既存実装の `applyReflect` / エッジ自動初期化を触らない |
| 8-1（分子の合算表示） | タスク 4（`{currentPlayerHp + guardShield}`） |
| 8-2（guard 時の青色化） | タスク 4（`.hpNumeratorShielded { color: #4a8ef0 }`） |
| 8-3（reflect 時のオレンジ化） | タスク 4（`.hpNumeratorReflect { color: #ff8c42 }`） |
| 8-4（デフォルト白色） | タスク 4（三項演算子の最終分岐が `undefined` でクラス未付与） |
| 8-5（mutex により同時着色なし） | 要件 7 の mutex に依拠 |
