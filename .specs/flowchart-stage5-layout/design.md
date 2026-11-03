# 設計書: フローチャート縦レイアウト拡張（stage5 向け）

（親：`requirements.md` ／ 対象：`src/data/stagesLoader.js`、`src/features/battle/flowchart/AnimatedProgressEdge.jsx`）

## 概要

2 機能は**共通の描画部品「下回りエッジ（under-route）」**の上に実装する。

- **下回りエッジ（共通部品）**：エッジに `data.route = 'under'` と `data.laneY`（潜る深さ＝どの y を通すか）を持たせ、`AnimatedProgressEdge` が `getSmoothStepPath` を **`centerY: laneY`** で呼ぶことで、源点から一度 `laneY`（障害物スロットの下）まで降りて水平移動し、終点へ上がる L/U 字経路を描く。既存の `shouldUseStep`（loopback/false/bottom/top）とは独立の新ルート。
- **機能1**：`loop` に `exitRoute:"under"` タグがあるとき、ローダーが脱出（true,down）エッジに `route:'under'` + `laneY`（false 分岐の下）を付ける。
- **機能2**：`{ "newline": {} }` を `turn` と同列の構文として `processSubFlow` に追加。行を下げ・column を左端へ戻し・方向は right 維持。改行直後の最初のノードへ繋ぐエッジに `route:'under'` + `laneY` を付ける。

ローダーは「ノード座標とエッジの `data`／ハンドル」を出すだけ、実際の曲げは描画側（`AnimatedProgressEdge`）が担うので、**既存の座標計算ロジックへの影響を最小化**できる。

## アーキテクチャ

| 変更対象 | 役割 | 変更内容 |
|---|---|---|
| `AnimatedProgressEdge.jsx` | エッジ描画 | `data.route === 'under'` なら `getSmoothStepPath({..., centerY: data.laneY, offset})`。それ以外は現状維持 |
| `stagesLoader.js` `processSubFlow` | flow 展開 | `newline` 要素の検出＋改行処理、`afterNewline` フラグ、改行後エッジへ `route/laneY` 付与 |
| `stagesLoader.js` `expandLoop` | while 展開 | `exitRoute:"under"` のとき脱出エッジ（`endings` 返却）へ `route/laneY` を付与 |
| `stagesLoader.js` `isNewline` | 判定 | `typeof item.newline === 'object'`（`isTurn` と同形） |

> `getSmoothStepPath` が `centerY` を受けること（@xyflow/react）を実装時に確認する。非対応なら「源点→`laneY`→水平→終点」の**自作直交パス**にフォールバック（部品の責務は変わらない）。

## データモデル（DSL 追加）

- **改行**：`{ "newline": {} }`（値は将来拡張のため object 固定、`turn` と同じ流儀）。top-level のみ、複数回可。
- **脱出タグ**：`loop` に `"exitRoute": "under"`（省略時は従来経路）。`trueDir:"down"` と併用する前提。

```jsonc
// 5-1 での使用イメージ（抜粋）
{ "loop": { "mode":"pre", "condition":"enemyHp <= 240", "trueDir":"down", "falseDir":"right",
            "exitRoute":"under", "body":[ /* if分岐 … */ ] } },
{ "loop": { "mode":"pre", "condition":"playerHp >= 60", "trueDir":"down", "falseDir":"right",
            "exitRoute":"under", "body":[ /* 回復+10 */ ] } },
{ "lockedCard": { "id":"monster", "power":60 } },
{ "lockedCard": { "id":"heal", "power":45 } },
{ "newline": {} },           // ← ここで改行。for 以降は次行・左端から
{ "for": { "iterations":5, "body":[ /* … */ ] } },
{ "multiplier": 4 }
```

## 詳細設計

