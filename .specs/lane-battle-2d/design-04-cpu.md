# 設計: ユニット4「反応型CPU」

（親：`requirements.md` 要件 4・5 ／ ロードマップ：`plan.md`）

## 概要

敵（CPU）を、ランダムではなく**プレイヤーの手に反応**して戦う相手にする。中核は「①各レーンの脅威を評価 → ②いちばん危険なレーンを選ぶ → ③相性表でカウンターの役割を決める → ④手札から該当カードを選ぶ → ⑤前後どこに置くか → ⑥`applyDeploy`（側=cpu）」。適応・学習・探索は使わず、**ルールベースの反応**で成立させる（要件4-5）。「賢さ」は、プレイヤーが必ず先に出す＝手を見せるので、それに的確に答えることで生まれる。

キャラ対応（ヒトデ弱群れ↔単体ナイト、遠距離↔自陣ナイト等）は**役割タグ＋相性表というデータ**で表現し、コードを書き換えずに表の充実で詰められるようにする。難易度は数値ダイヤル（反応速度・カウンター精度・エナジー）で調整し、ユニット6の難易度選択がプリセットとして束ねる。

## スコープ

やること：
- ユニットに**役割タグ**（`role`）を持たせる（`tank`/`melee`/`ranged`/`swarm`/`support` 等）。
- config に**相性表**（脅威の役割 → 返す役割）と**難易度プリセット**を持たせる。
- CPU 思考 `cpuBrain`：脅威評価・カウンター選択・前後配置・意思決定（反応間隔・エナジー・わざとミス）。
- 駆動（`createRuntime`）に CPU を組み込む（CPU デッキ＋毎フレーム意思決定→`applyDeploy(側=cpu)`）。

やらないこと（後続）：
- 難易度**選択 UI**（ユニット6。ここでは既定プリセットで動かす）。
- スコア・制限時間・結果画面（ユニット5）／本編組み込み（ユニット7）。
- 群れ出撃（ヒトデ=1枚でN体）は**ユニット能力**（`spawnUnit`/`applyDeploy` に体数を足す）で、CPUとは独立。CPU は実ユニット数で脅威を見るので群れは自然に「N体分の圧」として反応される。

## データモデル

### ユニットの役割タグ（`lanebattle_units.json` の overrides、または `deriveUnitDef` の既定）
- `role`（string）… `'tank' | 'melee' | 'ranged' | 'swarm' | 'support'` など。既定は `'melee'`。相性表・脅威重みに使う。

### config への追加（`lanebattle_config.json`）
```
cpu: {
  deck: [...],                 // 既存
  counter: {                   // 脅威の役割 → 返したい役割（優先順）
    tank:   ["ranged", "swarm"],
    swarm:  ["ranged", "tank"],   // 範囲/硬さで受ける
    ranged: ["melee", "tank"],    // 近接を前線に差し込む
    melee:  ["ranged", "tank"],
    support:["melee", "ranged"]
  },
  difficulty: {                // プリセット（ユニット6が選ぶ）
    normal: { reactionMs, accuracy, energyRegenMul, missChance }
  }
}
```
（既存の `cpu.energyRegenMul` は difficulty プリセット側へ移す。）

## インターフェース（案）

| 関数（`engine/cpuBrain.js`） | 役割 |
|---|---|
| `evaluateLanes(state)` | 各レーンのプレイヤー脅威量（数×atk×hp を重み付け）を配列で返す |
| `chooseCounter(threatRole, hand, energy, diff, rng)` | 相性表＋`accuracy` で手札からカードを選ぶ（買えない/該当なしは代替） |
| `choosePlacement(state, lane, threat)` | 前後スロットを決める（脅威の前線を迎撃する等）。0/1/2 を返す |
| `decideCpu(brain, state, dt, diff, rng)` | 反応間隔・エナジー・ミスを見て、出す/待つを決め、コマンド or null |

`decideCpu` が返したコマンドを駆動が `applyDeploy(state, {side:'cpu', ...})` に流す。CPU の乱数（精度・ミス・間隔ゆらぎ）は今は駆動層の `Math.random`（PvP 用の seed 付きは後続）。

## CPU の意思決定フロー

