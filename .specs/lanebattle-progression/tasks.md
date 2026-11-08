# タスク一覧: 陣取り合戦 進行連動アップデート

## 概要

下から積む：まず**解放ヘルパ**と**難易度プリセット（config）**を用意し、次に**engine（ランダムCPU・createRuntime注入）**、続いて**UI配線（MatchView→LaneBattleApp→DeckBuilder）**、最後に**CSS**と**検証**。sim（`stepSim`）は触らずバランス不変。クリティカルパスは 1,2 → 3,4 → 5 → 6,7 → 8 → 9。

合計タスク数：9件 ｜ 想定工数：約6〜8時間

パス基準：`frontend/src/features/lanebattle/`（`stores`/`data` は `frontend/src/`）

## タスク

- [ ] **1. 解放ヘルパ `engine/unitUnlock.js`（新規）**
  - 内容：`src/data/stages.json` から `enemyId→stageId` を逆引きした `STAGE_BY_UNIT` を構築。`requiredStageFor(id)`（無しは null＝常時解放、例 `mecha_dragon`）、`isUnitUnlocked(id, cleared)`、`unlockedRosterIds(cleared)`、`isDifficultyUnlocked(key, cleared)` を純関数で提供。
  - ファイル：`engine/unitUnlock.js`、流用：`src/data/stages.json`・`deriveUnitDef.rosterIds`・`lanebattle_config.json`（difficultyUnlock）
  - 依存：なし（ただし 2 の `difficultyUnlock` を参照するので 2 と前後しても可）
  - 完了条件：headless で `isUnitUnlocked('wolf', ['1-2'])===true`、`isUnitUnlocked('phoenix', ['1-2'])===false`、`isUnitUnlocked('mecha_dragon', [])===true`、`unlockedRosterIds(['1-1','1-2'])` が slime/wolf＋mecha_dragon を含む。
  - 対応要件：1, 4

- [ ] **2. 難易度プリセット（`data/lanebattle_config.json`）**
  - 内容：`cpu.difficulty` を `star1`（`random:true`/`reactionMs:650`/`energyRegenMul:1.0`）・`star2`（固定デッキ lagiacrus,squid,shark,knight,cobra,wolf＋500/0.7/1.0/0.15）・`star3`（固定デッキ mecha_dragon,lizard,squid,shark,crab,wolf＋300/0.9/1.3/0.05）へ拡張。`cpu.difficultyUnlock = { star1:null, star2:"3-4", star3:"4-4" }` を追加。既存 `cpu.deck` は後方互換の既定として残置。
  - ファイル：`data/lanebattle_config.json`
  - 依存：なし
  - 完了条件：JSON パス成功。3プリセットと difficultyUnlock が読める。固定デッキのidは全て roster に存在。
  - 対応要件：5, 7, 8

- [ ] **3. ランダムCPU `decideRandomCpu`（`engine/cpuBrain.js`）**
  - 内容：`decideRandomCpu(brain, state, cpuHand, dt, diff, rng)` を追加。反応間隔ゲート（`brain.reactT`）→ 出せる札をランダム1枚 → `lane=floor(rng*3)`・`slot=floor(rng*config.deploy.steps)` を返す（無ければ null）。戦術評価なし。既存 `decideCpu` は不変。
  - ファイル：`engine/cpuBrain.js`
  - 依存：2（`diff.reactionMs` を使う）
  - 完了条件：headless で ☆1 preset を渡すと有効範囲の `{handIndex,lane,slot}` または null を返し、エナジー不足時は出さない。
  - 対応要件：6

- [ ] **4. CPU注入（`engine/createRuntime.js`）**
  - 内容：`createRuntime({ ..., cpuDeckIds })` を受け、`cpuDeck = createDeck(shuffle(cpuDeckIds ?? diff.deck ?? config.cpu.deck ?? []))`。CPU 判断を `diff.random ? decideRandomCpu(...) : decideCpu(...)` で分岐。`state.cpuRegenMul = diff.energyRegenMul`（既存）。
  - ファイル：`engine/createRuntime.js`
  - 依存：2, 3
  - 完了条件：headless で ☆1 はランダム出撃・☆2/☆3 は固定デッキ＋`decideCpu`。`cpuRegenMul` が preset 値になる。
  - 対応要件：5, 6, 7, 8