### 共通部品：下回りエッジ（`AnimatedProgressEdge`）
```diff
-  const shouldUseStep = sourceHandleId === 'false' || targetHandleId === 'bottom' || targetHandleId === 'top';
+  const isUnder = data?.route === 'under';
+  const shouldUseStep = isUnder || sourceHandleId === 'false' || targetHandleId === 'bottom' || targetHandleId === 'top';
   ...
   const [edgePath] = shouldUseStep
     ? getSmoothStepPath({
         sourceX, sourceY, sourcePosition,
         targetX, targetY, targetPosition,
         borderRadius: 5,
-        offset: stepOffset,
+        offset: stepOffset,
+        ...(isUnder && typeof data.laneY === 'number' ? { centerY: data.laneY } : {}),
       })
     : getStraightPath({ sourceX, sourceY, targetX, targetY });
```
- `laneY` は「潜る底の y」。源点・終点が同じ行でも `centerY: laneY` で**その y まで降りて**水平移動する。

### 機能1：ループ脱出の下回り（`expandLoop`, pre モード）
- `expandLoop` は脱出を `endings: [{ nodeId: condId, sourceHandle: 'true' }]` で返す。`exitRoute:"under"` のとき、**次要素接続時にそのエッジへ `route/laneY` を載せる**必要がある。
- 実装：`endings` の要素に `route:'under'` と `laneY` を持たせ、`buildEdge` が `sourceHandle` と同様に `data` へ転記する（`buildEdge` を `data` 対応に拡張）。
  - `laneY` = `max(false 分岐スロットの y) + SLOT_HEIGHT + 余白`（false 分岐＝`yLevel + 160` 段の下）。`expandLoop` 内で body 展開後に算出できる。
- `trueDir:"down"` でハンドルは bottom（既存）。ConditionNode の down ハンドルから出て、`centerY=laneY` で false 列の下を回り、次ノード（while②の merge 等）の target へ接続。

### 機能2：改行（`processSubFlow` に `newline` 分岐）
`turn` のハンドラ（行ジャンプ）を参考に、**方向反転なし・column 左端リセット**版を追加する。
```jsonc
// processSubFlow の if/else チェーン先頭付近（isTurn の隣）に追加
if (isNewline(item)) {
  // 1) バリデーション：top-level 以外 / 先頭（endings[0].nodeId==='start'）は warn + skip
  // 2) 行ジャンプ：currentYLevel = max(配置済み全ノード y) + LOOP_ROW_GAP
  // 3) column = 0（＝START_X 相当の左端）
  // 4) currentDirection は 'right' のまま
  // 5) ctx.afterNewline = true, ctx.newlineLaneY = （直前行の下の lane y）
  continue; // newline 自体はノードを生成しない
}
```
- 直後の通常スロット展開で、`ctx.afterNewline` が true なら**その 1 本のエッジ**に `route:'under'` + `laneY`（源点行とターゲット行の間、全スロットの下）を付け、`afterNewline=false` に戻す（`afterTurn` と同じ一回消費パターン）。
- `turn` と違い `currentDirection` は 'right' のままなので、以降の column 増減・ハンドルは通常の右向き（既存コード）をそのまま使える。`turnCount` 制限とは独立（`newline` は複数回可）。

### ctx 初期化の追加
`expandFlow` の `ctx` に `afterNewline: false` / `newlineLaneY: null` を足す（`afterTurn` と並列。未使用ステージでは初期値のまま＝非破壊）。

## 経路のイメージ

