# 設計: ユニット4「反応型CPU」

（親：`requirements.md` 要件 4・5 ／ ロードマップ：`plan.md`）

## 概要

敵（CPU）を、ランダムではなく**プレイヤーの手に反応**して戦う相手にする。中核は「①各レーンの脅威を評価 → ②いちばん危険なレーンを選ぶ → ③脅威の主属性からカウンター表で返す属性を決める → ④手札から該当カードを選ぶ → ⑤前後どこに置くか → ⑥`applyDeploy`（側=cpu）」。適応・学習・探索は使わず、**ルールベースの反応**で成立させる（要件4-5）。「賢さ」は、プレイヤーが必ず先に出す＝手を見せるので、それに的確に答えることで生まれる。

キャラ対応（群れ↔範囲攻撃、遠距離↔近接 等）は**属性＋カウンター表というデータ**で表現し、コードを書き換えずに詰められるようにする。属性の多くは既存の数値（`splash`/`pierce`/`range`）から**導出**するので、多属性（遠距離かつ範囲＝squid）も手管理なしで自動的に成立する。難易度は数値ダイヤル（反応速度・精度・エナジー）で、ユニット6の難易度選択がプリセットとして束ねる。

## スコープ

やること：
- ユニットの**属性**を用意：`aoe`（範囲攻撃）と `ranged`（遠距離）は `splash`/`pierce`/`range` から**導出**、`swarm`（群れ）だけ明示フラグ。硬さ/火力は `hp`/`atk` の数値で判断。
- config に**属性判定の閾値**・**カウンター表**（脅威属性→返す属性）・**難易度プリセット**。
- CPU 思考 `cpuBrain`：脅威評価・脅威分類・カウンター選択・前後配置・意思決定（反応間隔・エナジー・わざとミス）。
- 駆動（`createRuntime`）に CPU を組み込む（CPU デッキ＋毎フレーム意思決定→`applyDeploy(側=cpu)`）。

やらないこと（後続）：
- 難易度**選択 UI**（ユニット6。ここでは既定プリセットで動かす）。
- スコア・制限時間・結果画面（ユニット5）／本編組み込み（ユニット7）。
- 群れ出撃（starfish=1枚でN体）は**ユニット能力**（`spawnUnit`/`applyDeploy` に体数を足す）で、CPUとは独立。CPU は実ユニット数で脅威を見るので群れは自然に「N体分の圧」として反応される。

## データモデル

### ユニットの属性（多くは導出）
- **`aoe`**（bool・導出）… `splash > 0 || pierce`。範囲攻撃を持つか。
- **`ranged`**（bool・導出）… `range >= config.cpu.attr.rangedRange`。遠距離か。
- **`swarm`**（bool・フラグ）… `lanebattle_units.json` の override（既定 false）。単体statから導けないので明示。
- 硬さ・火力は `hp` / `atk` の数値で判断（脅威評価・"tanky"/"dps" の閾値は config）。

→ これで squid は「`ranged` かつ `aoe`」が自動成立。多属性は導出で解決。

### config への追加（`lanebattle_config.json` の `cpu`。既存フィールドは残す）
```json
"attr": { "rangedRange": 100, "dpsAtk": 30, "tankyHp": 100, "fastSpd": 80 },
"counter": {
  "swarm":  "aoe",
  "ranged": "fastMelee",
  "dps":    "tanky",
  "other":  "dps"
},
"difficulty": {
  "normal": { "reactionMs": 900, "accuracy": 0.7, "energyRegenMul": 1.2, "missChance": 0.15 }
}
```
- `attr` … 属性判定の閾値。`counter` … 脅威の主属性 → 返す属性（値は「返す属性の選び方」を表す）。`difficulty` … 難易度プリセット。

### 「返す属性」の意味（`counter` の値）
- `aoe` … `aoe` を持つカード（範囲で群れを薙ぐ）
- `fastMelee` … `!ranged` かつ `spd >= fastSpd` の近接（懐に入って遠距離を潰す）
- `tanky` … `hp >= tankyHp` の壁（高火力単体を受け止める）
- `dps` … `atk` の高いカード（素直に押す・壁を溶かす）

## インターフェース（`engine/cpuBrain.js`）

| 関数 | 役割 |
|---|---|
| `evaluateLanes(state)` | 各レーンのプレイヤー脅威量を配列で返す（`atk` 重み中心＝壁 atk~0 は低優先） |
| `classifyThreat(units)` | そのレーンの脅威の**主属性**（優先 `swarm` > `ranged` > `dps` > `other`）を返す |
| `pickAnswer(answerAttr, hand, energy)` | 「返す属性」に合う**出せる最安カード**の手札 index を返す。無ければ **-1**（＝良い手なし。安カードのジャンク出撃はしない） |
| `choosePlacement(cardDef)` | 選んだカードが `ranged` なら**後方(0)**＝自陣深くからカイト、近接/範囲なら**前線(2)**＝迎撃 |
| `decideCpu(brain, state, dt, diff, rng)` | **方針**：良い手が出せれば出す／良い手が無く脅威が切迫もしていなければ**貯める**／切迫なら妥協して受ける／脅威ゼロ＋エナジー潤沢なら**カウンター攻め**。反応間隔・`accuracy`・`missChance` もここ |

