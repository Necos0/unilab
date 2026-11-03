# 設計: ユニット2「キャラ移動・交戦」

（親：`requirements.md` 要件 1・8 ／ ロードマップ：`plan.md`）

## 概要

ユニット（キャラ）をレーンに出し、探知距離で敵を見つけ、射程に収まるよう**前進または後退**し、交戦して本陣を削るまでの**純シミュレーション**を作る。DOM/React に依存しない（要件 8）。既存の 1 レーン版 `createLaneBattleEngine` が持つ交戦・特殊能力ロジックを、**レーン対応（同一レーン内で成立）**に移植する。

この段では**見た目（キャラの描画）は作らず、headless（自動対戦）で位置・HP・決着を数値確認**する。ユニットの視覚描画は、実際に配置操作ができるユニット3（配置 UI）と合流してからまとめて行う（早すぎる描画結合を避け、純シムをテスト可能に保つ）。

## スコープ

やること：
- `detectRange`（探知距離＝射程＋マージン）をユニット定義に追加。
- state にユニットを積む `spawnUnit` と、ユニット1体分のランタイム形。
- ターゲット選定（同一レーン・探知距離内の最寄り敵）。
- 移動：射程内なら攻撃、前方の敵には前進、後方の敵には後退、敵がいなければ本陣へ前進。
- 交戦：攻撃間隔、単体／範囲（splash）／貫通（pierce）、回復（heal）・鈍足（slow）・死亡爆弾（deathbomb）・死亡シールド（deathShield）を移植（同一レーン化）。
- 本陣ダメージと決着フラグ（`base.you/cpu.hp <= 0`）。
- `stepSim(state, dt)` で 1 ステップを進める純関数。

やらないこと（後続）：
- エナジー・デッキ・出撃カードの入力（ユニット3）／CPU（ユニット4）／制限時間・スコア（ユニット5）。
- キャラの視覚描画（ユニット3と合流）。乱数（RNG が要るのはデッキ・CPU＝ユニット3・4）。

## データモデル

### config 追加（`data/lanebattle_config.json`）
- `detectMargin`（数値）… 探知距離＝射程＋このマージン（「射程よりほんの少し長い」）。

### `deriveUnitDef` に追加（`engine/deriveUnitDef.js`）
- `detectRange: range + config.detectMargin`（overrides で個別上書き可）。

### `battleState` 拡張（`engine/battleState.js`）
- `t: 0`（経過ミリ秒。攻撃間隔・移動の積算に使う。制限時間判定はユニット5）。
- 死亡シールド用の陣営フラグ：`shield: { you:{ t:0, mul:1 }, cpu:{ t:0, mul:1 } }`（既存エンジンの youShield/cpuShield を集約）。
- `result: null`（決着。`'you'` / `'cpu'`。スコア・演出は後続）。

### ユニットのランタイム形（`spawnUnit` が `state.units` に積む）
```
{
  id, def,               // def = deriveUnitDef(id)
  side,                  // 'you' | 'cpu'
  lane,                  // 0 | 1 | 2
  x,                     // 仮想座標。配置スロット or 本陣端から
  hp, maxHp,
  atk, spd, range, detectRange, splash, pierce,
  healOnAttack, slowOnAttack, deathbomb, deathShield,
  atkInterval, atkTimer, // 攻撃間隔と残りタイマー
  slowT, slowMul,        // 被・鈍足の残り時間と倍率
  dead, deadT,           // 死亡フラグと死亡後経過（描画消しはユニット3合流時）
}
```

## インターフェース（案）

| 関数 | 役割 |
|---|---|
| `spawnUnit(state, { side, id, lane, x })` | ランタイムユニットを生成して `state.units` に積む |
| `findTarget(state, u)` | `u` と**同一レーン**で探知距離内の最寄り敵を返す（無ければ null） |
| `resolveAttack(state, u, target)` | 攻撃解決。単体／splash／pierce ＋ heal/slow（同一レーン内） |
| `dealDamage(state, target, amount)` | 被ダメ適用（陣営 shield を反映） |
| `stepSim(state, dt)` | 1 ステップ：全ユニットの移動・交戦、死亡処理、本陣ダメージ、決着判定 |

