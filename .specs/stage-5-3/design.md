# 設計書: ステージ 5-3（カウンター・パワーアップ）

## 概要

5-3 の核は **「ループ回数で威力が増える敵の大技（★）を、プレイヤーのカウンター（reflect）で反射して大ダメージにして返す」** 読み合い。これを実現するため、既存の `loop-counter` 機構（4-3 で確立した「カウンタ加算ノード＋`{counterRef}` 連動倍率スロット」）を **敵攻撃 `monster` 側へ拡張** する。

技術的な主要判断は 3 つ：

1. **`monster` が倍率を尊重する**：従来 `monster` は倍率無視（常に ×1）だった。★＝`monster`(power 25) に `multiplier:{counterRef:"cUp"}` を効かせ、`25 × カウンタ値` のダメージにする。`attack` の倍率解決と完全に対称な実装にする。
2. **`monster_counter`（敵パワーアップカード）＝カウンタ加算ノード**：`counter` カードと同じく「通過のたびに `counterValues[counterId]` を +1 する・HP は変えない」挙動。画像 `public/cards/monster_counter.png`、id は `monster_counter`。
3. **「★＝×(ループ回数+1)」のための複数シード**：ループは「自HP≥70 で脱出」の設計上ちょうど 4 周する。★ は ×5 が必要（25×5=125）。そこで **ループ前に 1 回・ループ内に毎周 1 回** の計 2 つの `monster_counter` ノードを同一 `counterId:"cUp"` に積む（1 + 4 = 5）。`counter` と違い `monster_counter` は同一 counterId の複数配置を正当な仕様として許可する。

戦闘数値は 要件どおり **敵HP=345 / 自HP=100 / 手札12枚**。正解・全トラップは `simulateBattle` ヘッドレス検証で確認済み（正解＝win、各トラップ＝lose、最終 自HP=25・敵HP=0 ちょうど）。

## アーキテクチャ

### コンポーネント（変更点のみ）

| コンポーネント | 変更内容 | 対応要件 |
|--------------|---------|---------|
| `simulateBattle.applyNodeEffect` | `monster` 分岐を `card.power * mult` に変更（反射→敵 / シールド吸収 / 素通りで自分、の3経路すべてに倍率適用）。`monster_counter` は専用分岐を持たず state 不変 | 1-1 |
| `simulateBattle`（走査ループ） | カウンタ加算条件を `card.id === 'counter' || card.id === 'monster_counter'` に拡張 | 1-2 |
| `battleStore.scheduleNodePhase` | sim と同一に `monster` 倍率尊重・`monster_counter` カウンタ加算を live 実装 | 1-2 |
| `battleStore.initializeBattle` | `counterValues` 収集フィルタに `monster_counter` を追加（counterId を 0 で初期化） | 1-2 |
| `stagesLoader.validateCounterPairs` | `monster_counter` の counterId を `seenCounterIds` に **登録のみ**（重複縮退しない）。これで ★ の `counterRef:"cUp"` が浮遊参照判定で消されない／複数シードを許可 | 1-1, 3-2 |
| `card_help.json` | `monster_counter` の説明（ふりがな付き）を追加 | 1-4 |
| `stages.json` `"5-3"` | 仮ステージを本フローに差し替え（敵HP 345・手札12・10スロット） | 2, 3 |

### データモデル

**フロー要素（`stages.json` の `flow`）で新たに使う形：**

- カウンタ加算（敵パワーアップ）ノード：`{ "lockedCard": { "id": "monster_counter", "counterId": "cUp" } }`
- カウンタ連動倍率を持つ敵攻撃（★）：`{ "lockedCard": { "id": "monster", "power": 25 }, "multiplier": { "counterRef": "cUp" } }`

**ランタイムの派生データ（battleStore / ヘッドレス共通）：**

- `counterValues: { cUp: number }` … 初期値 0。`monster_counter` 通過で +1。
- `slotMetadata[★slotId] = { counterRef: "cUp" }` … 倍率をカウンタ値で動的解決。