- [ ] **5. MatchView 配線（`MatchView.jsx`）**
  - 内容：props に `difficulty`・`cpuDeckIds` を追加し `createRuntime` へ素通し（`useEffect` 依存に追加）。rematch 時も同難易度を維持。
  - ファイル：`MatchView.jsx`
  - 依存：4
  - 完了条件：`difficulty`/`cpuDeckIds` を渡して対戦が走る。未指定時は従来既定にフォールバック。
  - 対応要件：5

- [ ] **6. LaneBattleApp 配線（`LaneBattleApp.jsx`）**
  - 内容：`startBattle(ids, difficultyKey)` に拡張。`useProgressStore` で `clearedStageIds` を読み、preset 解決＋CPUデッキ算出（☆1＝`unlockedRosterIds` からランダム6枚、☆2/3＝`preset.deck`）。state に `difficultyKey`/`cpuDeckIds` を保持し `MatchView` へ `difficulty`/`cpuDeckIds` を渡す。
  - ファイル：`LaneBattleApp.jsx`
  - 依存：1, 2, 5
  - 完了条件：各難易度で対戦開始でき、☆1 の CPU デッキが解放済みからランダムになる。
  - 対応要件：4, 5, 6

- [ ] **7. DeckBuilder（`DeckBuilder.jsx`）**
  - 内容：`clearedStageIds` を読み、ロスターの未解放を「？」＋`disabled`（`toggle` も無視）。上部に解放案内バナー（未解放が1つ以上のとき）。下部の単一スタートを**難易度3ボタン横並び**へ置換（`disabled=!ready || !isDifficultyUnlocked(key)`、未解放は🔒、`onClick={()=>onStart(deck,key)}`）。
  - ファイル：`DeckBuilder.jsx`
  - 依存：1, 2, 6（`onStart(ids,key)` 署名）
  - 完了条件：未解放キャラが「？」で選べない／解放済みは従来どおり／3ボタンが解放状況に応じて押せる。
  - 対応要件：1, 2, 3, 5

- [ ] **8. スタイル（`lanebattle.css`）**
  - 内容：`.lb-pick.locked`（淡色・not-allowed・「？」）、`.lb-unlock-note`（目立つバナー）、`.lb-difficulty-row`＋`.lb-diff-btn`（☆表示・🔒・既存 `.lb-start` 意匠踏襲）を追加。
  - ファイル：`lanebattle.css`
  - 依存：7（クラス名確定後）
  - 完了条件：ロック枠・バナー・難易度ボタンが見やすく表示。既存編成UIと馴染む。
  - 対応要件：2, 3, 5

- [ ] **9. 通し検証・build/lint**
  - 内容：headless（unitUnlock・decideRandomCpu・createRuntime の難易度別挙動）＋ `npm run build`/`npx eslint`。実機確認は指示時のみ。
  - ファイル：（検証のみ、temp は scratchpad）
  - 依存：1〜8
  - 完了条件：build・lint パス。要件1〜8の受け入れ基準を満たす。
  - 対応要件：全（1〜8）

## トレーサビリティ（要件→タスク）

| 要件 | タスク |
|---|---|
| 1 キャラ解放 | 1, 7 |
| 2 「？」選択不可 | 7, 8 |
| 3 案内バナー | 7, 8 |
| 4 CPUも進行連動 | 1, 6 |
| 5 難易度3段階＋選択UI | 2, 4, 5, 6, 7, 8 |
| 6 ☆1 ランダム | 3, 4, 6 |
| 7 ☆2 固定＋既存AI | 2, 4 |
| 8 ☆3 固定＋強化AI | 2, 4 |
| 8.5 編成と難易度独立 | 7 |
| 9・10（ドラッグ/エナジーUI） | 今回スコープ外 |