<svg viewBox="0 0 760 320" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" font-size="11">
  <defs><marker id="u" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#888"/></marker>
  <style>.s{fill:#e6efff;stroke:#5b7fc4}.c{fill:#fff6e6;stroke:#e0b24a}.f{fill:#eef2f9;stroke:#9fb0cc}.ln{stroke:#888;stroke-width:1.4;fill:none}.u{stroke:#c0652f;stroke-width:1.6;fill:none}.t{fill:#1f2a3d}.lbl{fill:#6b7a92;font-size:9px}</style></defs>
  <!-- 機能1: while① exit under if-false -->
  <text x="8" y="14" class="lbl">機能1：while① 脱出(down)が if-false(2段目)の下を潜って while② へ</text>
  <polygon class="c" points="60,40 110,24 160,40 110,56"/><text x="92" y="43" class="t">while①</text>
  <rect class="s" x="200" y="26" width="44" height="28" rx="5"/><text x="210" y="44" class="t">true</text>
  <rect class="f" x="200" y="86" width="44" height="28" rx="5"/><text x="206" y="104" class="t">false</text>
  <rect class="f" x="254" y="86" width="44" height="28" rx="5"/><text x="260" y="104" class="t">false</text>
  <polygon class="c" points="360,40 410,24 460,40 410,56"/><text x="388" y="43" class="t">while②</text>
  <path class="u" d="M110,56 C110,150 360,150 360,56" marker-end="url(#u)"/>
  <text x="210" y="145" class="lbl">laneY（false 列の下）を通る under-route</text>
  <!-- 機能2: newline -->
  <text x="8" y="210" class="lbl">機能2：newline で改行 → 次行・左端から右へ</text>
  <rect class="s" x="470" y="224" width="54" height="26" rx="5"/><text x="478" y="241" class="t">heal45</text>
  <rect class="s" x="60" y="284" width="54" height="26" rx="5"/><text x="68" y="301" class="t">for…</text>
  <path class="u" d="M497,250 C497,300 497,300 300,300 C140,300 140,300 87,284" marker-end="url(#u)"/>
  <text x="250" y="296" class="lbl">全スロットの下を回って左端へ（右方向のまま新しい行）</text>
</svg>

## 実装方針（判断）

1. **描画は共通部品に集約**：`route:'under'` + `laneY` の 1 系統で両機能を賄う。個別の経路ロジックを増やさない。
2. **座標計算は既存を流用**：行ジャンプは `turn` の maxY 計算を再利用。`newline` は方向反転なし・column=0 という差分のみ。
3. **明示指定でのみ発火**：`exitRoute` タグ／`newline` 要素が無ければ `ctx.afterNewline`/`route` は立たず、出力は従来と完全一致（要件3）。
4. **buildEdge の拡張**：`ending.route` / `ending.laneY` を `edge.data.route` / `edge.data.laneY` に転記（`sourceHandle`/`targetHandle` と同じ任意フィールド方式）。

## トレードオフ・未確定

| 項目 | 対応 |
|---|---|
| `getSmoothStepPath` の `centerY` 対応可否 | 実装時に確認。非対応なら自作直交パスにフォールバック（部品の責務不変） |
| `laneY` の最適値（潜る深さ） | 機能1=false列の下、機能2=全行の下。実データ（5-1）で目視調整 |
| `newline` と `turn` の併用 | 今回は 5-1 で `newline` のみ使用。併用時の相互作用はスコープ外（必要時に別途） |

## 検証方針

- **ヘッドレス**：`stagesLoader` 展開で (a) `newline` 後ノードが新しい行 y・左端 column に来る、(b) 脱出/改行エッジが `data.route==='under'` と `laneY` を持つ、(c) `newline`/`exitRoute` 未使用の 1-1〜4-4 の出力が変更前と**バイト一致**、を確認。
- **目視**：`npm run dev` で 5-1 を開き、while① 脱出が if-false の下を潜り、`newline` 後に for が次行・左端から並ぶこと。
- build / lint 通過。

## 要件トレーサビリティ

| 要件 | 設計 |
|---|---|
| 1（脱出 under タグ） | `expandLoop` の `exitRoute` → `route/laneY`、共通部品 |
| 2（newline） | `processSubFlow` の `isNewline` 分岐、`afterNewline`、共通部品 |
| 3（非回帰） | 明示指定時のみ発火、`buildEdge` 任意フィールド、未使用時バイト一致検証 |
| 4（検証可能性） | ヘッドレス展開検査＋目視 |
