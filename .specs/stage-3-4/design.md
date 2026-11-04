# 設計書: ステージ 3-4（差し替え・カウンターと分岐読み）

## 概要

ワールド3の最終ステージを「敵HP条件の分岐＋カウンター反射」のパズルへ差し替える。新規エンジン要素は **条件分岐マスのバフ透過（構造マス化）1 点のみ**で、あとは既存機能（条件分岐・monster 攻撃・guard/reflect・merge 透過）の組み合わせで構成する。

技術的な主要判断：

1. **条件分岐マスをバフ透過にする**：既存の `clearTransientBuffs`（sim）と `battleStore` のエッジ処理（live）は、カードを持たない構造ノードのうち `merge` のみバフを透過していた。ここに `condition` を加え、`merge || condition` を透過扱いにする。これで「⑦カウンター → ◇敵HP>70 → m(28) を反射」が成立する。

戦闘数値は 要件どおり **敵HP=95 / 自HP=95 / 手札10枚**。正解・全5トラップは `simulateBattle` ヘッドレス検証で確認済み（正解＝win、最終 自HP=1・敵HP=0、反射で m(28)+m(29)=57＋攻撃 7+7+25=39 ＝ 96 ≥ 95）。

## アーキテクチャ

### コンポーネント（変更点）

| コンポーネント | 変更内容 | 対応要件 |
|--------------|---------|---------|
| `simulateBattle.clearTransientBuffs` | 透過条件を `prevNodeType === 'merge' \|\| prevNodeType === 'condition'` に拡張 | 1-1, 1-2 |
| `battleStore`（エッジフェーズのバフ解除） | `isPrevMerge` → `isPrevTransparent`（`merge` / `condition`）に拡張（sim と対称） | 1-2 |
| `stages.json` `"3-4"` | 旧ステージ（lagiacrus/HP50）を本フロー（HP95・手札10・条件3つ）に差し替え | 2, 3 |

### データモデル

新規フィールドは無し。既存の `flow` DSL（`{condition, label, true, false}` の自動 merge、`lockedCard: {id:"monster", power}`、プレイヤースロット `{id:"pN"}`）のみで構成。

## データフロー（3-4 の盤面）

