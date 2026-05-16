# タスク一覧: 条件分岐ステージの短縮形式ローダー（loader-branching-shortcut）

## 概要

実装は (1) `expandFlow` / `processSubFlow` / `buildEdge` / `isCondition` の新規ヘルパー関数群を `stagesLoader.js` に追加 → (2) `expandStage` のルーティングを修正して `flow` キー有無で分岐 → (3) `stages.json` のステージ 2-1 を `flow` 形式に書き換え、の 3 ステージで進める。

タスク 1 はヘルパー関数の追加だけで既存挙動に影響しない（誰も呼ばないため）。タスク 2 でルーティングを繋いだ時点で `flow` 形式のステージが動くようになる（ただし `flow` 形式のステージはまだ存在しないので回帰のみ確認）。タスク 3 で実際に短縮形式の動作が確認できる。クリティカルパスは線形（1 → 2 → 3）で並列化の余地は少ない。

合計タスク数：3 件 ｜ 想定工数：約 1.5〜2 時間

## タスク

- [x] **1. `stagesLoader.js` に `expandFlow` / `processSubFlow` / `buildEdge` / `isCondition` を新規追加する**  ✓ 完了
  - 内容：`stagesLoader.js` 内（既存の `buildLinearEdges` 関数の後ろあたり、`expandStage` の前）に以下 4 関数を追加する。
    1. **`isCondition(item)`**: `typeof item?.condition === 'string'` を返す純粋関数。
    2. **`buildEdge(ending, targetId)`**: `{ id: 'e-${ending.nodeId}-${targetId}', source, target, sourceHandle? }` のエッジオブジェクトを返す。`ending.sourceHandle` が undefined のときは `sourceHandle` キーを含めない（既存の線形エッジと同形式）。
    3. **`processSubFlow(items, options)`**: サブフロー（メイン経路 or 分岐経路）を再帰的に展開する内部ヘルパー。`options = { startColumn, yLevel, prevNodeId, prevSourceHandle, ctx }`。各要素を順に走査し、通常スロット要素なら `ctx.slots` / `ctx.edges` に追加・連番採番、条件分岐要素なら `ctx.conditions` に追加 + True / False 経路を再帰展開。戻り値は `{ endings: Array<{nodeId, sourceHandle?}>, endColumn: number }`。
    4. **`expandFlow(flow)`**: メインの公開関数。`ctx` を初期化（counters, slots[], conditions[], edges[]）、`Array.isArray(flow)` ガード、`processSubFlow` をメイン経路で呼ぶ、その戻り値の `endings` から各 ending を `goal` に繋ぐエッジを追加、最後に `{ slots, conditions, edges, start, goal }` を返す。`start.position = { x: -120, y: 120 }`、`goal.position = { x: 80 + endColumn * 200, y: 120 }`。
  - 内部状態 `ctx` の構造：
    ```js
    const ctx = {
      slotCounter: 0,
      condCounter: 0,
      slots: [],
      conditions: [],
      edges: [],
    };
    ```
  - 座標ルール：
    - 通常スロット: `x = 80 + column * 200`、`y = yLevel`
    - 条件分岐: 同上
    - True 経路の `yLevel` = 親 `yLevel`（同じ高さで直進）
    - False 経路の `yLevel` = 親 `yLevel + 160`（下にずらす）
    - 合流時の `column` = `max(trueResult.endColumn, falseResult.endColumn)`
  - id 採番：通常スロットは `slot-${++ctx.slotCounter}`、条件分岐は `cond-${++ctx.condCounter}`、`++` 前置で 1 から始まる。
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：なし
  - 完了条件：DevTools コンソールから以下の動作を確認できる（仮の `flow` を作って呼ぶ）：
    - 単純な線形 `[{}, {}]` で 2 つの slot と 3 つのエッジ（start→slot-1→slot-2→goal）が生成される
    - 条件分岐 1 個を含む `flow` を渡すと、`slots` / `conditions` / `edges` の各配列に正しい要素が並ぶ
    - True / False 両方が空の条件分岐で、cond から合流先（または goal）へ 2 本のエッジ（`sourceHandle: 'true'/'false'`）が引かれる
    - 入れ子分岐（`true` の中にさらに `condition`）でも再帰的に展開される
  - 対応要件：要件 2-1〜2-6、要件 3-1〜3-3、要件 4-1〜4-7、要件 5-1〜5-9、要件 7-1〜7-3、要件 8-1〜8-3