### 倍率の解決（sim / live 共有の三分岐）

```
multiplier =
  typeof meta.multiplier === 'number'  ? meta.multiplier            // 固定倍率（×3 等）
: typeof meta.counterRef  === 'string' ? (counterValues[ref] ?? 0)  // カウンタ連動（★）
: 1
```

`monster` もこの `multiplier` を受け取り `power * multiplier` で解決する（従来は受け取っても無視していた）。

## データフロー（5-3 の盤面）

`m=敵攻撃 / r=敵カウンター(monster_reflect) / cUp=パワーアップ(monster_counter) / ★=m25×cUp`

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 300" font-family="monospace" font-size="12">
  <style>
    .n{fill:#eef;stroke:#557;rx:4}.p{fill:#dfd;stroke:#484}.m{fill:#fdd;stroke:#a44}
    .c{fill:#ffd;stroke:#aa4}.t{fill:#333}.e{stroke:#889;fill:none;marker-end:url(#a)}
  </style>
  <defs><marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#889"/></marker></defs>
  <!-- row1 -->
  <g text-anchor="middle">
    <rect class="p" x="10"  y="20" width="54" height="26"/><text class="t" x="37"  y="37">[1]防指</text>
    <rect class="m" x="80"  y="20" width="46" height="26"/><text class="t" x="103" y="37">m45</text>
    <rect class="m" x="142" y="20" width="36" height="26"/><text class="t" x="160" y="37">r</text>
    <rect class="p" x="194" y="20" width="40" height="26"/><text class="t" x="214" y="37">[2]</text>
    <rect class="m" x="250" y="20" width="46" height="26"/><text class="t" x="273" y="37">m40</text>
    <rect class="c" x="312" y="20" width="54" height="26"/><text class="t" x="339" y="37">cUp</text>
    <rect class="n" x="382" y="14" width="120" height="38"/><text class="t" x="442" y="30">while 自HP≥70</text><text class="t" x="442" y="44">脱出</text>
    <text class="t" x="560" y="30">body: cUp→[3]防指</text><text class="t" x="560" y="44">→m20→[4]（×4周）</text>
  </g>
  <!-- row2 -->
  <g text-anchor="middle">
    <rect class="p" x="10"  y="110" width="40" height="26"/><text class="t" x="30"  y="127">[5]</text>
    <rect class="m" x="66"  y="104" width="70" height="38"/><text class="t" x="101" y="120">★ m25</text><text class="t" x="101" y="134">×cUp(=5)</text>
    <rect class="n" x="152" y="110" width="96" height="26"/><text class="t" x="200" y="127">自HP≤20? →r</text>
    <rect class="p" x="264" y="110" width="54" height="26"/><text class="t" x="291" y="127">[6]攻×3</text>
    <text class="t" x="400" y="127">┄ 改行（newline）┄</text>
  </g>
  <!-- row3 -->
  <g text-anchor="middle">
    <rect class="p" x="10"  y="200" width="40" height="26"/><text class="t" x="30"  y="217">[7]</text>
    <rect class="m" x="66"  y="200" width="46" height="26"/><text class="t" x="89"  y="217">m15</text>
    <rect class="p" x="128" y="200" width="54" height="26"/><text class="t" x="155" y="217">[8]×2</text>
    <rect class="m" x="198" y="200" width="46" height="26"/><text class="t" x="221" y="217">m15</text>
    <rect class="p" x="260" y="200" width="54" height="26"/><text class="t" x="287" y="217">[9]攻指</text>
    <rect class="m" x="330" y="200" width="42" height="26"/><text class="t" x="351" y="217">m5</text>
    <rect class="n" x="388" y="200" width="96" height="26"/><text class="t" x="436" y="217">自HP≤25? →r</text>
    <rect class="p" x="500" y="200" width="60" height="26"/><text class="t" x="530" y="217">[10]攻×4</text>
    <rect class="n" x="576" y="200" width="46" height="26"/><text class="t" x="599" y="217">GOAL</text>
  </g>
  <text class="t" x="10" y="70" text-anchor="start" fill="#a44">※ cUp は「ループ前 1 回＋ループ内 4 周」で 5 に達し、★＝25×5＝125 を [5]reflect で敵へ返す</text>
  <text class="t" x="10" y="90" text-anchor="start" fill="#a44">※ 自HP≤20?/≤25? が false だと r が立ち、[6]/[10] の攻撃が自分へ跳ね返る（HP調整と火力管理の読み合い）</text>
</svg>

## 実装方針

### `monster` の倍率尊重（要件1-1）
`attack`/`finisher` と同じく最初に `const mdmg = card.power * mult;` を計算し、反射（敵へ）・シールド吸収・素通り（自分へ）の 3 経路すべてで `mdmg` を使う。倍率未指定スロットでは `mult=1` となり従来挙動と完全一致（★以外の全 `monster` は非回帰）。

### `monster_counter` の二重定義許可（要件1-1 / 3-2）
`validateCounterPairs` は `counter` の重複 counterId を「作者ミス」として縮退するが、`monster_counter` では **同一 counterId の複数配置がデザイン上正当**（ループ前シード＋ループ内加算）。そのため `monster_counter` は counterId を登録するだけで縮退しない。これにより ★ の `counterRef` が第2ループの浮遊参照判定で誤って `delete` されない。

### 「×(ループ回数+1)」の実現（要件3-2 / 4-3）
正解手順ではループが 4 周し、ループ内 `monster_counter` だけだと cUp=4（★=100）で火力不足（345 に 25 届かない）。ループ **前** に `monster_counter` を 1 つ置いて cUp=1 を先付けし、合計 cUp=5（★=125）にする。`offset` 付き倍率などの新フィールドを増やさず、既存のカウンタ機構だけで実現できる最小の方法を採用した（下記トレードオフ参照）。

### HP 管理ゲート（要件3-4 / 3-6）
「自HP≤20?」「自HP≤25?」は false だと `monster_reflect` が立ち、直後の攻撃指定マス（[6]/[10]）が自分へ跳ね返る。正解では ★反射後の自HP=80 → [6]×3=30 が跳ね返って自HP=50（ここは敢えて跳ね返させて HP を削る）、その後 m15/m15/m5 を受けて自HP=25 ちょうどで「≤25?」を true にし、[10]×4=140 を敵へ通す。火力と被弾の両立が解の肝。

## 依存関係

| パッケージ | 用途 | 導入済み？ |
|----------|------|----------|
| （新規なし） | 既存の React Flow / zustand / 自作エンジンのみ | — |

## トレードオフと検討した代替案

- **決定内容**：★の ×5 を「ループ前 `monster_counter` シード 1 ＋ ループ内 4」で作る。
  **理由**：既存の `monster_counter`／`counterRef` だけで完結し、エンジンに新フィールドを足さない。盤面上も「敵が最初に 1 回ためてからループでさらにためる」と自然に読める。
  **検討した代替案**：
  1. `multiplier:{counterRef, offset:1}` の **offset 新設**。「×(ループ回数+1)」を字面どおり表現できるが、`isValidMultiplier`・`slotMetadata`・sim/live の倍率解決の 4〜5 箇所を改修する必要があり、ステージ 1 個のために汎用機構を増やすのは過剰と判断。
  2. ループ脱出しきい値を上げて 5 周にする。しかし作者指定の「自HP≥70 で脱出」を崩すため不可。
  3. `counter` カードの初期値を 1 にする。他ステージ（4-3）の 0 始まり前提を壊すため不可。

- **決定内容**：敵 `monster` も倍率を尊重する（従来は無視）。
  **理由**：★ の土台。`attack` と対称にすることで sim/live のドリフト検出（`scheduleComplete` の整合 warn）がそのまま効く。
  **非回帰**：既存ステージで `monster` に倍率が付く箇所は皆無（検証済み）。全 `monster` は `mult=1` で従来どおり。
