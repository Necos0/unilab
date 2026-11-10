# タスク一覧: クリア者一覧 ＋ 本人クリア時の祝福演出

## 概要

下から：全件取得 API →一覧画面（会場用CSS流用）→タイトル導線（App分岐＋ボタン）→本人クリア時の祝福演出→検証。会場用 `/screen`（`ClearScreen`）は不変。クリティカルパスは 1→2→3。要件7（4）は独立。

合計タスク数：5件 ｜ 想定工数：約4〜6時間

パス基準：`frontend/src/`

## タスク

- [ ] **1. 全件取得 API `fetchAllClears`（`services/clearRecordApi.js`）**
  - 内容：`fetchAllClears(limit = 1000)` を追加。`fetchTodayClears` と同型で、今日フィルタの代わりに `.not('cleared_at', 'is', null)`＋`.order('cleared_at', { ascending: true })`＋`.limit(limit)`。未設定時は従来どおり throw。既存関数は不変。
  - ファイル：`services/clearRecordApi.js`
  - 依存：なし
  - 完了条件：lint通過。`fetchAllClears` が `{id,nickname,started_at,cleared_at}[]` を返す形（接続有時）。`fetchTodayClears`/`subscribeClears` は不変。
  - 対応要件：5

- [ ] **2. 一覧画面 `ClearListScreen`（`features/screen/ClearListScreen.jsx`＋`.module.css`）**
  - 内容：会場用 `ClearScreen.module.css`＋`RankBadge`＋`formatClearTime` を流用して行の見た目を一致させる新規画面。マウントで `isClearRecordEnabled()` 判定→`fetchAllClears()` を1回取得。状態 `loading/ready/error/disabled`。「ぜんぶ／今日だけ」トグル（既定ぜんぶ。今日は `getTodayStart` でクライアント絞り）。表示集合を経過昇順にソートして順位付け。**手動スクロール枠**（`overflow-y:auto`、自動スクロールなし）。ヘッダに「← もどる」（`onBack`）。準備中/空/エラーの文言表示（ふりがな方針）。
  - ファイル：`features/screen/ClearListScreen.jsx`（新規）、`features/screen/ClearListScreen.module.css`（新規・ヘッダ/スクロール枠のみ）、流用：`ClearScreen.module.css`・`RankBadge`・`formatClearTime`・`clearRecordApi`
  - 依存：1
  - 完了条件：全件がタイム速い順で手動スクロール表示。トグルで今日分に絞れる。未設定時「じゅんびちゅう」、0件「まだ クリアした人が いないよ」、失敗「よみこみに しっぱいしました」。会場用 `ClearScreen`/`/screen` は不変。
  - 対応要件：2, 3, 4, 5, 6

- [ ] **3. タイトル導線（`App.jsx`＋`features/title/TitleScreen.jsx`）**
  - 内容：`App` に `screen === 'clearlist'` 分岐（`<ClearListScreen onBack={() => setScreen('title')} />`）と `handleShowClearList = () => setScreen('clearlist')` を追加し、`TitleScreen` に `onShowClearList` を渡す。`TitleScreen` は「つづきの ぼうけんへ」ボタンの**直後**に「クリア者一覧」ボタン（常時表示・同サイズ）を追加。
  - ファイル：`App.jsx`、`features/title/TitleScreen.jsx`
  - 依存：2
  - 完了条件：タイトルの「クリア者一覧」で一覧へ、「もどる」でタイトルへ戻る。ボタンは `canPlayWorld5` に関係なく常時表示。
  - 対応要件：1

- [ ] **4. 本人クリア時の祝福演出（`App.jsx`）**
  - 内容：`ClearCelebration` を App トップレベルに重ねる。状態 `clearCelebrateName`。`handleEpilogueFinish` を `markCleared(); setClearCelebrateName(playerName); setScreen('title');` に変更。レンダー末尾に `{clearCelebrateName && <ClearCelebration key=... clear={{nickname}} onFinish={()=>setClearCelebrateName(null)} />}`。記録の成否と独立。
  - ファイル：`App.jsx`、流用：`features/screen/ClearCelebration.jsx`・`stores/playerStore.js`
  - 依存：なし（3 と同じ App だが独立領域）
  - 完了条件：エピローグ完了（計測終了）で「クリア おめでとう！＋本人名＋紙ふぶき」が1回出て自動で閉じ、以降の遷移を妨げない。
  - 対応要件：7

- [ ] **5. 検証・build/lint**
  - 内容：変更/新規ファイルの `npx eslint`＋`npm run build`。実機確認は指示時のみ（`/screen` が不変であることも確認）。
  - ファイル：（検証のみ）
  - 依存：1〜4
  - 完了条件：build・lint パス。要件1〜7の受け入れ基準を満たす。
  - 対応要件：全

## トレーサビリティ（要件→タスク）

| 要件 | タスク |
|---|---|
| 1 タイトルのボタン | 3 |
| 2 全クリア者・手動スクロール | 2 |
| 3 行の表示（順位/名前/タイム） | 2 |
| 4 今日だけトグル | 2 |
| 5 取得・異常系 | 1, 2 |
| 6 /screen 不変 | 2（流用は読み取り専用） |
| 7 本人クリア時の祝福演出 | 4 |
