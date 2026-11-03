# 設計書: ステージ 5-1（改）

（親：`requirements.md` ／ 対象：`src/data/stages.json` の `"5-1"`）

## 概要

ステージ 5-1 は**既存のステージエンジンを一切変更せず、`stages.json` のデータ差し替えだけ**で実装できる。`stagesLoader.js` の `flow` DSL が、本ステージに必要な構文（前置 while ループ `loop`、for ループ `for`、条件分岐 `condition`、倍率スロット `multiplier`、配置制限 `acceptOnly`、固定カード `lockedCard`、自動 `merge`）をすべて備えていることをコードで確認済み。したがって本ステージは **`5-1` エントリの `flow` を手書き原案どおりに記述する**のが設計の中心になる。

正しさは `src/engine/simulateBattle.js`（live と同じ純関数 `evaluateCondition` を共有するヘッドレス戦闘シミュレータ）で**解答配置がクリアになること**を自動検証して担保する（要件3）。

## アーキテクチャ

### コンポーネント（既存・変更なし）

| コンポーネント | 役割 | 本ステージでの使い方 |
|---|---|---|
| `src/data/stages.json` | ステージ定義 | `"5-1"` を `enemyId`/`maxEnemyHp`/`cards`/`flow` で記述（**ここだけ変更**） |
| `src/data/stagesLoader.js` | `flow` DSL → ノード/エッジ展開 | `loop`/`for`/`condition`/`multiplier`/`acceptOnly`/`lockedCard` を解釈（変更なし） |
| `src/engine/evaluateCondition.js` | 条件式評価（正規表現パース） | `playerHp`/`enemyHp`/`slot()`/`forCounter()` と `&& ||` を使用 |
| `src/engine/simulateBattle.js` | ヘッドレス戦闘 | 解答配置のクリア検証に使用 |

### 条件式で使える語彙（確定）

- 変数：`playerHp` / `enemyHp` / `maxPlayerHp` / `maxEnemyHp` / `guardShield` / `reflectActive`
- 関数：`slot('<slot-id>')`（配置カード id）、`forCounter('<for-start-id>')`（for 周回カウンタ）
- 演算子：`>` `<` `>=` `<=` `===` `!==`、論理 `&&` `||`（**剰余 `%` や括弧は不可**）

### 敵カード（`lockedCard`）の id（`public/cards/` の画像名に一致）

| 用途 | `lockedCard` | 効果 |
|---|---|---|
| 敵の攻撃（プレイヤーHP減） | `{ "id": "monster", "power": N }` | プレイヤーに N ダメージ |
| 敵ガード | `{ "id": "monster_guard", "power": 5 }` | 敵にガード（以降のプレイヤー攻撃を軽減） |
| プレイヤー自動回復 | `{ "id": "heal", "power": N }` | プレイヤー HP を N 回復 |

> 補足：`monster_heal` / `monster_reflect` も利用可能だが、5-1 の原案では未使用（登場は 5-2〜5-4 を想定）。

## データモデル：`5-1` の `flow`（記述案）

スロット（プレイヤーが埋める空きマス）は `{}`、制限付きは `{ "acceptOnly": "guard" }`、倍率付きは `{ "multiplier": 4 }`。敵カード等は `lockedCard`。`loop.condition` は**脱出条件（true で抜ける）**なので、原案の「〜の間ループ」は**否定（脱出）形**で書く。

