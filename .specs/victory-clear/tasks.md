# タスク一覧: 勝利時 CLEAR! 演出

## 概要

データ層（`enemies.json`）→ 状態層（`battleStore`）→ ビュー層（`EnemySprite` 拡張・新規 `VictoryClearOverlay`・`BattleScreen` 統合）→ ボタン無効化 → ドキュメント、の順で実装する。クリティカルパスはタスク 1〜2（基盤）→ タスク 3〜5（描画）。タスク 6 は他と独立。タスク 7 は最後の同期作業。

合計タスク数：7 件 ｜ 想定工数：4〜5 時間

## タスク

- [x] **1. enemies.json に dead アニメ定義を追加**  ✓ 完了
  - 内容：`knight` / `wolf` / `golem` の `animations` に `dead` エントリを追加する。`slime` には追加しない（暫定スキップ対象）。フレーム数はファイル実体に合わせて `knight: 5`、`wolf: 6`、`golem: 6`。`frameDurationMs: 250`、`loop: false`。
  - ファイル：`frontend/src/data/enemies.json`
  - 依存：なし
  - 完了条件：JSON が valid。`preloadBattleAssets` が新しい dead フレームの URL を自動収集する（`collectBattleAssetUrls` のループは `Object.entries(enemy.animations)` を回すため自動対応）。

- [x] **2. battleStore に victoryPhase 状態と勝利シーケンスアクションを追加**  ✓ 完了
  - 内容：
    - 初期状態に `victoryPhase: null` を追加。`initializeBattle` の `set` 内で `victoryPhase: null` を初期化（要件 7-1）。
    - 新アクション `startVictorySequence(enemyId)` を追加。`enemiesData` を引いて `dead` 定義の有無を判定し、ある場合は `'dead' → 'fading' → 'cleared'`、無い場合は `'fading' → 'cleared'` の `setTimeout` チェーンで遷移させる。フェード時間は新定数 `VICTORY_FADE_DURATION_MS = 500`。
    - `startExecution` の末尾 `setTimeout` 内で `get().currentEnemyHp === 0` を判定し、true なら `get().startVictorySequence(stage.enemyId)` を呼ぶ。
    - 既存の Google docstring 形式に倣い、新フィールド・新アクションに docstring を付与。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク 1（dead アニメ定義の存在を読み取るため）
  - 完了条件：`npm run lint` が pass。`startVictorySequence` を呼ぶと `victoryPhase` が `null → 'dead' → 'fading' → 'cleared'`（または dead 無しなら `null → 'fading' → 'cleared'`）の順に遷移する。`initializeBattle` で `null` に戻る。

- [x] **3. EnemySprite を victoryPhase 対応に拡張**  ✓ 完了
  - 内容：
    - `useBattleStore` で `victoryPhase` を購読。
    - 親 (`BattleScreen`) から渡される `state` プロップに加え、`victoryPhase` と `enemyId` の dead 定義有無を見て描画ステートを決める。具体的には、BattleScreen 側で `spriteState = (victoryPhase && hasDeadAnim) ? 'dead' : 'idle'` を計算して渡す方式。EnemySprite 自身は `state` プロップに従って描くだけにする（既存責務を維持）。
    - `<img>` に `victoryPhase === 'fading'` または `victoryPhase === 'cleared'` のとき `.fading` クラスを付与する。
    - `EnemySprite.module.css` に `.fading { opacity: 0; transition: opacity 0.5s ease-out; }` を追加。`.flashing` の演出と干渉しないよう `opacity` のみ扱う（`filter` には触れない）。
    - 既存の docstring を更新し、新挙動（victoryPhase 連動の透過）を 1 段落追記。
  - ファイル：`frontend/src/features/battle/enemy/EnemySprite.jsx`、`frontend/src/features/battle/enemy/EnemySprite.module.css`
  - 依存：タスク 2
  - 完了条件：`npm run lint` が pass。`victoryPhase === 'fading'` のとき `<img>` が opacity 0 へ 0.5 秒トランジションする。`victoryPhase === 'cleared'` のときは透明のまま固定。dead 定義有りの敵では `state="dead"` で 1 回再生される。