`m=敵攻撃。[n]=プレイヤーマス。○=true / ×=false`

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 300" font-family="monospace" font-size="11">
  <style>.p{fill:#dfd;stroke:#484}.m{fill:#fdd;stroke:#a44}.n{fill:#eef;stroke:#557}.t{fill:#222}</style>
  <g text-anchor="middle">
    <rect class="p" x="6"   y="20" width="30" height="26"/><text class="t" x="21"  y="37">[1]</text>
    <rect class="m" x="46"  y="20" width="34" height="26"/><text class="t" x="63"  y="37">m5</text>
    <rect class="n" x="90"  y="18" width="78" height="30"/><text class="t" x="129" y="37">敵HP≦85?</text>
    <rect class="p" x="178" y="4"  width="30" height="22"/><text class="t" x="193" y="19">[2]</text>
    <rect class="m" x="212" y="4"  width="34" height="22"/><text class="t" x="229" y="19">m11</text>
    <text class="t" x="258" y="19" text-anchor="start">(○)</text>
    <rect class="p" x="178" y="40" width="30" height="22"/><text class="t" x="193" y="55">[3]</text>
    <rect class="m" x="212" y="40" width="34" height="22"/><text class="t" x="229" y="55">m21</text>
    <rect class="m" x="250" y="40" width="34" height="22"/><text class="t" x="267" y="55">m25</text>
    <rect class="p" x="288" y="40" width="30" height="22"/><text class="t" x="303" y="55">[4]</text>
    <text class="t" x="328" y="55" text-anchor="start">(×)</text>
  </g>
  <g text-anchor="middle">
    <rect class="m" x="6"   y="100" width="34" height="26"/><text class="t" x="23"  y="117">m22</text>
    <rect class="p" x="48"  y="100" width="30" height="26"/><text class="t" x="63"  y="117">[5]</text>
    <rect class="n" x="86"  y="98" width="78" height="30"/><text class="t" x="125" y="117">敵HP&gt;75?</text>
    <rect class="p" x="174" y="84" width="30" height="22"/><text class="t" x="189" y="99">[6]</text>
    <rect class="m" x="208" y="84" width="30" height="22"/><text class="t" x="223" y="99">m9</text>
    <text class="t" x="248" y="99" text-anchor="start">(○)</text>
    <rect class="m" x="174" y="118" width="34" height="22"/><text class="t" x="191" y="133">m12</text>
    <text class="t" x="214" y="133" text-anchor="start">(×)</text>
  </g>
  <g text-anchor="middle">
    <rect class="m" x="6"   y="178" width="34" height="26"/><text class="t" x="23"  y="195">m31</text>
    <rect class="p" x="48"  y="178" width="30" height="26"/><text class="t" x="63"  y="195">[7]★</text>
    <rect class="n" x="86"  y="176" width="78" height="30"/><text class="t" x="125" y="195">敵HP&gt;70?</text>
    <rect class="m" x="174" y="162" width="34" height="22"/><text class="t" x="191" y="177">m28</text>
    <text class="t" x="214" y="177" text-anchor="start">(○ 反射)</text>
    <rect class="m" x="174" y="196" width="34" height="22"/><text class="t" x="191" y="211">m18</text>
    <rect class="p" x="212" y="196" width="30" height="22"/><text class="t" x="227" y="211">[8]</text>
    <text class="t" x="248" y="211" text-anchor="start">(×)</text>
  </g>
  <g text-anchor="middle">
    <rect class="m" x="6"   y="256" width="34" height="26"/><text class="t" x="23"  y="273">m12</text>
    <rect class="p" x="48"  y="256" width="30" height="26"/><text class="t" x="63"  y="273">[9]★</text>
    <rect class="m" x="86"  y="256" width="34" height="26"/><text class="t" x="103" y="273">m29</text>
    <rect class="p" x="128" y="256" width="36" height="26"/><text class="t" x="146" y="273">[10]</text>
    <rect class="n" x="172" y="256" width="46" height="26"/><text class="t" x="195" y="273">GOAL</text>
  </g>
  <text class="t" x="340" y="195" text-anchor="start" fill="#a44">★ [7]reflect は条件マスを透過し m28 を反射（透過改修）。</text>
  <text class="t" x="340" y="212" text-anchor="start" fill="#a44">[9]reflect は m29 を反射。攻撃39＋反射57＝96≥95。</text>
</svg>

## 実装方針

### 条件分岐マスのバフ透過（要件1）
`clearTransientBuffs(state, prevCard, prevNodeType)` は「直前ノードが merge なら透過（バフ据え置き）」だった。これを `merge || condition` に拡張する。live（`battleStore`）も対称に、エッジ通過時の解除判定を `isPrevMerge` → `isPrevTransparent`（`merge` / `condition`）にする。カウンターを張った `[7]` → 条件マス → `m(28)` の間でも反射が維持される。

### 非回帰（要件5）
条件透過が結果を変えるのは「バフが有効なまま条件マスを通過する」場合のみ。既存ステージの条件マス直前は、3-2/5-3 が敵攻撃（バフ消費）・4-2/4-4/5-1 が flow 先頭（直前無し）・3-1 は guard/reflect カードが手札に無い。player-slot が条件直前に来るのは 3-3・5-2 だが、3-3 は reflect を最終 monster の直前に置く設計で条件にバフが乗らず、5-2 は実解答で検証して win。5-3/5-4 も win を確認。

## 依存関係

| パッケージ | 用途 | 導入済み？ |
|----------|------|----------|
| （新規なし） | 既存の React Flow / zustand / 自作エンジンのみ | — |

## トレードオフと検討した代替案

- **決定内容**：条件分岐マスを `merge` と同じ「構造マス＝バフ透過」にする。
  **理由**：作者の設計（カウンター→分岐→反射）を忠実に実装でき、かつ「カードを持たない構造ノードはバフを消費しない」という merge と一貫した原則になる。
  **検討した代替案**：3-4 の構造を変えてカウンターを分岐の外へ出す。作者の原案（⑦が分岐直前）を崩すため不採用。
