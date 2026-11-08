# 設計書: 陣取り合戦 進行連動アップデート

## 概要

本編の進捗（`progressStore.clearedStageIds`）を唯一のソースに、陣取り合戦の「使えるキャラ」と「挑める難易度」を連動させる。既存アーキテクチャ（`LaneBattleApp` の phase 状態機械 → `DeckBuilder` で編成 → `MatchView`/`createRuntime` で対戦）に最小侵襲で差し込む。

要となる発見：
- キャラ解放は `stages.json` の `enemyId`（stage→enemy）を**逆引き**して機械導出できる（roster id == enemy id）。解放集合を二重管理しない。
- `createRuntime` は既に `difficulty` 引数を受けるが**呼び出し側が渡していない**。ここに難易度プリセットと CPU デッキを流す。
- CPU 難易度は `lanebattle_config.json` の `cpu.difficulty`（現状 `normal` のみ）を `star1/star2/star3` に拡張。

主要な設計判断：
1. 解放判定は純ヘルパ（新規 `engine/unitUnlock.js`）に集約し、DeckBuilder と LaneBattleApp が共用。
2. 難易度は「プリセット（AIパラメータ＋固定デッキ or random フラグ）」として config に持ち、`DeckBuilder` 下部の3ボタンで選んで対戦開始。
3. ☆×1 の「完全ランダム CPU」は `decideCpu` を汚さず**別関数 `decideRandomCpu`** を `createRuntime` の分岐で呼ぶ。
4. ☆×1 の CPU デッキは「解放済みからランダム6枚」を**進捗が分かる `LaneBattleApp` 側で生成**して渡す（`createRuntime` は進捗を知らないまま）。

## アーキテクチャ

### コンポーネント

| コンポーネント | 変更/新規 | 責務 |
|---|---|---|
| `engine/unitUnlock.js` | 新規 | `stages.json` から `enemyId→stageId` を逆引きした解放表。`isUnitUnlocked(id, cleared)` / `unlockedRosterIds(cleared)` / `isDifficultyUnlocked(key, cleared)` を提供 |
| `data/lanebattle_config.json` | 変更 | `cpu.difficulty` を `star1/star2/star3` プリセットへ拡張（AIパラメータ＋`deck`＋`random`）。`cpu.difficultyUnlock` 追加 |
| `DeckBuilder.jsx` | 変更 | 進捗読取、ロスターの「？／選択不可」、上部バナー、下部の難易度3ボタン（押下＝対戦開始） |
| `LaneBattleApp.jsx` | 変更 | `startBattle(ids, difficultyKey)` に拡張。難易度プリセット解決＋☆×1 の CPU デッキ（解放プールからランダム）生成。`MatchView` へ `difficulty`/`cpuDeckIds` を渡す |
| `MatchView.jsx` | 変更 | `difficulty`/`cpuDeckIds` を受けて `createRuntime` へ素通し |
| `engine/createRuntime.js` | 変更 | `cpuDeckIds` で CPU デッキ構築。`diff.random` なら `decideRandomCpu`、否なら従来 `decideCpu` |
| `engine/cpuBrain.js` | 変更 | `decideRandomCpu`（反応間隔ゲート→ランダム可負担札→ランダムレーン/スロット）を追加 |
| `lanebattle.css` | 変更 | ロック枠・「？」・バナー・難易度ボタンのスタイル |

### データモデル

**解放表（`unitUnlock.js`）** — `stages.json` から構築：
```
STAGE_BY_UNIT = { slime:'1-1', wolf:'1-2', ..., phoenix:'4-3' }   // enemyId→stageId の逆引き
// mecha_dragon は stage に現れない（本編 4-4 は 'dragon'）→ 常に解放
isUnitUnlocked(id, cleared) = requiredStageFor(id) === null || cleared.includes(requiredStageFor(id))
```

**難易度プリセット（`config.cpu.difficulty`）**：
```
star1: { random: true,  reactionMs: 650, energyRegenMul: 1.0 }                                   // デッキは解放プールからランダム（LaneBattleApp が注入）
star2: { reactionMs: 500, accuracy: 0.7, energyRegenMul: 1.0, missChance: 0.15,
         deck: ["lagiacrus","squid","shark","knight","cobra","wolf"] }
star3: { reactionMs: 300, accuracy: 0.9, energyRegenMul: 1.3, missChance: 0.05,
         deck: ["mecha_dragon","lizard","squid","shark","crab","wolf"] }
difficultyUnlock: { star1: null, star2: "3-4", star3: "4-4" }                                    // star1 は陣取り解放(2-4)時点で常に可
```

**props スレッディング**：`DeckBuilder.onStart(ids, difficultyKey)` → `LaneBattleApp.startBattle(ids, key)` → state `{deck, difficultyKey, cpuDeckIds}` → `MatchView difficulty={preset} cpuDeckIds={...}` → `createRuntime({ deckIds, cpuDeckIds, difficulty })`。