## 移動・交戦の判定（要件1-6/7/8 の中核）

`dir = side === 'you' ? +1 : -1`（自分は +x へ進む）。各ユニットの毎ステップ：

<svg viewBox="0 0 900 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="各ユニットの1ステップの判定フロー（黄=判定）">
  <defs><marker id="ar2" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#6b7a92"/></marker></defs>
  <rect x="390" y="12" width="120" height="32" rx="8" fill="#e6efff" stroke="#5b7fc4" stroke-width="2"/>
  <text x="450" y="33" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">1ステップ</text>
  <rect x="325" y="64" width="250" height="46" rx="8" fill="#fff6e6" stroke="#e0b24a" stroke-width="1.5"/>
  <text x="450" y="92" font-family="sans-serif" font-size="11.5" fill="#1f2a3d" text-anchor="middle">同レーンの探知内に敵がいる?</text>
  <rect x="140" y="152" width="200" height="44" rx="8" fill="#fff6e6" stroke="#e0b24a" stroke-width="1.5"/>
  <text x="240" y="179" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">距離 ≤ 射程?</text>
  <rect x="560" y="152" width="200" height="44" rx="8" fill="#fff6e6" stroke="#e0b24a" stroke-width="1.5"/>
  <text x="660" y="179" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">本陣が射程内?</text>
  <rect x="30" y="244" width="150" height="38" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="105" y="267" font-family="sans-serif" font-size="11.5" fill="#1f2a3d" text-anchor="middle">攻撃（間隔管理）</text>
  <rect x="196" y="244" width="150" height="38" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="271" y="267" font-family="sans-serif" font-size="11.5" fill="#1f2a3d" text-anchor="middle">前進して詰める</text>
  <rect x="362" y="244" width="150" height="38" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="437" y="267" font-family="sans-serif" font-size="11.5" fill="#1f2a3d" text-anchor="middle">後退して収める</text>
  <rect x="560" y="244" width="150" height="38" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="635" y="267" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">本陣を攻撃</text>
  <rect x="726" y="244" width="150" height="38" rx="8" fill="#eef2f9" stroke="#9fb0cc" stroke-width="1.5"/>
  <text x="801" y="267" font-family="sans-serif" font-size="12" fill="#1f2a3d" text-anchor="middle">本陣へ前進</text>
  <path d="M450,44 L450,62" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar2)"/>
  <path d="M400,110 L302,150" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar2)"/>
  <text x="338" y="128" font-family="sans-serif" font-size="10" fill="#6b7a92" text-anchor="middle">いる</text>
  <path d="M500,110 L598,150" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar2)"/>
  <text x="562" y="128" font-family="sans-serif" font-size="10" fill="#6b7a92" text-anchor="middle">いない</text>
  <path d="M210,196 L132,242" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar2)"/>
  <text x="150" y="222" font-family="sans-serif" font-size="10" fill="#6b7a92" text-anchor="middle">はい</text>
  <path d="M245,196 L268,242" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar2)"/>
  <text x="272" y="222" font-family="sans-serif" font-size="10" fill="#6b7a92" text-anchor="middle">前方</text>
  <path d="M300,196 L418,242" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar2)"/>
  <text x="382" y="222" font-family="sans-serif" font-size="10" fill="#6b7a92" text-anchor="middle">後方</text>
  <path d="M642,196 L638,242" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar2)"/>
  <text x="660" y="222" font-family="sans-serif" font-size="10" fill="#6b7a92" text-anchor="middle">はい</text>
  <path d="M700,196 L790,242" fill="none" stroke="#6b7a92" stroke-width="1.5" marker-end="url(#ar2)"/>
  <text x="758" y="222" font-family="sans-serif" font-size="10" fill="#6b7a92" text-anchor="middle">いいえ</text>