- [x] **4. VictoryClearOverlay コンポーネントを新規作成**  ✓ 完了
  - 内容：
    - `VictoryClearOverlay.jsx` を作成。`onExitToMap` プロップを受け取り、敵エリアに `position: absolute; inset: 0` で重なる div を描画。flex 縦分割で上半分に `<div className={styles.clearText}>CLEAR!</div>`、下半分に「マップへ戻る」ボタンを配置。
    - ボタンは右上版 `BackToMapButton` を再利用せず、本コンポーネント内に独自スタイルで描く（位置・サイズ・ボタン感が異なる）。`onClick={onExitToMap}` で同じハンドラを呼ぶ。
    - `VictoryClearOverlay.module.css` を作成。フォントは `'Press Start 2P', Courier, monospace`、CLEAR! サイズは `clamp(2rem, 6vw, 3rem)`、色は黄系 `#ffe27a`、`text-shadow: 2px 2px 0 #0b0b10` でドット縁取り。`pointer-events: auto` を `.overlay` に付与し、`.root.victory` の `none` 継承を打ち消す。`z-index: 15`（DamageFloater より上、右上 BackToMapButton (20) より下）。ボタンは右上 BackToMapButton と同等のダーク基調＋ピクセル感のあるスタイルにし、サイズは少し大きめ（`padding: 0.6rem 1.4rem` / `font-size: 1rem` 程度）。
    - Google docstring 形式でクラス・関数の説明を付与（既存ファイルに倣う）。
  - ファイル：`frontend/src/features/battle/VictoryClearOverlay.jsx`（新規）、`frontend/src/features/battle/VictoryClearOverlay.module.css`（新規）
  - 依存：タスク 2
  - 完了条件：`npm run lint` が pass。コンポーネント単体ではマウントしてもレイアウトを崩さない（親側の `position: relative` は既存の `.enemyArea` に既に付いている）。

- [x] **5. BattleScreen に VictoryClearOverlay と勝利ステート連動を組み込む**  ✓ 完了
  - 内容：
    - `victoryPhase` をストアから購読。
    - `enemiesData` を import し、対象敵の `animations.dead` 有無を `hasDeadAnim` として算出。
    - `EnemySprite` に渡す `state` を `victoryPhase && hasDeadAnim ? 'dead' : 'idle'` で算出して渡す。
    - `<BackToMapButton>` を `victoryPhase !== 'cleared'` のときだけ条件付きレンダー。
    - `.enemyArea` の子として `{victoryPhase === 'cleared' && <VictoryClearOverlay onExitToMap={onExitToMap} />}` を追加。`DamageFloater` の後に置く（z-index で上にする）。
    - `rootClassName` 計算に `victoryPhase && styles.victory` を追加して `.root.victory` を付与。
    - `BattleScreen.module.css` に `.root.victory { pointer-events: none; }` を追加。コメントで `.executing` と同様の趣旨であることを明記。
    - 既存の `BattleScreen` クラス docstring を 1〜2 行追記し、勝利演出の組み込みを反映。
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`、`frontend/src/features/battle/BattleScreen.module.css`
  - 依存：タスク 3、タスク 4
  - 完了条件：`npm run lint` が pass。`npm run build` が成功する。`victoryPhase === 'cleared'` のとき右上 BackToMapButton が消え、敵エリアに CLEAR! オーバーレイが現れる。`.root.victory` 中はカードのドラッグや他ボタンが反応しない（オーバーレイのボタンだけ反応する）。

- [x] **6. PlayButton / ResetButton / ZoomButton の無効化条件に victoryPhase を追加**  ✓ 完了
  - 内容：各ボタンコンポーネントが `useBattleStore` から `victoryPhase` を購読し、既存の `disabled` 条件に `|| victoryPhase !== null` を追加する。docstring の「無効化条件」段落を 1 行更新する。
  - ファイル：`frontend/src/features/battle/flowchart/PlayButton.jsx`、`frontend/src/features/battle/flowchart/ResetButton.jsx`、`frontend/src/features/battle/flowchart/ZoomButton.jsx`
  - 依存：タスク 2
  - 完了条件：`npm run lint` が pass。`victoryPhase` が非 null の間、3 ボタンとも `disabled={true}` になる（フォーカスやキーボード操作でも反応しない）。

- [x] **7. README.md のディレクトリ構造を更新**  ✓ 完了
  - 内容：`frontend/src/features/battle/` 配下のファイル一覧に `VictoryClearOverlay.jsx` と `VictoryClearOverlay.module.css` を追加。並びは既存の `BattleTransition.*` 直後など、関連の近い位置に置く。
  - ファイル：`README.md`
  - 依存：タスク 4
  - 完了条件：README の構造図と実ファイル配置が一致する（ファイル名・拡張子・並び順までずれが無い）。
