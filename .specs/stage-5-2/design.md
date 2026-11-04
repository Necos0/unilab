# 設計書: ステージ 5-2

（親：`requirements.md` ／ 対象：`src/data/stagesLoader.js`・`src/data/stages.json`）

## 概要

2点で構成：
1. **ローダー拡張**：`flow` スロットに**明示 id** を許可（`buildBodySlot`）。条件がプレイヤースロットの型を安定参照できるようにする（自動採番 id は locked カードでズレるため）。
2. **ステージ記述**：`5-2` の `flow` を確定構造で記述。プレイヤースロットに `p1`〜`p10` の id を付け、条件は `slot('pN') === '<type>'` で参照。

正しさは `simulateBattle` で**解答がクリア**になることを検証。

## 1. ローダー拡張（`buildBodySlot`）

```diff
 function buildBodySlot(ctx, raw, position) {
   ctx.slotCounter += 1;
-  const slotId = `slot-${ctx.slotCounter}`;
+  const slotId = raw.id ?? `slot-${ctx.slotCounter}`; // 明示 id を尊重（線形 expandSlots と一貫）
   const slot = { id: slotId, position };
```
- カウンタは従来どおり加算（auto id の連番は不変）。`raw.id` 未指定なら従来どおり。
- 非回帰：既存 flow は `raw.id` を持たないため出力バイト一致（検証）。線形 `expandSlots` は既に `raw.id` 尊重済み。

## 2. `5-2` の `flow`（記法：m=monster攻撃 / g=monster_guard / h=monster_heal）

プレイヤースロット＝`{ "id":"pN", ... }`。条件は `slot('pN')`。倍率/acceptOnly は従来キーを併用。

```jsonc
"5-2": {
  "enemyId": "lagiacrus",
  "maxEnemyHp": 285,
  "cards": [
    { "id":"attack","power":40 }, { "id":"attack","power":40 },
    { "id":"attack","power":10 }, { "id":"attack","power":5 },
    { "id":"guard","power":30 }, { "id":"guard","power":15 },
    { "id":"guard","power":5 }, { "id":"guard","power":5 },
    { "id":"heal","power":30 }, { "id":"heal","power":20 },
    { "id":"reflect" }, { "id":"reflect" }
  ],
  "flow": [
    { "id":"p1" },
    { "lockedCard": { "id":"monster", "power":50 } },
    { "condition":"slot('p2') === 'attack'", "label":"[2]は こうげき？",
      "true":[ { "lockedCard":{ "id":"monster_guard","power":20 } } ],
      "false":[ { "lockedCard":{ "id":"monster_heal","power":25 } } ] },
    { "id":"p2" },
    { "lockedCard": { "id":"monster", "power":15 } },
    { "condition":"slot('p3') === 'heal'", "label":"[3]は かいふく？",
      "true":[ { "lockedCard":{ "id":"monster","power":35 } } ],
      "false":[ { "lockedCard":{ "id":"monster_guard","power":15 } } ] },
    { "id":"p3" },
    { "lockedCard": { "id":"monster", "power":25 } },
    { "for": { "iterations":3, "body":[
        { "condition":"slot('p4') === 'attack'", "label":"[4]は こうげき？",
          "true":[ { "lockedCard":{ "id":"monster_guard","power":10 } } ],
          "false":[ { "lockedCard":{ "id":"monster_heal","power":20 } } ] },
        { "id":"p4" },
        { "lockedCard": { "id":"monster", "power":15 } }
      ] } },
    { "newline": {} },
    { "condition":"slot('p5') === 'attack'", "label":"[5]は こうげき？",
      "true":[ { "lockedCard":{ "id":"monster_guard","power":15 } } ],
      "false":[ { "lockedCard":{ "id":"monster","power":30 } } ] },
    { "id":"p5" },
    { "lockedCard": { "id":"monster", "power":40 } },
    { "id":"p6", "multiplier":2 },
    { "lockedCard": { "id":"monster", "power":20 } },
    { "condition":"slot('p7') === 'heal'", "label":"[7]は かいふく？",
      "true":[ { "lockedCard":{ "id":"monster","power":15 } } ],
      "false":[ { "lockedCard":{ "id":"monster_guard","power":20 } } ] },
    { "id":"p7" },
    { "lockedCard": { "id":"monster", "power":40 } },
    { "id":"p8" },
    { "condition":"slot('p9') === 'attack'", "label":"[9]は こうげき？",
      "true":[ { "lockedCard":{ "id":"monster_guard","power":10 } } ],
      "false":[ { "lockedCard":{ "id":"monster_heal","power":10 } } ] },
    { "id":"p9", "multiplier":2 },
    { "lockedCard": { "id":"monster", "power":25 } },
    { "id":"p10", "acceptOnly":"attack", "multiplier":3 }
  ]
}
```

### スロット対応
| 原案 | id | 解答カード | 備考 |
|---|---|---|---|
| [1] | p1 | reflect | 直後 m(50) を反射 |
| [2] | p2 | 防15 | 条件A（攻撃?）→false→h25 |
| [3] | p3 | 防30 | 条件B（回復?）→false→g15（trueだとm35被弾） |
| [4] | p4 | 攻40 | for3周。条件（攻撃?)→true→g10、攻40で貫通 |
| [5] | p5 | 攻5 | 条件C（攻撃?）→true→g15（型だけ合わせる） |
| [6] | p6 ×2 | 回30 | 回復必須（×2=60回復） |
| [7] | p7 | reflect | 条件D（回復?）→false→g20 |
| [8] | p8 | 回20 | |
| [9] | p9 ×2 | 攻10 | 条件E（攻撃?）→true→g10 |
| [10] | p10 ×3 acceptOnly attack | 攻40 | ×3=120 でとどめ |

## 実装方針
1. ローダーは `buildBodySlot` の1行のみ（明示 id）。他は不変。
2. 条件は `slot('pN')===<type>`。評価器 `evaluateCondition` は変更不要（`slot()` 対応済み）。
3. 敵カードは実装済み（`monster_guard`/`monster_heal`/`monster`）。
4. 改行は for 脱出直後に1回（既存 `newline`）。倍率/acceptOnly は既存キー。

## 検証方針
- **非回帰**：`buildBodySlot` 変更で 1-1〜5-1 の展開がバイト一致。
- **解答クリア**：`simulateBattle` に解答配置（p1..p10＝reflect/防15/防30/攻40/攻5/回30/reflect/回20/攻10/攻40）を入れ `win`。
- **引っかけ**：[4] に攻以外／[6] に回復以外／[2] に攻撃、等で非 win を 1〜2 ケース。
- build / lint。

## 要件トレーサビリティ
| 要件 | 設計 |
|---|---|
| 1（明示 id） | `buildBodySlot` 1行＋非回帰検証 |
| 2（パラメータ） | enemyId/HP/cards/id/acceptOnly/multiplier/for |
| 3（構造） | flow 記述（A〜E・ループ・改行） |
| 4（解答・意図） | simulateBattle 検証 |
| 5（敵カード・非回帰） | lockedCard＋他ステージ不変 |
