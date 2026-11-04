# 設計書: ステージ 5-4（最終ボス・集大成）

## 概要

5-4 は既存の全フロー機能＋敵カード効果＋プレイヤー/敵の両カウンタを 1 枚に凝縮したラスボス。新規エンジン要素は **倍率オフセット `offset` の 1 点のみ**で、あとは既存機能（条件分岐・while/for ループ・倍率・種類指定・`counter`/`monster_counter` 加算・`monster` 倍率尊重・敵 guard/heal/reflect）の組み合わせで構成する。

技術的な主要判断：

1. **`×(1+count)` を `offset` で表す**：while ループが 4 周 → カウンタ値 4。必要倍率は `×5`。`multiplier:{counterRef, offset:1}` を新設し、倍率＝`カウンタ値 + offset` とすることで、**ループ前の種まきノードを置かずに手書き構成どおり**実装する（5-3 の種まき方式もこれに統一）。
2. **味方カウンタ `cP` と敵カウンタ `cE` の分離**：while ボディに `counter`(cP) と `monster_counter`(cE) を両方置き、毎周 +1。★[10] は `cP`、全敵攻撃は `cE` を参照する。counterId を分けるだけで既存の加算・解決機構がそのまま効く。

戦闘数値は 要件どおり **敵HP=415 / 自HP=100 / 手札15枚**。正解・全トラップ（8種）は `simulateBattle` ヘッドレス検証で確認済み（正解＝win、最終 自HP=5・敵HP=0 ちょうど、検算 415 一致）。

## アーキテクチャ

### コンポーネント（変更点）

| コンポーネント | 変更内容 | 対応要件 |
|--------------|---------|---------|
| `stagesLoader.isValidMultiplier` | `{counterRef, offset?}` を受理。offset は非負整数（省略可）。不正な offset は multiplier 全体を破棄 | 1-1, 1-3 |
| `battleStore.buildSlotMetadataFromStage` | counterRef 経路で `offset`（整数のとき）を slotMetadata に載せる | 1-1 |
| `simulateBattle`（倍率解決） | `counterRef` 分岐を `(counterValues[ref] ?? 0) + (meta.offset ?? 0)` に変更 | 1-1, 1-4 |
| `battleStore.scheduleNodePhase`（倍率解決） | 同上（sim と同一式） | 1-4 |
| `stages.json` `"5-4"` | 仮ステージを本フローに差し替え（敵HP415・手札15・10スロット・cP/cE 2カウンタ） | 3, 4 |
| `stages.json` `"5-3"` | 種まきノードを削除し ★ を `{counterRef:"cUp", offset:1}` に統一（挙動不変：cUp=4 → ×5） | 1-2 |

### データモデル（新/拡張）

- 倍率フィールド：`multiplier: { counterRef: string, offset?: number }`（offset 省略時 0）。
- 2 カウンタ：`counterValues: { cP: number, cE: number }`（ともに 0 初期、while ボディで +1）。

### 倍率解決（sim / live 共有）

```
multiplier =
  typeof meta.multiplier === 'number'  ? meta.multiplier                       // 固定倍率（×2 等）
: typeof meta.counterRef  === 'string' ? (counterValues[ref] ?? 0) + (offset ?? 0)  // カウンタ連動 + オフセット
: 1
```

## データフロー（5-4 の盤面）

