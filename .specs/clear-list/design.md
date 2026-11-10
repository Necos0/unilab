# 設計書: クリア者一覧（タイトルから閲覧）＋ 本人クリア時の祝福演出

## 概要

タイトルから開ける**クリア者一覧画面**を新規追加する。見た目は会場用 `ClearScreen` と同じ（`ClearScreen.module.css`・`RankBadge`・`formatClearTime` を読み取り専用で流用）が、**自動スクロールせず手動スクロール**で、**全クリア者**（＋「今日だけ」トグル）を**タイム速い順**で並べる。会場用 `/screen` は不変。あわせて、プレイヤー本人がクリアした瞬間（`markCleared`／エピローグ完了）に、会場で出していた祝福演出（`ClearCelebration`）を本人画面にも1回出す。

主要な設計判断：
1. 会場用 `ClearScreen` は触らず、**新規 `ClearListScreen`** を作る。行の見た目は `ClearScreen.module.css` を import して完全一致させ、差分（手動スクロール枠・戻る/トグルのヘッダ）だけ小さな専用 CSS を足す。
2. 全件取得は `clearRecordApi` に**新規 `fetchAllClears`** を足す（既存 `fetchTodayClears` と同型、今日フィルタの代わりに `cleared_at` 非 null＋上限 1000）。「今日だけ」はクライアント側で `getTodayStart` で絞る（追加クエリ不要）。
3. 祝福演出は **App レベルのオーバーレイ**として、`handleEpilogueFinish` で本人名を使って1回出す（記録の成否と独立）。

## アーキテクチャ

### コンポーネント

| コンポーネント | 変更/新規 | 責務 |
|---|---|---|
| `services/clearRecordApi.js` | 変更 | `fetchAllClears(limit=1000)` を追加（全クリア者取得） |
| `features/screen/ClearListScreen.jsx` | 新規 | タイトルから開く一覧画面。全件取得→タイム速い順→手動スクロール表示。「ぜんぶ／今日だけ」トグル・戻るボタン・準備中/空/エラー表示 |
| `features/screen/ClearListScreen.module.css` | 新規 | ヘッダ（戻る・トグル）とスクロール枠だけ。行の見た目は `ClearScreen.module.css` を流用 |
| `App.jsx` | 変更 | `screen === 'clearlist'` の分岐追加、`TitleScreen` に `onShowClearList` を渡す。`handleEpilogueFinish` で祝福演出を発火し、`ClearCelebration` をトップレベルに重ねる |
| `features/title/TitleScreen.jsx` | 変更 | 「つづきの ぼうけんへ」の下に「クリア者一覧」ボタン（常時表示・同サイズ）を追加 |
| `features/screen/ClearCelebration.jsx` | 流用（不変） | 本人クリア時の祝福演出（`{nickname}` のみ使用） |
| `ClearScreen.module.css` / `RankBadge` / `formatClearTime` | 流用（不変） | 行の見た目・順位マーク・タイム整形 |

### データモデル

**クリア行**（既存）：`{ id, nickname, started_at, cleared_at }`。
- 順位＝経過（`cleared_at - started_at`）昇順、同値は `cleared_at` 昇順（`ClearScreen` と同式）。
- 「今日だけ」＝`new Date(cleared_at) >= getTodayStart()`。

**`ClearListScreen` の状態**：
```
status: 'loading' | 'ready' | 'error' | 'disabled'   // disabled = isClearRecordEnabled()===false
rows:   クリア行[]                                     // fetchAllClears の結果（全件）
today:  boolean（既定 false＝ぜんぶ）                   // トグル
// 表示 = today ? rows.filter(今日) : rows → 経過昇順にソートして順位付け
```

**祝福演出（App）**：`clearCelebrateName: string | null`（非 null の間 `ClearCelebration` を重ねる）。

### インターフェース

