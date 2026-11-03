# 設計: ユニット3「配置UI（プレイヤーが置いて遊べる状態）」

（親：`requirements.md` 要件 2・3・8 ／ ロードマップ：`plan.md`）

## 概要

ユニット2の純シム（`stepSim`）を画面につなぎ、**プレイヤーがカードを選んでレーン×前後スロットにタップ配置し、出したキャラがレーン上で動くのを見られる**状態にする。CPU はまだ入れない（ユニット4）ので、この段は「自分だけが出して、敵陣（＋本陣防衛）を殴る」練習場のような状態。ここで**キャラの描画**と**死亡アニメ**も合流させる。

## スコープ

やること：
- state に**エナジー**を持たせ、`stepSim` で時間回復（既存のエスカレーション踏襲）。
- **デプロイコマンド**（誰が・どのカードを・どのレーン・どの前後スロットに）を処理する純関数 `applyDeploy`（エナジー消費＋`spawnUnit`）。
- **ランタイム駆動**：rAF ループが `stepSim(state, dt)` を回し、HUD（エナジー・手札）を通知。
- **ユニット描画**：`state.units` をレーン上のスプライトへ反映（`laneSprite` をレーン対応に）。死亡アニメは「state から消えたユニットのスプライトを死亡再生してから除去」。
- **デッキ・手札**：既存 `createDeck` を流用（6枚・手札3・ローテ）。
- **配置入力 UI**：手札カード選択 → 自陣セル（3レーン×前後3段）タップ → コスト消費して出撃。

やらないこと（後続）：
- CPU（ユニット4）／制限時間・スコア・結果画面（ユニット5）／難易度選択（ユニット6）。
- 本編への組み込み・1レーン版の置き換え（ユニット7）。

## データモデル

### state 追加（`battleState.js`）
- `energy: { you: cfg.energyStart, cpu: cfg.energyStart }`（cpu 側は今は増えるだけ）。
- `energySpent: { you: 0, cpu: 0 }`（スコア用にユニット5で使う。今は記録だけ）。

### デプロイコマンド（入力の単位。要件8）
```
{ side: 'you'|'cpu', id: string, lane: 0|1|2, slot: 0|1|2 }
```
`slot` は自陣内の前後（0=後方 / 1=中 / 2=前方）。x は `config.deploy.youSlotXs[slot]`（cpu は `cpuSlotXs`）から引く。

## インターフェース（案）

| 対象 | 種別 | 役割 |
|---|---|---|
| `applyDeploy(state, cmd)` | 新規（純関数） | コスト判定→`energy` 減算＋`energySpent` 加算→`spawnUnit`。出せなければ false |
| `stepSim` のエナジー回復 | 既存編集 | `t` に応じてエスカレーションしつつ両陣営の `energy` を回復 |
| `createRuntime({ deckIds, onHud })` | 新規（駆動） | state 保持・rAF で `stepSim`・`deploy(cardIndex, lane, slot)`・HUD 通知・破棄 |
| `renderUnits(state, laneEls, spriteMap)` | 新規（描画） | `state.units` とスプライトを差分同期（生成・位置/HP/フレーム更新・死亡再生後に除去） |
| `HandBar` / 配置セル | React | 手札表示・カード選択・自陣セルのタップ |

## 描画方針（重要）

- ユニットは数が多く動くので **React 再レンダーではなく命令的描画**（既存 `laneSprite` を流用）。`BattleField`（ユニット1）はレーンの「器」を出し、各レーン要素の ref を駆動側へ渡す。駆動が `state.units` を見てスプライトを各レーンに描く。
- **死亡アニメ（即除去との両立）**：シムは dead を即除去する。描画側は「前フレームまで居たのに `state.units` から消えたユニット」を検出し、そのスプライトを**死亡フレームで再生**してから、再生し切ったら DOM を消す（＝消え方＝必ず死亡アニメが流れる）。ユニットの同定はスプライトを `Map<unit, sprite>` で持ち、消えた unit を検出する。
- 座標は仮想座標→% 変換（ユニット1と同方式）。lane は `config.field.laneYs`、x は `state.units[].x`。

## データフロー