`decideCpu` が返したコマンドを駆動が `applyDeploy(state, {side:'cpu', ...})` に流す。CPU の乱数（精度・ミス・間隔ゆらぎ）は今は駆動層の `Math.random`（PvP 用の seed 付きは後続）。

## CPU の意思決定フロー

<svg viewBox="0 0 900 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="反応型CPUの意思決定フロー">
  <defs><marker id="ac4" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#6b7a92"/></marker></defs>
  <rect x="30" y="36" width="250" height="46" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="155" y="63" font-family="sans-serif" font-size="12.5" fill="#1f2a3d" text-anchor="middle">① 各レーンの脅威を評価</text>
  <rect x="325" y="36" width="250" height="46" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="450" y="63" font-family="sans-serif" font-size="12.5" fill="#1f2a3d" text-anchor="middle">② いちばん危険なレーンを選ぶ</text>
  <rect x="620" y="36" width="250" height="46" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="745" y="57" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">③ 脅威の主属性 →</text>
  <text x="745" y="73" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">カウンター表で返す属性</text>
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

- **属性はほぼ導出**（`aoe`=splash/pierce、`ranged`=range）。多属性が自動で成立し、手タグは `swarm` だけ。カウンターは**属性関係のデータ表**（`cpu.counter`）で、マッチアップは表の充実で足せる。
- **脅威評価は `atk` 重み中心**：壁（atk~0 のゴーレム等）は脅威が小さく低優先＝CPU が孤立した壁に過剰反応しない（ご指摘反映）。
- **カウンター関係**：swarm→`aoe`（範囲で薙ぐ）／ranged→`fastMelee`（懐に入る）／高火力単体(dps)→`tanky`（硬い壁で受ける）／その他→`dps`。tank（壁）は"返し役"ではなく、"高火力単体を受ける時だけ有効"＋"押し込みの道具"。
- **貯める/攻めるの方針（`decideCpu`）**：良い手（該当カウンターが買える）時だけ出す。良い手が無く脅威が切迫していなければ**出さずにエナジーを貯める**（安カードのジャンク出撃をしない）。脅威が本陣に迫れば妥協して受ける。脅威ゼロ＋エナジー潤沢なら一番押せるレーンへ**カウンター攻め**（簡易版。受け→攻めの本格的な波状攻撃は playtest 後の refine）。
- **配置**：遠距離は自陣**後方**（カイトで一方的に削る）、近接/範囲は**前線**（迎撃）。
- **難易度ダイヤル**：`reactionMs`・`accuracy`・`energyRegenMul`・`missChance`。無敵にしない（要件5-3）。
- **決定性**：CPU の乱数は今は駆動層の `Math.random`。純シム `stepSim` は決定的なまま。

## ブロック分割（block-review 用）

- **4-1** … 属性の導出（`aoe`/`ranged`）＋ `swarm` フラグ ＋ config（`attr` 閾値・`counter` 表・`difficulty` プリセット）
- **4-2** … `evaluateLanes`（脅威量）＋ `classifyThreat`（主属性）
- **4-3** … `pickAnswer`（返す属性→カード選択）＋ `choosePlacement`（前後）
- **4-4** … `decideCpu`（反応間隔・エナジー・ミス → コマンド/待機）
- **4-5** … `createRuntime` に CPU 組み込み ＋ headless で「プレイヤーの押しに反応して返す」を確認

## 要件との対応

| 要件 | 充足 |
|---|---|
| 要件4-1/2/3（脅威評価・カウンター・前線配置） | evaluateLanes / classifyThreat＋pickAnswer / choosePlacement |
| 要件4-5（適応・学習・探索を使わない） | ルールベースの属性カウンター＋反応間隔 |
| 要件5-1/2/3（難易度ダイヤル・ミス・勝てる余地） | difficulty プリセット（reactionMs/accuracy/missChance） |
| 要件8（入力駆動） | CPU も `applyDeploy` を通す（プレイヤーと同じ入口） |

## 実装状況（2026-09-12 時点）

全ブロック完了（✅ 4-1 属性導出＋config / 4-2 脅威評価・分類 / 4-3 カウンター選択・前後配置 / 4-4a 切迫・任意選択ヘルパー / 4-4b decideCpu / 4-5 createRuntime 結線）。
新規：`engine/cpuBrain.js`。config.cpu：`attr`（属性閾値）・`counter`（相性表）・`difficulty`（プリセット）・`urgentDist`・`pushEnergyFrac`。
検証：headless で「プレイヤーが shark を押す→CPU が lane に crab（壁）を出して受ける」を確認。
実プレイ知見（検証で調整）：`tankyHp` を 100→60（crab を壁として認める）／`decideCpu` は「エナジー上限近くは貯め込まず妥協して出す」に微修正（過剰な受け身を防止）。数値・相性は playtest で継続調整。
別途、味方同士の追い越し禁止（`stepUnits` の `moveToward`＋`stackGap`）を導入し、壁→後衛の陣形を維持。