</svg>

- 「前方／後方」は符号付き距離 `(target.x - u.x) * dir` の正負で判定（正＝敵陣側＝前方、負＝自陣側＝後方）。
- **後退**は `u.x` を自陣側（`-dir`）へ動かして、後ろに回り込まれた敵・すれ違った敵を射程に収め直す（要件1-8）。

## 実装方針

- **純関数・DOM非依存**。`stepSim` は `state` と `dt` だけで決まる（要件8）。乱数は使わない。
- **特殊能力の移植**：既存 `createLaneBattleEngine` の `resolveAttack`／`dealDamage`／死亡処理をベースに、`splash`・`pierce`・`deathbomb` の対象探索に **`o.lane === u.lane`（同一レーン）** の条件を足す（要件1-5）。`healOnAttack`（味方回復）・`slowOnAttack`（敵鈍足）・`deathShield`（陣営被ダメ軽減）は既存挙動を踏襲（対象範囲＝全体か同レーンかは実装時に確認）。
- **本陣**：敵ユニットがおらず本陣が射程内なら本陣 HP を削る。`config.base.defense`（最終防衛）でレードをまたいで最寄り敵を撃つ処理は、このユニットの最後で足すか、CPU 実装時に回す（設計時に決める）。
- **決着**：`base.you.hp <= 0` → `result='cpu'`、`base.cpu.hp <= 0` → `result='you'`。演出・スコアは後続ユニット。
- **検証**：headless の自動対戦ハーネスで、両陣営に数体ずつ `spawnUnit` し、`stepSim` を固定 dt で回して「近接が遠距離に近づいて倒す」「後方に置いた敵に後退して対応する」「本陣が削れて決着する」を数値で確認する（一時ファイルは後片付け）。

## ブロック分割（block-review 用）

- **2-1**：`config.detectMargin` 追加 ＋ `deriveUnitDef` に `detectRange`
- **2-2**：`battleState` 拡張（`t` / `shield` / `result`）＋ `spawnUnit`（ランタイム形）
- **2-3**：`findTarget` ＋ 移動（前進／後退／本陣へ）
- **2-4**：交戦（`atkTimer`・`resolveAttack`：単体／splash／pierce ＋ heal/slow、`dealDamage`、死亡処理／deathbomb／deathShield、本陣ダメージ、決着フラグ）
- **2-5**：`stepSim` 統合 ＋ headless 検証（位置・HP・決着を数値確認）

各ブロックは着手前に計画（コード）を出して承認を得る。

### 実装状況（2026-09-08 時点）

全ブロック完了（✅ 2-1 detectRange / 2-2 battleState・spawnUnit / 2-3 findTarget・stepUnits / 2-4a resolveAttack / 2-4b stepUnits統合 / 2-4c stepBaseDefense / 2-4d processDeaths / 2-5 stepSim）。
レーン範囲は3軸をデータ駆動化：`laneReach`（検知）／`supportAllLanes`（回復・鈍足）／`attackAllLanes`（範囲・貫通）。
headless 自動対戦で「移動・交戦・死亡・同レーン範囲・本陣ダメージ・本陣防衛・決着」を数値確認済み。
（バランス観察：単体の近接は本陣防衛の射程外から削れないため本陣を割れない＝数値調整の余地。挙動は正常。）

## 要件との対応

| 要件 | このユニットでの充足 |
|---|---|
| 要件1-3/4（レーン内前進・交戦） | 移動・交戦（同一レーン） |
| 要件1-5（splash 同レーン） | resolveAttack に lane 条件 |
| 要件1-6/7/8（探知・前進・後退） | detectRange＋符号付き距離での前進/後退 |
| 要件6（本陣） | 本陣ダメージ・決着フラグ |
| 要件8（分離・決定的） | 純関数 stepSim、乱数なし、headless 検証 |