`m=敵攻撃 / r=敵カウンター / g=敵防御 / h=敵回復 / cP=味方パワーアップ / cE=敵パワーアップ / ★=攻撃×(1+cP)`

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 360" font-family="monospace" font-size="11">
  <style>
    .p{fill:#dfd;stroke:#484}.m{fill:#fdd;stroke:#a44}.c{fill:#ffd;stroke:#aa4}.n{fill:#eef;stroke:#557}
    .cp{fill:#fde;stroke:#a4a}.ce{fill:#eef;stroke:#44a}.t{fill:#222}
  </style>
  <!-- row1 -->
  <g text-anchor="middle">
    <rect class="n" x="6"   y="14" width="96" height="34"/><text class="t" x="54"  y="28">[1]が攻撃?</text><text class="t" x="54" y="42">t→g15 / f→m45</text>
    <rect class="p" x="116" y="16" width="34" height="28"/><text class="t" x="133" y="34">[1]</text>
    <rect class="m" x="160" y="16" width="44" height="28"/><text class="t" x="182" y="34">m35</text>
    <rect class="n" x="214" y="14" width="96" height="34"/><text class="t" x="262" y="28">[2]が回復?</text><text class="t" x="262" y="42">t→h10 / f→m45</text>
    <rect class="m" x="322" y="16" width="26" height="28"/><text class="t" x="335" y="34">r</text>
    <rect class="p" x="356" y="16" width="34" height="28"/><text class="t" x="373" y="34">[2]</text>
    <rect class="m" x="398" y="16" width="44" height="28"/><text class="t" x="420" y="34">m25</text>
  </g>
  <!-- loop -->
  <g text-anchor="middle">
    <rect class="n" x="6"   y="84" width="96" height="30"/><text class="t" x="54"  y="103">while 自HP≥80</text>
    <rect class="cp" x="116" y="84" width="40" height="30"/><text class="t" x="136" y="103">cP+1</text>
    <rect class="ce" x="164" y="84" width="40" height="30"/><text class="t" x="184" y="103">cE+1</text>
    <rect class="p" x="212" y="86" width="34" height="26"/><text class="t" x="229" y="103">[3]</text>
    <rect class="m" x="254" y="82" width="64" height="32"/><text class="t" x="286" y="95">m5</text><text class="t" x="286" y="108">×(1+cE)</text>
    <rect class="p" x="328" y="86" width="34" height="26"/><text class="t" x="345" y="103">[4]</text>
    <rect class="m" x="370" y="86" width="40" height="26"/><text class="t" x="390" y="103">h5</text>
    <text class="t" x="430" y="103" text-anchor="start">↺ ×4周 → cP=cE=4</text>
  </g>
  <!-- after loop -->
  <g text-anchor="middle">
    <rect class="p" x="6"   y="150" width="34" height="26"/><text class="t" x="23"  y="167">[5]</text>
    <rect class="m" x="48"  y="146" width="64" height="32"/><text class="t" x="80"  y="159">m15</text><text class="t" x="80" y="172">×(1+cE)</text>
    <rect class="n" x="122" y="148" width="92" height="28"/><text class="t" x="168" y="165">自HP≤10? f→r</text>
    <rect class="p" x="226" y="150" width="54" height="26"/><text class="t" x="253" y="167">[6]×2</text>
    <rect class="m" x="292" y="146" width="64" height="32"/><text class="t" x="324" y="159">m10</text><text class="t" x="324" y="172">×(1+cE)</text>
    <text class="t" x="370" y="167" text-anchor="start">┄ 改行 ┄</text>
  </g>
  <!-- for -->
  <g text-anchor="middle">
    <rect class="n" x="6"   y="212" width="48" height="30"/><text class="t" x="30"  y="231">for ×2</text>
    <rect class="n" x="64"  y="210" width="96" height="34"/><text class="t" x="112" y="224">[7]が攻撃?</text><text class="t" x="112" y="238">t→g10 / f→h20</text>
    <rect class="p" x="170" y="212" width="34" height="26"/><text class="t" x="187" y="229">[7]</text>
    <rect class="m" x="212" y="208" width="64" height="32"/><text class="t" x="244" y="221">m5</text><text class="t" x="244" y="234">×(1+cE)</text>
  </g>
  <!-- tail -->
  <g text-anchor="middle">
    <rect class="p" x="6"   y="282" width="34" height="26"/><text class="t" x="23"  y="299">[8]</text>
    <rect class="m" x="48"  y="278" width="64" height="32"/><text class="t" x="80"  y="291">m10</text><text class="t" x="80" y="304">×(1+cE)</text>
    <rect class="n" x="122" y="280" width="96" height="30"/><text class="t" x="170" y="299">[9]が攻撃? f→m20×</text>
    <rect class="p" x="230" y="282" width="46" height="26"/><text class="t" x="253" y="299">[9]×2</text>
    <rect class="m" x="286" y="278" width="64" height="32"/><text class="t" x="318" y="291">m10</text><text class="t" x="318" y="304">×(1+cE)</text>
    <rect class="cp" x="360" y="276" width="70" height="36"/><text class="t" x="395" y="290">★[10]攻指</text><text class="t" x="395" y="304">×(1+cP)</text>
    <rect class="n" x="440" y="282" width="40" height="26"/><text class="t" x="460" y="299">GOAL</text>
  </g>
  <text class="t" x="6" y="340" text-anchor="start" fill="#a44">※ cP(味方)は★[10]のみ、cE(敵)は全敵攻撃に効く。どちらも while 4周で 4 → +offset1 で ×5。</text>
</svg>

## 実装方針

### `offset` の後方互換（要件1-2 / 6-1）
`offset` は任意フィールドで、省略時は `?? 0` で 0 に落ちる。既存の `{counterRef}`（4-3 等）は offset 無し → `counterValues[ref] + 0` ＝ 従来の `counterValues[ref]` と完全一致。検証で 4-3 系の倍率不変を確認。

### cP / cE の取り違え防止（要件2・作者の注意点）
味方 `counter`(cP) と敵 `monster_counter`(cE) は **counterId を分ける**だけで、加算（`scheduleNodePhase` / sim の `counter|monster_counter` 分岐）も解決（`counterRef`）も既存ロジックのまま別管理される。★[10] は `cP`、敵攻撃は `cE` を参照。数値上はこのステージでは cP=cE=4 で同値だが、意味（味方の力 / 敵の力）と `slotTypeIds`（味方・敵の両パワーアップマス解禁）を正しく分けるため別カウンタにする。

### 条件フェイントと HP 調整（要件4・5）
- 「[1]が攻撃?」「[9]が攻撃?」：攻撃を「見せる」と敵は防御（g）を選び、防げない大技 `m(45)`／倍率付き `m(20)` を回避する（代わりに攻撃は g 分だけ減る）。
- 「[2]が回復?」：回復を置くと `m(45)` が来ず高HPでループに入り周回不足 → 防20 を置いて HP15 でループに入れ、ちょうど 4 周に乗せる。
- 「自HP≤10?」false→r：[6] の攻撃を敢えて跳ね返させて HP を削り、以降の被弾計算を成立させる。

## 依存関係

| パッケージ | 用途 | 導入済み？ |
|----------|------|----------|
| （新規なし） | 既存の React Flow / zustand / 自作エンジンのみ | — |

## トレードオフと検討した代替案

- **決定内容**：`×(1+count)` を `multiplier.offset` で表す。
  **理由**：手書き構成どおり（ループ前の種まきノード無し）に実装でき、`×(1+count)` の意図を素直に表現。offset 無し既存ステージは完全後方互換。再利用性も高く、5-3 も同方式へ統一できる。
  **検討した代替案**：ループ前に `cP`/`cE` の種まきノードを各1個置く「seed 方式」（5-3 旧実装）。エンジン改修ゼロだが、手書きに無い locked ノードが 2 つ増え、最終ボスの盤面がさらに長くなるため不採用。
- **決定内容**：味方・敵カウンタを別 counterId で併存。
  **理由**：作者の意図（味方の力 / 敵の力を別々に育てる）と、ヘルプの味方/敵パワーアップマスの別解禁を正しく表すため。既存の加算・解決機構がそのまま使える。