| 関数/プロップ | シグネチャ | 役割 |
|---|---|---|
| `fetchAllClears` | `(limit=1000) -> Promise<行[]>` | 全クリア者取得（`cleared_at` 非 null・`cleared_at` 昇順・上限） |
| `ClearListScreen` | `({ onBack }) -> JSX` | 一覧画面。`onBack` でタイトルへ |
| `TitleScreen` | 追加 `onShowClearList` | 「クリア者一覧」押下ハンドラ |

## データフロー

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 170" font-family="monospace" font-size="11">
  <style>.b{fill:#eef;stroke:#557}.s{fill:#dfd;stroke:#484}.d{fill:#fdd;stroke:#a44}.t{fill:#222}.e{stroke:#889;fill:none;marker-end:url(#a)}</style>
  <defs><marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#889"/></marker></defs>
  <rect class="b" x="8" y="20" width="150" height="40"/><text class="t" x="83" y="44" text-anchor="middle">TitleScreen</text>
  <rect class="b" x="200" y="20" width="150" height="40"/><text class="t" x="275" y="38" text-anchor="middle">App</text><text class="t" x="275" y="52" text-anchor="middle">screen='clearlist'</text>
  <rect class="s" x="390" y="12" width="170" height="56"/><text class="t" x="475" y="32" text-anchor="middle">ClearListScreen</text><text class="t" x="475" y="48" text-anchor="middle">全件→今日絞り</text><text class="t" x="475" y="62" text-anchor="middle">タイム順・手動scroll</text>
  <rect class="d" x="600" y="20" width="150" height="40"/><text class="t" x="675" y="38" text-anchor="middle">clearRecordApi</text><text class="t" x="675" y="52" text-anchor="middle">fetchAllClears</text>
  <path class="e" d="M158,40 L198,40"/><text class="t" x="178" y="34">押下</text>
  <path class="e" d="M350,40 L388,40"/>
  <path class="e" d="M560,40 L598,40"/>
  <rect class="d" x="200" y="110" width="200" height="40"/><text class="t" x="300" y="128" text-anchor="middle">handleEpilogueFinish</text><text class="t" x="300" y="142" text-anchor="middle">markCleared</text>
  <rect class="s" x="440" y="110" width="200" height="40"/><text class="t" x="540" y="128" text-anchor="middle">ClearCelebration（App重ね）</text><text class="t" x="540" y="142" text-anchor="middle">おめでとう＋本人名</text>
  <path class="e" d="M400,130 L438,130"/>
  <text class="t" x="300" y="100" text-anchor="middle" fill="#a44">要件7：本人クリア時に演出（記録と独立）</text>
</svg>

## 実装方針

### 1. 全件取得 API（要件5 / `clearRecordApi.js`）
- `fetchAllClears(limit = 1000)`：`fetchTodayClears` と同型。`.select('id, nickname, started_at, cleared_at')` に `.not('cleared_at', 'is', null)`＋`.order('cleared_at', { ascending: true })`＋`.limit(limit)`。未設定時は従来どおり throw（呼び出し側が `isClearRecordEnabled()` で先に分岐）。

### 2. 一覧画面（要件1–5 / `ClearListScreen.jsx`＋`.module.css`）
- `import clearStyles from './ClearScreen.module.css'`（行・背景・順位色を流用）＋`import styles from './ClearListScreen.module.css'`（ヘッダ・スクロール枠）。
- マウント時：`isClearRecordEnabled()` が false → `status='disabled'`。true → `fetchAllClears()` を1回呼び、成功 `ready`／失敗 `error`。
- 表示集合：`today ? rows.filter((r)=> new Date(r.cleared_at) >= getTodayStart()) : rows`。それを経過昇順にソート（`ClearScreen` の `rankedClears` と同式）して順位付け。
- 行は `ClearScreen` と同じマークアップ（`clearStyles.row`＋金銀銅、`RankBadge rank={i+1}`、`clearStyles.name`、`clearStyles.time` に `formatClearTime`）。
- スクロール：`.viewport { overflow-y: auto }` の枠に `ul`（自動スクロールの複製・アニメは無し）。
- ヘッダ：左に「← もどる」（`onBack`）、右に「ぜんぶ／今日だけ」トグル。
- 状態別：`disabled`→「じゅんびちゅう」、空→「まだ クリアした人が いないよ」、`error`→「よみこみに しっぱいしました」。文言はふりがな方針。

### 3. App 配線＋タイトルボタン（要件1 / `App.jsx`・`TitleScreen.jsx`）
- `App`：`import ClearListScreen`。if/else に `else if (screen === 'clearlist') currentScreen = <ClearListScreen onBack={() => setScreen('title')} />;`。`handleShowClearList = useCallback(() => setScreen('clearlist'), [])`。`<TitleScreen ... onShowClearList={handleShowClearList} />`。
- `TitleScreen`：props に `onShowClearList` 追加。`world5Button` の**直後**に「クリア者一覧」ボタンを置く（`canPlayWorld5` に関係なく常時表示）。意匠は `world5Button` と同クラス（同サイズ）を流用、または専用クラスで同サイズに。

### 4. 本人クリア時の祝福演出（要件7 / `App.jsx`）
- `import ClearCelebration from './features/screen/ClearCelebration.jsx'`。
- 状態 `const [clearCelebrateName, setClearCelebrateName] = useState(null)`。
- `handleEpilogueFinish`：
  ```js
  markCleared();
  setClearCelebrateName(usePlayerStore.getState().playerName);
  setScreen('title');
  ```
- レンダー末尾（`currentScreen` の外側・最前面）に：
  ```jsx
  {clearCelebrateName && (
    <ClearCelebration
      key={clearCelebrateName}
      clear={{ nickname: clearCelebrateName }}
      onFinish={() => setClearCelebrateName(null)}
    />
  )}
  ```
- 演出は全画面の暗転＋紙ふぶき＋「クリア おめでとう！＋本人名」で、アニメ終了（`onAnimationEnd`→`onFinish`）で自動的に閉じる。記録（`markCleared`）の成否とは独立（Supabase 無効でも演出は出る）。

## 依存関係

| モジュール | 用途 | 導入済み？ |
|---|---|---|
| （新規パッケージ無し） | 既存の React/Supabase クライアント/CSS のみ | — |
| `services/clearRecordApi.js` | 取得・接続判定 | はい（流用＋`fetchAllClears` 追加） |
| `features/screen/`（ClearScreen.module.css・RankBadge・formatClearTime・ClearCelebration） | 見た目・順位・タイム・演出の流用 | はい |

## トレードオフと検討した代替案

- **決定**：会場用 `ClearScreen` を改造せず新規 `ClearListScreen` を作る。
  **理由**：会場用は自動スクロール・演出・Realtime・今日限定と用途が違う。別画面なら `/screen` を壊さない（要件6）。CSS は import 流用で見た目を一致。
- **決定**：「今日だけ」はクライアント側フィルタ（全件取得を1回）。
  **理由**：期間は「ぜんぶ／今日だけ」の2択のみ。追加クエリ・購読を避けられる（要件7：開いた時点の一覧）。
- **決定**：祝福演出を App レベルのオーバーレイにして `handleEpilogueFinish` で出す。
  **理由**：計測終了（`markCleared`）と同じ箇所。画面遷移（→title）に重ねられ、記録の成否と独立に演出できる。
  **代替案**：会場用の `useClearCelebrationQueue`（新規クリアを列で祝う）を流用。本人1回の演出には過剰で、Realtime 前提なので却下。

## 微小点（実装中に確定でよい）
- `fetchAllClears` の上限（提案 1000）。
- 「クリア者一覧」ボタンの正確な意匠（`world5Button` 流用 or 専用同サイズ）。
- 「ぜんぶ／今日だけ」トグルの見た目（2ボタン or スイッチ）。