```jsonc
"5-1": {
  "enemyId": "black_wing_dragon",
  "maxEnemyHp": 270,
  "cards": [
    { "id": "attack", "power": 20 }, { "id": "attack", "power": 15 },
    { "id": "attack", "power": 10 }, { "id": "attack", "power": 6 },
    { "id": "attack", "power": 5 },
    { "id": "guard", "power": 25 }, { "id": "guard", "power": 10 }, { "id": "guard", "power": 10 },
    { "id": "heal", "power": 30 }, { "id": "heal", "power": 25 },
    { "id": "counter" }
  ],
  "flow": [
    { "acceptOnly": "guard" },                               // [1] 防御指定マス
    { "lockedCard": { "id": "monster", "power": 15 } },      // 敵 -15
    { "lockedCard": { "id": "monster", "power": 75 } },      // 敵 -75
    { "loop": {                                              // while①：敵HP>240 の間
        "condition": "enemyHp <= 240",
        "label": "敵《てき》のHPが 240 いか？",
        "body": [
          { "condition": "playerHp <= 30",
            "label": "自分《じぶん》のHPが 30 いか？",
            "true":  [ {}, { "lockedCard": { "id": "monster", "power": 30 } }, {} ],   // [2] 敵-30 [4]
            "false": [
              { "lockedCard": { "id": "monster_guard", "power": 5 } },                 // 敵guard5
              { "lockedCard": { "id": "monster", "power": 40 } },                      // 敵-40
              {},                                                                      // [3]
              { "lockedCard": { "id": "monster", "power": 5 } },                       // 敵-5
              { "lockedCard": { "id": "monster_guard", "power": 5 } }                  // 敵guard5
            ]
          },
          { "lockedCard": { "id": "monster", "power": 15 } },                          // 敵-15（合流後・共有）
          {}                                                                           // [5]
        ]
    }},
    { "loop": {                                              // while②：自分HP<60 の間 +10
        "condition": "playerHp >= 60",
        "label": "自分《じぶん》のHPが 60 いじょう？",
        "body": [ { "lockedCard": { "id": "heal", "power": 10 } } ]
    }},
    { "lockedCard": { "id": "monster", "power": 60 } },      // 敵 -60
    { "lockedCard": { "id": "heal", "power": 45 } },         // 回復 +45
    { "for": {                                               // for×5
        "iterations": 5,
        "body": [
          { "condition": "forCounter('for-start-1') === 5 || forCounter('for-start-1') === 3 || forCounter('for-start-1') === 1",
            "label": "ループが 1・3・5 回目《かいめ》？",
            "true":  [ {}, { "lockedCard": { "id": "monster", "power": 20 } }, {} ],   // [6] 敵-20 [7]
            "false": [
              { "condition": "playerHp <= 20",
                "label": "自分《じぶん》のHPが 20 いか？",
                "true":  [],                                                           // → 合流（[8]を飛ばす）
                "false": [ {} ]                                                        // [8]
              }
            ]
          },
          { "lockedCard": { "id": "monster", "power": 15 } },                          // 敵-15（合流後・共有）
          {}                                                                           // [9]
        ]
    }},
    { "multiplier": 4 }                                      // [10] 攻15×4 → ゴール
  ]
}
```

スロットは flow 走査順に `slot-1`…`slot-10` と自動採番される（`[1]`=`slot-1`〜`[10]`=`slot-10`）。空きスロットの内部 id が原案の `[N]` ラベルと厳密一致する必要はなく、**特別属性（`[1]` のガード限定・`[10]` の ×4）が正しい位置に乗っていれば十分**。

## フロー図（設計の全体像）

