# タスク一覧: 敵のスプライトアニメーション描画

## 概要

依存の無い末端モジュール（データ・ユーティリティ・フック）を先に作り、それらを組み合わせる `EnemySprite` を作成、最後に `BattleScreen` へ繋ぎ込んでブラウザで目視確認する流れ。クリティカルパスは **タスク3 → 4 → 6 → 7**（フック → コンポーネント → 統合 → 動作確認）。タスク1・2・5は独立しており並行して進めてよい。

合計タスク数：7件 ｜ 想定工数：約 6〜8時間

## タスク

- [x] **1. 敵定義 JSON の作成**  ✓ 完了
  - 内容：敵 ID・表示名・状態別アニメーション定義を持つ `enemies.json` を作成する。スライムの `idle` 状態のみ定義（6フレーム、150ms、ループ）。
  - ファイル：`frontend/src/data/enemies.json`
  - 依存：なし
  - 完了条件：`enemies.json` に `{ "enemies": [{ "id": "slime", "displayName": "スライム", "animations": { "idle": { "frameCount": 6, "frameDurationMs": 150, "loop": true } } }] }` 形式のデータが格納されており、`import` してパースできる。

- [x] **2. スプライトパス解決ユーティリティ**  ✓ 完了
  - 内容：`getEnemyFramePath(enemyId, state, frameIndex)` を純粋関数として実装する。戻り値は `/sprites/enemies/<id>/<state>/<id>_<state>_<NN>.png`（`NN` は 2 桁ゼロ埋め）。Google docstring を付与。
  - ファイル：`frontend/src/features/battle/enemy/enemySpritePath.js`
  - 依存：なし
  - 完了条件：`getEnemyFramePath("slime", "idle", 0)` が `"/sprites/enemies/slime/idle/slime_idle_00.png"` を返す。`frameIndex=5` で `"..._05.png"` になる。命名規則の組み立てロジックがこの関数のみに存在する。

- [x] **3. アニメーションフックの実装**  ✓ 完了
  - 内容：`useSpriteAnimation({ frameCount, frameDurationMs, loop })` カスタムフックを実装。`setInterval` で `frameIndex` を進め、`loop: true` なら `% frameCount`、`loop: false` なら最終フレームで停止。`useEffect` のクリーンアップで `clearInterval`。props 変更時はタイマー再起動。Google docstring を付与。
  - ファイル：`frontend/src/features/battle/enemy/useSpriteAnimation.js`
  - 依存：なし
  - 完了条件：フック単体を仮のコンポーネントから呼んで、`frameIndex` が指定間隔で 0→5→0→… と循環することをコンソールログ等で確認できる。strict mode 下でも `setInterval` が重複しない。

- [x] **4. `EnemySprite` コンポーネントの実装**  ✓ 完了
  - 内容：`enemies.json` から `{enemyId, state}` に対応する定義を引き、`useSpriteAnimation` に渡してフレーム index を取得、`getEnemyFramePath` で URL を組み立てて `<img>` で描画する。マウント時に対象状態の全フレームを `new Image()` でプリロード。定義が見つからない場合は `null` を返す。CSS Modules で原寸表示（`max-width: none`）、親エリアの中央に配置。Google docstring を付与。
  - ファイル：
    - `frontend/src/features/battle/enemy/EnemySprite.jsx`
    - `frontend/src/features/battle/enemy/EnemySprite.module.css`
  - 依存：タスク1・2・3
  - 完了条件：`<EnemySprite enemyId="slime" state="idle" />` をサンプル表示すると、6 枚のフレームがループ再生される。未定義の `enemyId` を渡してもコンポーネントがクラッシュせず `null` が返る。

- [x] **5. `stages.json` に `enemyId` フィールド追加**  ✓ 完了
  - 内容：`stage-00` に `"enemyId": "slime"` を追加する。既存の `slots` / `edges` には手を加えない。
  - ファイル：`frontend/src/data/stages.json`
  - 依存：なし
  - 完了条件：`stages[0].enemyId === "slime"` が読み取れる。

- [x] **6. `BattleScreen` への組み込み**  ✓ 完了
  - 内容：`[敵エリア] テストエネミー` のプレースホルダを削除し、`<EnemySprite enemyId={stage.enemyId} state="idle" />` に置換する。既存コンポーネントの docstring も実態に合わせて更新（「プレースホルダ表示」の記述を削除）。
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`
  - 依存：タスク4・5
  - 完了条件：戦闘画面上部エリアに `EnemySprite` が描画され、スライム画像が中央でループ再生される。

- [x] **7. ドキュメント更新と動作確認**  ✓ 完了
  - 内容：`README.md` のディレクトリ構造図に `src/features/battle/enemy/` と `src/data/enemies.json` を追記する（CLAUDE.md のディレクトリ運用ルール）。`npm run dev` でブラウザを起動し、上部エリア中央でスライムがアニメーションすること、他のレイアウト（フローチャート・HP・カード）に影響が無いことを目視確認する。`npm run lint` がエラー無く通ることも確認。
  - ファイル：`README.md`
  - 依存：タスク6
  - 完了条件：
    - README のディレクトリ構造に新規ファイルが反映されている
    - ブラウザで `http://localhost:5173` を開きスライムが 6 フレームループしている
    - コンソールにエラー・警告が出ていない
    - lint エラーが無い

## 要件トレーサビリティ

| 要件 | 対応タスク |
|---|---|
| 1-1 上部中央に1体描画 | 4, 6 |
| 1-2 原寸描画 | 4（CSS で `max-width: none`） |
| 1-3 レイアウト崩れ防止 | 4（`null` フォールバック）, 7（目視） |
| 2-1 自動再生 | 3, 4 |
| 2-2 一定間隔切り替え | 3 |
| 2-3 ループ | 3 |
| 2-4 再生継続 | 3（アンマウントまで止めない） |
| 3-1 ID・状態で解決 | 1, 4 |
| 3-2 フレーム数可変 | 1, 3 |
| 3-3 データ管理 | 1 |
| 4-1 状態キーでの切替 | 1, 4 |
| 4-2 呼び出し側変更不要で拡張 | 4（状態キー非依存の実装） |
| 4-3 今回は idle のみ | 1 |
| 5-1 ディレクトリ規則 | （既存、要件段階で完了） |
| 5-2 ファイル命名 | 2（唯一の命名ロジック） |
| 5-3 ゼロ埋め | 2 |
| 5-4 README 同期 | 7 |