### インターフェース（主要シグネチャ）

| 関数 | シグネチャ | 役割 |
|---|---|---|
| `isUnitUnlocked` | `(id, clearedStageIds) -> boolean` | ロスター1体の解放判定 |
| `unlockedRosterIds` | `(clearedStageIds) -> string[]` | 解放済みロスターidの配列（☆×1 CPUプール・UI用） |
| `isDifficultyUnlocked` | `(key, clearedStageIds) -> boolean` | 難易度ボタンの可否 |
| `decideRandomCpu` | `(brain, state, cpuHand, dt, diff, rng) -> cmd|null` | ☆×1 のランダム出撃判断 |
| `createRuntime`（拡張） | `({ deckIds, cpuDeckIds, difficulty, ... })` | CPUデッキ/難易度の注入 |

## データフロー

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 220" font-family="monospace" font-size="11">
  <style>.b{fill:#eef;stroke:#557}.s{fill:#dfd;stroke:#484}.d{fill:#fdf;stroke:#849}.t{fill:#222}.e{stroke:#889;fill:none;marker-end:url(#a)}</style>
  <defs><marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#889"/></marker></defs>
  <rect class="d" x="8" y="30" width="150" height="54"/><text class="t" x="83" y="50" text-anchor="middle">progressStore</text><text class="t" x="83" y="66" text-anchor="middle">clearedStageIds</text>
  <rect class="b" x="200" y="20" width="170" height="80"/><text class="t" x="285" y="40" text-anchor="middle">DeckBuilder</text><text class="t" x="285" y="56" text-anchor="middle">ロック/？/バナー</text><text class="t" x="285" y="72" text-anchor="middle">難易度3ボタン</text><text class="t" x="285" y="88" text-anchor="middle">onStart(ids,key)</text>
  <rect class="b" x="410" y="20" width="170" height="80"/><text class="t" x="495" y="44" text-anchor="middle">LaneBattleApp</text><text class="t" x="495" y="60" text-anchor="middle">preset 解決</text><text class="t" x="495" y="76" text-anchor="middle">☆1 cpuDeck 生成</text>
  <rect class="b" x="620" y="30" width="120" height="60"/><text class="t" x="680" y="56" text-anchor="middle">MatchView</text><text class="t" x="680" y="72" text-anchor="middle">素通し</text>
  <rect class="s" x="770" y="20" width="122" height="80"/><text class="t" x="831" y="44" text-anchor="middle">createRuntime</text><text class="t" x="831" y="60" text-anchor="middle">cpuDeckIds</text><text class="t" x="831" y="76" text-anchor="middle">random?→</text><text class="t" x="831" y="92" text-anchor="middle">decide(Random)Cpu</text>
  <path class="e" d="M158,57 L198,57"/>
  <path class="e" d="M158,57 C180,57 180,60 408,60"/>
  <path class="e" d="M370,60 L408,60"/>
  <path class="e" d="M580,60 L618,60"/>
  <path class="e" d="M740,60 L768,60"/>
  <text class="t" x="430" y="200" text-anchor="middle" fill="#a44">難易度プリセット＝AIパラメータ＋固定デッキ or random。sim（stepSim）は不変。</text>
</svg>

## 実装方針

### 1. 解放判定（要件1・4 / `engine/unitUnlock.js`）
- `src/data/stages.json` を読み、`/^[1-5]-[1-4]$/` のステージの `enemyId→stageId` を map 化（モジュールロード時に1回）。
- `requiredStageFor(id)`：map に無い id（`mecha_dragon` 等）は `null`＝常に解放。
- `isUnitUnlocked` / `unlockedRosterIds` / `isDifficultyUnlocked` を純関数で提供。sim・progress を書き換えない読み取り専用。

### 2. DeckBuilder（要件1・2・3・5 / `DeckBuilder.jsx`）
- `const clearedStageIds = useProgressStore((s) => s.clearedStageIds)` を追加。
- ロスター `.map`：`locked = !isUnitUnlocked(def.id, clearedStageIds)`。locked なら `LbSprite`/名前/ステータスの代わりに「？」を描き、`lb-pick locked` クラスで淡色＋`disabled`。`toggle(id)` も locked を無視。
- 上部バナー：未解放が1つ以上あるとき「ストーリーを すすめると つかえる キャラが ふえるよ」を目立つ枠（`lb-unlock-note`）で表示。
- 下部：従来の単一スタートボタンを **難易度3ボタンの横並び**（`lb-difficulty-row`）に置換。各ボタンは
  - ラベル：☆×1／☆×2／☆×3（＋短い説明）
  - `disabled = !ready || !isDifficultyUnlocked(key, clearedStageIds)`、未解放は `locked` 表示（🔒）
  - `onClick={() => onStart(deck, key)}`
- プレイヤー編成は難易度非依存（要件8.5）。デッキは解放済みから6枚選ぶ（既存ロジック＋locked 無視のみ）。

### 3. 難易度プリセットと CPU 注入（要件5・6・7・8 / config・LaneBattleApp・MatchView・createRuntime）
- `lanebattle_config.json`：`cpu.difficulty` を `star1/star2/star3` に（上記データモデル）。`cpu.difficultyUnlock` 追加。`cpu.deck`（旧固定デッキ）は後方互換の既定として残す。
- `LaneBattleApp.startBattle(ids, difficultyKey)`：
  - `const preset = config.cpu.difficulty[difficultyKey]`。
  - CPU デッキ：`star1` は `pickRandom(unlockedRosterIds(cleared), 6)`、`star2/star3` は `preset.deck`。
  - state に `difficultyKey` と算出した `cpuDeckIds` を保持し、`MatchView` に `difficulty={preset}`・`cpuDeckIds={cpuDeckIds}` を渡す。`LaneBattleApp` で `useProgressStore` を読む。
- `MatchView`：`difficulty`/`cpuDeckIds` を受け、`createRuntime({ deckIds, cpuDeckIds, difficulty, ... })` へ素通し（`useEffect` 依存に追加）。
- `createRuntime`：
  - `const cpuDeck = createDeck(shuffle(cpuDeckIds ?? diff.deck ?? config.cpu.deck ?? []))`。
  - `state.cpuRegenMul = diff.energyRegenMul ?? 1`（既存）。
  - CPU 判断分岐：`const cmd = diff.random ? decideRandomCpu(cpuBrain, state, cpuDeck.hand(), dt, diff, Math.random) : decideCpu(cpuBrain, state, cpuDeck.hand(), dt, diff, Math.random);`

### 4. ランダム CPU（要件6 / `engine/cpuBrain.js`）
- `decideRandomCpu(brain, state, cpuHand, dt, diff, rng)`：
  - 反応間隔ゲート（`brain.reactT -= dt; if (>0) null; reset = diff.reactionMs`）。
  - 手札のうちエナジーで出せる札を列挙→無ければ null。ランダムに1枚（handIndex）。
  - `lane = floor(rng()*3)`、`slot = floor(rng()*config.deploy.steps)`。`{ handIndex, lane, slot }` を返す。
  - 配置可否は `applyDeploy` が検証（占有スロット等は失敗→その回は出さない＝「雑なAI」として許容）。戦術評価（レーン脅威・相性）は一切しない。

### 5. 保存デッキ（要件8）
- 現状、プレイヤーのデッキは**永続化されていない**（`DeckBuilder` のローカル state・毎回空）。よって「未解放混入」は起こらず**今回は対応不要**。将来デッキ永続化を足す場合は、読込時に `isUnitUnlocked` でフィルタする（design に明記）。

### 6. スタイル（`lanebattle.css`）
- `.lb-pick.locked`（淡色・`cursor:not-allowed`・「？」中央）、`.lb-unlock-note`（目立つバナー）、`.lb-difficulty-row`＋`.lb-diff-btn`（3分割・☆表示・ロック 🔒）。既存 `.lb-start` の意匠を踏襲。

## 依存関係

| パッケージ/モジュール | 用途 | 導入済み？ |
|---|---|---|
| （新規パッケージ無し） | 既存の React/zustand/素JS のみ | — |
| `src/stores/progressStore.js` | `clearedStageIds` 読取 | はい（流用） |
| `src/data/stages.json` | 解放表の元データ | はい（流用） |

## トレードオフと検討した代替案

- **決定**：難易度プリセットを config に持ち、`createRuntime` の `difficulty` 引数で流す。
  **理由**：`createRuntime` は既に `difficulty` を受ける口があり、最小変更。sim（`stepSim`）は不変でバランス不変。
- **決定**：☆×1 のランダム CPU を `decideCpu` の中ではなく**別関数＋呼び出し分岐**にする。
  **理由**：賢いAIの分岐に `random` を混ぜると可読性が落ちる。純粋な別関数なら副作用なく読みやすい。
- **決定**：☆×1 の CPU デッキ生成を `LaneBattleApp`（進捗を知る層）で行い、`createRuntime` には id 配列だけ渡す。
  **理由**：`createRuntime`/`engine` を progress 非依存に保てる（テスト容易・関心分離）。
  **代替案**：`createRuntime` に clearedStageIds を渡して内部でランダム生成。engine が progress に依存して密結合になるため却下。
- **決定**：解放表を `stages.json` から導出（静的ハードコードしない）。
  **理由**：ステージの敵を入れ替えても自動追従。単一の真実源。

## 判断が残る微小点（実装中に確定でよい）
- ☆×1 の反応間隔 `reactionMs`（提案 650ms／雑めに）。
- 難易度ボタンのラベル表記（「☆」1〜3個＋「かんたん/ふつう/つよい」等の併記可否）。
- バナーの文言最終形（要件3の文言で確定）。