<svg viewBox="0 0 900 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="反応型CPUの意思決定フロー">
  <defs><marker id="ac4" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#6b7a92"/></marker></defs>
  <rect x="30" y="36" width="250" height="46" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="155" y="63" font-family="sans-serif" font-size="12.5" fill="#1f2a3d" text-anchor="middle">① 各レーンの脅威を評価</text>
  <rect x="325" y="36" width="250" height="46" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="450" y="63" font-family="sans-serif" font-size="12.5" fill="#1f2a3d" text-anchor="middle">② いちばん危険なレーンを選ぶ</text>
  <rect x="620" y="36" width="250" height="46" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="745" y="63" font-family="sans-serif" font-size="12.5" fill="#1f2a3d" text-anchor="middle">③ 相性表でカウンター役割</text>
  <rect x="620" y="150" width="250" height="46" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="745" y="171" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">④ 手札からカードを選ぶ</text>
  <text x="745" y="187" font-family="sans-serif" font-size="10.5" fill="#6b7a92" text-anchor="middle">（精度で 最適/雑）</text>
  <rect x="325" y="150" width="250" height="46" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="450" y="171" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">⑤ 前後どこに置くか</text>
  <text x="450" y="187" font-family="sans-serif" font-size="10.5" fill="#6b7a92" text-anchor="middle">（前線で迎撃 等）</text>
  <rect x="30" y="150" width="250" height="46" rx="8" fill="#e6efff" stroke="#5b7fc4" stroke-width="1.8"/>
  <text x="155" y="177" font-family="sans-serif" font-size="12.5" fill="#1f2a3d" text-anchor="middle">⑥ applyDeploy（側=cpu）</text>
  <rect x="240" y="244" width="420" height="40" rx="8" fill="#fff6e6" stroke="#e0b24a" stroke-width="1.5"/>
  <text x="450" y="269" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">難易度ダイヤル：反応速度 / カウンター精度 / エナジー</text>
  <path d="M280,59 L323,59" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ac4)"/>
  <path d="M575,59 L618,59" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ac4)"/>
  <path d="M745,82 L745,148" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ac4)"/>
  <path d="M620,173 L577,173" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ac4)"/>
  <path d="M325,173 L282,173" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ac4)"/>
  <path d="M540,244 L620,198" fill="none" stroke="#8894a8" stroke-width="1.4" stroke-dasharray="5 4" marker-end="url(#ac4)"/>
  <path d="M380,244 L440,198" fill="none" stroke="#8894a8" stroke-width="1.4" stroke-dasharray="5 4" marker-end="url(#ac4)"/>
</svg>

## 実装方針

- **反応の非対称性**：プレイヤーが先に出す→CPU が答える。CPU は盤面（実ユニット）を毎回見て、脅威の大きいレーンにカウンターを置くだけで「賢い」。
- **相性はデータ**：`role` タグ＋`cpu.counter` 表。マッチアップ（群れ↔単体近接、遠距離↔近接）は表の行として後から足せる（新規コード不要）。
- **難易度ダイヤル**：`reactionMs`（判断間隔）・`accuracy`（最適カウンターを選ぶ確率）・`energyRegenMul`・`missChance`（わざと非最適/遅延）。無敵にしない（要件5-3）。
- **決定性**：CPU の乱数は今は駆動層の `Math.random`。PvP・リプレイ用の seed 付き決定的乱数は必要になったら差し込む（純シム `stepSim` は決定的なまま）。

## ブロック分割（block-review 用）

- **4-1** … `role` タグ（units）＋ `cpu.counter` 表 ＋ `cpu.difficulty` プリセット（config）
- **4-2** … `evaluateLanes`（レーンごとの脅威量）
- **4-3** … `chooseCounter`（相性表＋精度）＋ `choosePlacement`（前後）
- **4-4** … `decideCpu`（反応間隔・エナジー・ミス → コマンド/待機）
- **4-5** … `createRuntime` に CPU 組み込み（CPUデッキ＋毎フレーム決定→`applyDeploy(cpu)`）＋ headless で「プレイヤーの押しに反応して返す」を確認

## 要件との対応

| 要件 | 充足 |
|---|---|
| 要件4-1/2/3（脅威評価・カウンター・前線配置） | evaluateLanes / chooseCounter / choosePlacement |
| 要件4-5（適応・学習・探索を使わない） | ルールベースの相性表＋反応間隔 |
| 要件5-1/2/3（難易度ダイヤル・ミス・勝てる余地） | difficulty プリセット（reactionMs/accuracy/missChance） |
| 要件8（入力駆動） | CPU も `applyDeploy` を通す（プレイヤーと同じ入口） |
