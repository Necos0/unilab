# 設計: ユニット5「スコア計算・制限時間・結果画面」

（親：`requirements.md` 要件 3・6 ／ ロードマップ：`plan.md`）

## 概要

1 試合をちゃんと終わらせ、スコアを出す。**制限時間**（3〜4分）を設け、残り時間を画面右上に大きく表示。**時間内に敵本陣を 0 にできればクリア**（勝利点＋残り時間ボーナス）、**削りきれなければ与えたダメージに応じたスコア**。決着（クリア／自本陣陥落／時間切れ）で結果画面に移り、スコアとベストを出して再戦／終了を選ぶ。

スコア算出は 1 か所（`engine/score.js`）に集約（要件8）。ベスト保存は既存 `useLaneBattleBest`（localStorage）を流用。

## スコープ

やること：
- 制限時間（`config.timeLimitMs`）と、時間切れの決着（`stepSim` で `result='timeout'`）。
- スコア算出 `computeScore(state)`：クリア＝勝利点＋残り時間ボーナス／それ以外＝与ダメージ比例。
- HUD に**残り時間**を大きく表示（右上）。
- 結果画面：クリア/未クリア・スコア・ベスト・再戦/終了。`MatchView` を「対戦中→結果」の段階遷移に。

やらないこと（後続）：
- 本編組み込み・1レーン版の置き換え（ユニット7）。
- オンラインランキング（本体チームの別トラック）。

## データモデル

### config
- `timeLimitMs`：既存（今 90000）。**180000（3分）**に設定（`240000`＝4分でも可。要相談）。
- `score`（既存に追記、旧フィールドは1レーン版のため残す）：
  - `winBase`（既存 10000）… クリアの基礎点。
  - `timeBonusPerSec`（新）… クリア時、残り 1 秒あたりの加点（例 50）。
  - `damageScoreMax`（新）… 未クリア時、敵本陣を全部削った相当の満点（例 8000。`winBase` 未満にして「クリア＞未クリア」を担保）。

### state
- `result`：`'you'`（クリア）／`'cpu'`（自本陣陥落）／`'timeout'`（時間切れ）／`null`。`'you'` 以外はすべて「未クリア」。

## インターフェース（案）

| 対象 | 役割 |
|---|---|
| `stepSim` の時間切れ判定 | `!result && t >= timeLimitMs` で `result='timeout'`（決着） |
| `engine/score.js` の `computeScore(state)` | クリア＝`winBase + timeBonusPerSec×残り秒`／それ以外＝`damageScoreMax × 与ダメージ/本陣最大HP` |
| HUD `timeLeft` | `buildHud` に残り時間（秒）を追加、`MatchView` が右上に大表示 |
| 結果画面 | `MatchView` が `result` を検知して結果ビューへ。スコア＋ベスト（`useLaneBattleBest`）＋再戦/終了 |

## 決着とスコアの流れ

<svg viewBox="0 0 660 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="決着とスコアの分岐">
  <defs><marker id="as5" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#6b7a92"/></marker></defs>
  <rect x="20" y="82" width="200" height="46" rx="8" fill="#fff6e6" stroke="#e0b24a" stroke-width="1.5"/>
  <text x="120" y="103" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">時間内に敵本陣を</text>
  <text x="120" y="119" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">0 にできた?</text>
  <rect x="330" y="18" width="310" height="52" rx="8" fill="#e6efff" stroke="#5b7fc4" stroke-width="1.8"/>
  <text x="485" y="40" font-family="sans-serif" font-size="12.5" fill="#1f2a3d" text-anchor="middle">クリア！</text>
  <text x="485" y="57" font-family="sans-serif" font-size="11.5" fill="#1f2a3d" text-anchor="middle">スコア = winBase + 残り時間 × ボーナス</text>
  <rect x="330" y="140" width="310" height="52" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="485" y="162" font-family="sans-serif" font-size="12.5" fill="#1f2a3d" text-anchor="middle">未クリア（時間切れ / 自本陣陥落）</text>
  <text x="485" y="179" font-family="sans-serif" font-size="11.5" fill="#1f2a3d" text-anchor="middle">スコア = 与ダメージに応じて</text>
  <path d="M220,98 L326,44" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#as5)"/>
  <text x="262" y="60" font-family="sans-serif" font-size="10" fill="#6b7a92">はい</text>
  <path d="M220,112 L326,166" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#as5)"/>
  <text x="262" y="150" font-family="sans-serif" font-size="10" fill="#6b7a92">いいえ</text>
</svg>

## 実装方針

- **決着は3種**：`'you'`（クリア）/`'cpu'`（自本陣0）/`'timeout'`（時間切れ）。スコアはクリアだけ高得点、他は与ダメージ比例（要件3。「膠着で全員最低点」を避ける）。
- **クリア＞未クリア**を数値で担保（`damageScoreMax < winBase`）。速いクリアほど残り時間ボーナスで高い。
- **スコアは `computeScore` 1 か所**（要件8。将来ランキング送信もここ1点から）。
- 残り時間は右上に大きく（`timeLeft`）。結果画面は既存 `ResultOverlay`／`useLaneBattleBest` を流用・調整。

## ブロック分割（block-review 用）

- **5-1** … 制限時間の決着（`stepSim` で `result='timeout'`）＋ `config.timeLimitMs` を 3分に
- **5-2** … `engine/score.js`（`computeScore`）＋ `config.score` に `timeBonusPerSec`/`damageScoreMax`
- **5-3** … HUD に残り時間（`buildHud` の `timeLeft`）＋ `MatchView` 右上に大表示
- **5-4** … 結果画面（`MatchView` の段階遷移＋スコア/ベスト表示/再戦・終了）

## 要件との対応

| 要件 | 充足 |
|---|---|
| 要件3-3〜7（制限時間・クリア点＋時間ボーナス・未クリアは与ダメージ・ベスト保存） | timeLimit＋computeScore＋useLaneBattleBest |
| 要件6-3/4/6（敵本陣0で勝ち・自本陣0で負け・時間切れ終了） | stepSim の result 判定 |
| 要件8（スコア集約） | `computeScore` 1 か所 |