<svg viewBox="0 0 660 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="データフロー: 入力→applyDeploy→state、rAF→stepSim→state、state→描画/HUD">
  <defs><marker id="ar3" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#6b7a92"/></marker></defs>
  <rect x="20" y="16" width="250" height="176" rx="10" fill="none" stroke="#c5cede" stroke-width="1.2" stroke-dasharray="4 4"/>
  <text x="34" y="34" font-family="sans-serif" font-size="11" fill="#8894a8">入力</text>
  <rect x="415" y="16" width="220" height="112" rx="10" fill="none" stroke="#c5cede" stroke-width="1.2" stroke-dasharray="4 4"/>
  <text x="429" y="34" font-family="sans-serif" font-size="11" fill="#8894a8">駆動（rAF）</text>
  <rect x="40" y="44" width="210" height="40" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="145" y="68" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">手札選択 ＋ 自陣セル tap</text>
  <rect x="40" y="102" width="210" height="40" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="145" y="126" font-family="sans-serif" font-size="11.5" fill="#1f2a3d" text-anchor="middle">デプロイコマンド{side,id,lane,slot}</text>
  <rect x="40" y="152" width="210" height="34" rx="8" fill="#e6efff" stroke="#5b7fc4" stroke-width="1.7"/>
  <text x="145" y="174" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">applyDeploy(state, cmd)</text>
  <rect x="435" y="44" width="180" height="36" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="525" y="67" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">rAF ループ</text>
  <rect x="435" y="92" width="180" height="34" rx="8" fill="#e6efff" stroke="#5b7fc4" stroke-width="1.7"/>
  <text x="525" y="114" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">stepSim(state, dt)</text>
  <rect x="248" y="238" width="180" height="48" rx="10" fill="#dbe7ff" stroke="#4f74c0" stroke-width="2"/>
  <text x="338" y="267" font-family="sans-serif" font-size="13" fill="#1f2a3d" text-anchor="middle">battleState（state）</text>
  <rect x="40" y="336" width="240" height="40" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="160" y="360" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">renderUnits → スプライト</text>
  <rect x="390" y="336" width="230" height="40" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="505" y="360" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">HUD: エナジー / 手札</text>
  <path d="M145,84 L145,100" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar3)"/>
  <path d="M145,142 L145,150" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar3)"/>
  <path d="M250,176 L300,236" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar3)"/>
  <path d="M525,80 L525,90" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar3)"/>
  <path d="M520,126 L392,236" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar3)"/>
  <path d="M300,286 L190,334" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar3)"/>
  <path d="M388,286 L480,334" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar3)"/>
</svg>

## 実装方針

- **エナジーはシム、デッキは入力層**：エナジー回復は時間依存なので `stepSim`（決定的）に置く。デッキ（どのカードが手札か）はプレイヤー入力の都合なので駆動側が `createDeck` を保持し、`deploy` 時にコマンドの `id` を決める。→ 要件8（入力駆動）と整合、将来 CPU/ネットワークも同じ `applyDeploy` を通す。
- **既存資産の流用**：`createDeck`（6枚・手札3・ローテ）、`laneSprite`（スプライト生成）、`BattleField`（盤面）。エナジー回復式・エスカレーションは1レーン版の値を踏襲（数値は後で調整）。

## ブロック分割（block-review 用）

- **3-1** … `state` にエナジー追加 ＋ `stepSim` にエナジー回復 ＋ `applyDeploy`（純関数）
- **3-2** … ランタイム駆動 `createRuntime`（rAF で `stepSim`、`deploy`、HUD 通知）。テスト用に1体出して「動いている」ことを確認
- **3-3** … ユニット描画 `renderUnits`（`laneSprite` をレーン対応に、差分同期、死亡アニメ）。**動く画面のプレビュー**を撮る
- **3-4** … デッキ・手札（`createDeck` 流用）＋ 手札・エナジーの HUD 表示
- **3-5** … 配置入力 UI（カード選択 → 自陣セル tap → `deploy`）。ここで実際に置いて遊べる

### 実装状況（2026-09-10 時点）

全ブロック完了（✅ 3-1 エナジー＋applyDeploy / 3-2 createRuntime / 3-3a・3-3b ユニット描画＋アイドル/死亡アニメ / 3-4a・3-4b デッキ・手札・HUD＋MatchView / 3-5 配置操作）。
新規：`engine/applyDeploy.js`・`engine/createRuntime.js`・`engine/createRenderer.js`・`MatchView.jsx`。改修：`battleState.js`（energy）・`stepSim.js`（エナジー回復）・`BattleField.jsx`（fieldRef／セルtap）・`HandBar.jsx`（selectedIndex）・`laneSprite.js`（流用）。
headless で「カード選択→セルtap→出撃→描画」「エナジー回復（20→100）」を確認。**プレイヤー単独で置いて遊べる状態**に到達（CPU はユニット4）。
React 19 の `react-hooks/refs`（レンダー中に ref を読まない）に対応：駆動/描画は `useEffect` 内生成、state は `useState` で共有。

## 要件との対応

| 要件 | 充足 |
|---|---|
| 要件2（自陣内フリー配置） | セル tap → `slot` → 自陣内 x で配置 |
| 要件3（デッキ6/手札3・エナジー） | `createDeck` 流用＋エナジー |
| 要件8（入力駆動・分離） | `applyDeploy`（コマンド駆動）／描画は state を読むだけ |