<svg viewBox="0 0 900 560" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" font-size="12">
  <defs>
    <marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#888"/></marker>
    <style>
      .box{fill:none;stroke:#5b7fc4;stroke-width:1.4;rx:6}
      .slot{fill:#e6efff;stroke:#5b7fc4;stroke-width:1.4}
      .mon{fill:#fdeaea;stroke:#d06b6b;stroke-width:1.2}
      .cond{fill:#fff6e6;stroke:#e0b24a;stroke-width:1.4}
      .t{fill:#1f2a3d}.lbl{fill:#6b7a92;font-size:10px}
      .ln{stroke:#888;stroke-width:1.3;fill:none}
    </style>
  </defs>
  <!-- row1: start -> [1] -> -15 -> -75 -> while1 -->
  <text x="8" y="28" class="t">START</text>
  <rect class="slot" x="52" y="14" width="34" height="26" rx="5"/><text x="60" y="31" class="t">[1]</text>
  <rect class="mon" x="98" y="14" width="44" height="26" rx="5"/><text x="104" y="31" class="t">-15</text>
  <rect class="mon" x="152" y="14" width="44" height="26" rx="5"/><text x="158" y="31" class="t">-75</text>
  <line class="ln" x1="86" y1="27" x2="98" y2="27" marker-end="url(#a)"/>
  <line class="ln" x1="142" y1="27" x2="152" y2="27" marker-end="url(#a)"/>
  <!-- while1 box -->
  <rect class="box" x="210" y="8" width="672" height="150" rx="8" stroke="#8aa0c8" stroke-dasharray="5 4"/>
  <text x="218" y="22" class="lbl">while① 敵HP&gt;240 の間（脱出: enemyHp≤240）</text>
  <polygon class="cond" points="250,70 300,50 350,70 300,90"/><text x="268" y="73" class="t" font-size="10">HP≤30?</text>
  <line class="ln" x1="196" y1="27" x2="300" y2="50" marker-end="url(#a)"/>
  <!-- true row -->
  <rect class="slot" x="380" y="40" width="30" height="24" rx="5"/><text x="386" y="56" class="t">[2]</text>
  <rect class="mon" x="420" y="40" width="42" height="24" rx="5"/><text x="425" y="56" class="t">-30</text>
  <rect class="slot" x="472" y="40" width="30" height="24" rx="5"/><text x="478" y="56" class="t">[4]</text>
  <text x="356" y="46" class="lbl">○</text>
  <line class="ln" x1="350" y1="60" x2="380" y2="52" marker-end="url(#a)"/>
  <line class="ln" x1="410" y1="52" x2="420" y2="52" marker-end="url(#a)"/>
  <line class="ln" x1="462" y1="52" x2="472" y2="52" marker-end="url(#a)"/>
  <!-- false row -->
  <text x="300" y="108" class="lbl">×</text>
  <rect class="mon" x="360" y="98" width="52" height="22" rx="5"/><text x="364" y="113" class="t" font-size="10">guard5</text>
  <rect class="mon" x="418" y="98" width="42" height="22" rx="5"/><text x="423" y="113" class="t">-40</text>
  <rect class="slot" x="466" y="98" width="30" height="22" rx="5"/><text x="472" y="113" class="t">[3]</text>
  <rect class="mon" x="502" y="98" width="36" height="22" rx="5"/><text x="507" y="113" class="t">-5</text>
  <rect class="mon" x="544" y="98" width="52" height="22" rx="5"/><text x="548" y="113" class="t" font-size="10">guard5</text>
  <line class="ln" x1="300" y1="90" x2="360" y2="109" marker-end="url(#a)"/>
  <!-- merge -> -15 -> [5] -->
  <circle cx="620" cy="70" r="7" fill="#fff" stroke="#888"/><text x="612" y="60" class="lbl">merge</text>
  <line class="ln" x1="502" y1="52" x2="620" y2="66" marker-end="url(#a)"/>
  <line class="ln" x1="596" y1="109" x2="620" y2="78" marker-end="url(#a)"/>
  <rect class="mon" x="650" y="58" width="44" height="24" rx="5"/><text x="656" y="74" class="t">-15</text>
  <rect class="slot" x="704" y="58" width="34" height="24" rx="5"/><text x="710" y="74" class="t">[5]</text>
  <line class="ln" x1="627" y1="70" x2="650" y2="70" marker-end="url(#a)"/>
  <line class="ln" x1="694" y1="70" x2="704" y2="70" marker-end="url(#a)"/>
  <path class="ln" d="M721,58 C721,20 320,20 300,48" marker-end="url(#a)"/>
  <text x="520" y="18" class="lbl">↑ ループバック（body 末尾 [5] → 条件へ）</text>
  <!-- while2 -->
  <rect class="box" x="40" y="180" width="360" height="70" rx="8" stroke="#8aa0c8" stroke-dasharray="5 4"/>
  <text x="48" y="196" class="lbl">while② 自分HP&lt;60 の間 +10（脱出: playerHp≥60＝65で抜ける）</text>
  <polygon class="cond" points="70,228 120,210 170,228 120,246"/><text x="92" y="231" class="t" font-size="10">HP≥60?</text>
  <rect class="slot" x="210" y="214" width="70" height="26" rx="5" fill="#eafaf0" stroke="#5bbd82"/><text x="218" y="231" class="t">回復+10</text>
  <line class="ln" x1="170" y1="218" x2="210" y2="223" marker-end="url(#a)"/>
  <path class="ln" d="M245,214 C245,188 150,188 120,208" marker-end="url(#a)"/>
  <line class="ln" x1="300" y1="83" x2="120" y2="208" class="ln" marker-end="url(#a)"/>
  <!-- -60 +45 -->
  <rect class="mon" x="420" y="202" width="44" height="24" rx="5"/><text x="426" y="218" class="t">-60</text>
  <rect class="slot" x="474" y="202" width="60" height="24" rx="5" fill="#eafaf0" stroke="#5bbd82"/><text x="480" y="218" class="t">回復+45</text>
  <line class="ln" x1="120" y1="246" x2="420" y2="214" marker-end="url(#a)"/>
  <line class="ln" x1="464" y1="214" x2="474" y2="214" marker-end="url(#a)"/>
  <!-- for -->
  <rect class="box" x="40" y="300" width="842" height="200" rx="8" stroke="#8aa0c8" stroke-dasharray="5 4"/>
  <text x="48" y="316" class="lbl">for ×5（body を 5 回。forCounter は 5→1）</text>
  <polygon class="cond" points="70,360 140,336 210,360 140,384"/><text x="88" y="356" class="t" font-size="10">1・3・5回目?</text>
  <text x="120" y="330" class="lbl">(counter∈{5,3,1})</text>
  <line class="ln" x1="500" y1="226" x2="140" y2="336" marker-end="url(#a)"/>
  <!-- true row -->
  <text x="214" y="348" class="lbl">○</text>
  <rect class="slot" x="240" y="332" width="30" height="24" rx="5"/><text x="246" y="348" class="t">[6]</text>
  <rect class="mon" x="280" y="332" width="42" height="24" rx="5"/><text x="285" y="348" class="t">-20</text>
  <rect class="slot" x="332" y="332" width="30" height="24" rx="5"/><text x="338" y="348" class="t">[7]</text>
  <line class="ln" x1="210" y1="352" x2="240" y2="344" marker-end="url(#a)"/>
  <line class="ln" x1="270" y1="344" x2="280" y2="344" marker-end="url(#a)"/>
  <line class="ln" x1="322" y1="344" x2="332" y2="344" marker-end="url(#a)"/>
  <!-- false: inner cond -->
  <text x="140" y="404" class="lbl">×</text>
  <polygon class="cond" points="230,420 290,402 350,420 290,438"/><text x="250" y="423" class="t" font-size="10">HP≤20?</text>
  <line class="ln" x1="140" y1="384" x2="290" y2="402" marker-end="url(#a)"/>
  <rect class="slot" x="380" y="408" width="30" height="24" rx="5"/><text x="386" y="424" class="t">[8]</text>
  <text x="356" y="414" class="lbl">×</text>
  <line class="ln" x1="350" y1="420" x2="380" y2="420" marker-end="url(#a)"/>
  <!-- merges -->
  <circle cx="470" cy="360" r="7" fill="#fff" stroke="#888"/><text x="456" y="350" class="lbl">m(cond1)</text>
  <line class="ln" x1="362" y1="344" x2="470" y2="356" marker-end="url(#a)"/>
  <text x="300" y="398" class="lbl">○→合流</text>
  <line class="ln" x1="290" y1="402" x2="470" y2="364" marker-end="url(#a)"/>
  <line class="ln" x1="410" y1="420" x2="470" y2="366" marker-end="url(#a)"/>
  <rect class="mon" x="500" y="348" width="44" height="24" rx="5"/><text x="506" y="364" class="t">-15</text>
  <rect class="slot" x="554" y="348" width="30" height="24" rx="5"/><text x="560" y="364" class="t">[9]</text>
  <line class="ln" x1="477" y1="360" x2="500" y2="360" marker-end="url(#a)"/>
  <line class="ln" x1="544" y1="360" x2="554" y2="360" marker-end="url(#a)"/>
  <path class="ln" d="M569,348 C569,312 180,312 140,334" marker-end="url(#a)"/>
  <!-- exit -> [10] x4 -> goal -->
  <rect class="slot" x="640" y="432" width="70" height="28" rx="5"/><text x="646" y="450" class="t">[10]×4</text>
  <text x="716" y="450" class="t">→ 敵(G)</text>
  <line class="ln" x1="584" y1="360" x2="660" y2="432" marker-end="url(#a)"/>
  <text x="600" y="420" class="lbl">for 脱出</text>
</svg>

## 実装方針（主要な設計判断）

### 1. エンジンは触らず、`flow` データのみで実装
- **決定**：ノード種別・実行機構・評価器に手を入れず、`5-1` の `flow` 記述だけで表現する。
- **理由**：必要構文（while/for/条件/倍率/制限/固定カード/自動merge）は既存 DSL に揃っている。隔離（要件5）と最小差分のため。
- **代替案**：`slots`+`edges` 明示でフルカスタム → ループ/カウンタ/merge を手書きする負担が大きくバグの温床。却下。

### 2. ループ条件は「脱出条件（true で抜ける）」で記述
- `expandLoop` は `condition` を脱出条件として扱う。原案の「敵HP>240 の間ループ」は `condition: "enemyHp <= 240"`、「自分HP<60 の間」は `condition: "playerHp >= 60"` と**否定（脱出）形**で書く。
- 表示 `label` は脱出判定と一致する問い（「240いか？」「60いじょう？」）にする。→ **要確認**：原案の見た目（guard 条件表記）に寄せたい場合は label 文言を調整する。

### 3. for の「1・3・5回目」は forCounter の **5/3/1** を `||` で列挙
- `forCounter('for-start-1')` は **周回で 5→4→3→2→1**（初期=iterations、`for-end` が毎周 -1）。1・3・5 回目＝カウンタ 5・3・1（奇数）。
- 評価器は剰余 `%` 非対応のため、`forCounter(...)===5 || forCounter(...)===3 || forCounter(...)===1` と列挙（`||` は任意個対応）。
- **要検証**：周回カウンタの値が本当に body 内で 5→1 かを `simulateBattle` で確認（初回 body で 5 を取る前提）。

### 4. m1/m2 の“ずれた合流”＝**ネスト条件＋共有末尾**で等価表現
- 原案は「true と cond2.true を m1 で早期合流 → 共有 -15 → cond2.false を m2 で遅延合流 → [9]」。1 条件=1 自動 merge の DSL では物理的に同形にできない。
- そこで **cond2 を cond1.false にネストし、共有の `-15 → [9]` を for body の cond1 の後ろに置く**。これにより全経路が**ちょうど 1 回だけ -15 を通って [9] に至る**：
  - 奇数回：`[6]→-20→[7]` →(merge)→ `-15→[9]`
  - 偶数回 HP≤20：`(空)` →(merge)→ `-15→[9]`（[8] を飛ばす）
  - 偶数回 HP>20：`[8]` →(merge)→ `-15→[9]`
- **ゲーム挙動は原案と完全一致**（物理的な -15 ノードが 2 個→1 個になるだけ。順序・ダメージ・[8] の使用条件は同じ）。

### 5. スロット属性：`[1]` ガード限定・`[10]` ×4
- `[1]` は `acceptOnly: "guard"`（防御指定マス）。`[10]` は `multiplier: 4`（攻15×4=60）。その他は自由スロット。

### 6. 正しさは simulateBattle で自動検証
- 解答配置（`slot-1`=防10 … `slot-10`=攻15）を `simulateBattle` に流し、**敵HP=0 かつ 自分HP≥1 でクリア**を確認（要件3-1）。
- 併せて「while① で攻20 を使う」「while② を 65 以外で抜ける」等の**引っかけが敗北/未クリア**になることも 1〜2 ケース確認（要件3-2/3-3）。

## リスク・未確定（実装前に潰す）

| 項目 | 対応 |
|---|---|
| `monster_guard` の正確なゲーム効果（敵ガード量の計算）が解答の数値に与える影響 | simulateBattle で解答クリアを確認。崩れたら数値/構造を原案作者に確認 |
| forCounter の body 内での値（5→1 か）| simulateBattle のトレースで確認（§3） |
| ループ `label` の文言（脱出形で良いか）| §2、ユーザー確認 |
| 敵カードの表示（`monster_guard` 等の画像描画）| 既存の描画経路で画像名一致を確認 |

## 要件トレーサビリティ

| 要件 | 対応設計 |
|---|---|
| 1（対戦パラメータ） | `enemyId`/`maxEnemyHp`/`cards`/`acceptOnly`（§データモデル） |
| 2（構造の忠実再現） | `flow` 記述＋§4（m1/m2 等価）＋フロー図 |
| 3（解答成立・意図保全） | §6 simulateBattle 検証 |
| 4（敵カード表現） | `lockedCard` id 表（`monster`/`monster_guard`…） |
| 5（非回帰） | §1 エンジン無改変・`5-1` のみ変更 |