- [x] **2. `expandStage` を `flow` / `slots` のルーティングに修正する**  ✓ 完了
  - 内容：既存の `expandStage` 関数の先頭に以下のルーティングを追加する。
    ```js
    function expandStage(raw) {
      if (raw.flow) {
        if (raw.slots) {
          console.warn(
            `[stagesLoader] both \`flow\` and \`slots\` defined for stage, using \`flow\``
          );
        }
        const expanded = expandFlow(raw.flow);
        return {
          enemyId: raw.enemyId,
          cards: raw.cards ?? [],
          ...expanded,  // slots / conditions / edges / start / goal
        };
      }
      // 既存の slots ルート（変更なし）
      const slots = expandSlots(raw.slots ?? []);
      return {
        enemyId: raw.enemyId,
        cards: raw.cards ?? [],
        slots,
        conditions: expandConditions(raw.conditions),
        start: expandStart(raw.start),
        goal: expandGoal(raw.goal, slots.length),
        edges: raw.edges ?? buildLinearEdges(slots),
      };
    }
    ```
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：タスク 1
  - 完了条件：(a) マップ 1 のステージ（1-1〜1-4、`slots` キーのみ）が従来通り動作する（戦闘画面が崩れない）。(b) ステージ 2-1 はまだ明示形式のままだが、`raw.flow` が undefined なので既存ルートで動作する。(c) コンソールに警告ログが出ない（両キー定義は現状ないため）。
  - 対応要件：要件 1-1, 1-2, 1-3, 1-4, 9-1, 9-3

- [x] **3. `stages.json` のステージ 2-1 を `flow` 形式に書き換える**  ✓ 完了
  - 内容：既存の明示形式（`start` / `slots` / `conditions` / `goal` / `edges` の 5 フィールド）を `flow` キーの 1 フィールドに置き換える。
    ```json
    "2-1": {
      "enemyId": "wolf",
      "cards": [
        { "id": "attack", "power": 10 },
        { "id": "heal",   "power": 10 }
      ],
      "flow": [
        { "lockedCard": { "id": "monster", "power": 50 } },
        {},
        {
          "condition": "playerHp > 50",
          "true": [
            { "lockedCard": { "id": "attack", "power": 20 } }
          ],
          "false": []
        },
        {}
      ]
    }
    ```
  - ファイル：`frontend/src/data/stages.json`
  - 依存：タスク 2
  - 完了条件：(a) ブラウザでステージ 2-1 をデモバトルで起動し、菱形ノードと 2 本の分岐エッジが正しく描画される。(b) `playerHp > 50` の評価結果に応じて True / False 経路を辿る（明示形式時と同じ挙動）。(c) ステージのファイル行数が約 22 行 → 約 14 行に短縮される。(d) マップ 1 のステージ（1-1〜1-4）が引き続き動作する。
  - 対応要件：要件 6-1, 6-2, 6-3, 9-2

## トレーサビリティ確認

| 要件 | 対応タスク |
|---|---|
| 1-1（`flow` キー解析） | タスク 1（`expandFlow`）、タスク 2（ルーティング） |
| 1-2（`slots` のみは既存ルート） | タスク 2（else 分岐） |
| 1-3（両キー時の警告） | タスク 2（`console.warn`） |
| 1-4（戻り値の形が既存と同じ） | タスク 1（`expandFlow` の戻り値構造）、タスク 2（`...expanded` スプレッド） |
| 2-1〜2-5（`flow` 要素の種類と省略可） | タスク 1（`isCondition`、`item.true ?? []`） |
| 2-6（追加フィールド無視） | タスク 1（`condition` 分岐で `expression` のみ抽出） |
| 3-1〜3-3（id の自動採番） | タスク 1（`ctx.slotCounter` / `ctx.condCounter`） |
| 4-1〜4-7（座標の自動計算） | タスク 1（`column * 200 + 80`、`yLevel + 160`、合流時 `max`） |
| 5-1〜5-9（edges の自動生成） | タスク 1（`buildEdge`、`endings` 配列、`sourceHandle` 付与） |
| 6-1〜6-3（ステージ 2-1 の書き換え） | タスク 3 |
| 7-1〜7-3（入れ子分岐への対応） | タスク 1（`processSubFlow` の再帰呼び出し） |
| 8-1〜8-3（バリデーション） | タスク 1（`Array.isArray` ガード、`?? []` フォールバック） |
| 9-1（マップ 1 への影響なし） | タスク 2（既存 `slots` ルート維持） |
| 9-2（ステージ 2-1 が既存実装で動く） | タスク 3（戻り値の形が同じため） |
| 9-3（`stagesLoader.js` 内に追加、新規ファイルなし） | タスク 1（同ファイル内へ関数追加） |
