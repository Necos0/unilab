# タスク一覧: 倍率スロット（multiplier-slot）

## 概要

実装は (1) `stagesLoader.js` に `multiplier` 取り込みと検証を追加 → (2) `battleStore.js` の `slotMetadata` 拡張と `scheduleNodePhase` の倍率適用 → (3) `MultiplierIndicator` 新規 + `RestrictedSlotIcon` の左上移設 → (4) `FlowchartArea.jsx` / `SlotNode.jsx` の UI 統合 → (5) `stages.json` に検証用ステージ追加 + 実機検証、の 5 タスクで進める。

タスク 1〜3 は依存関係なく並列着手可能。タスク 4 で 1〜3 を統合し、タスク 5 で検証する。クリティカルパスは 1 / 2 / 3 → 4 → 5 の合流地点（タスク 4）。

合計タスク数：5 件 ｜ 想定工数：約 2 時間

## タスク

- [x] **1. `stagesLoader.js` の `multiplier` フィールド対応**  ✓ 完了
  - 内容：以下 3 点を変更する。
    1. **`isValidMultiplier` ヘルパーをモジュールトップに追加**（`isValidAcceptOnly` の隣）:
       ```js
       function isValidMultiplier(value) {
         return Number.isInteger(value) && value >= 2;
       }
       ```
       `multiplier: 1` も無効扱い（要件 1-5、明示指定は許容するが内部的には未指定と同義）。
    2. **`expandSlots` を「全フィールド独立」構造に整理 + multiplier 取り込み**: `lockedCard` / `acceptOnly` / `multiplier` の 3 つを独立 `if` ブロックに分解（`lockedCard && acceptOnly` のクロスフィールド排他警告は撤去）。multiplier ブロック:
       ```js
       if (raw.multiplier !== undefined) {
         if (isValidMultiplier(raw.multiplier)) {
           expanded.multiplier = raw.multiplier;
         } else {
           console.warn(
             `[stagesLoader] stage "${stageId}" slot "${id}": invalid multiplier "${raw.multiplier}". Must be integer >= 2. Ignoring.`
           );
         }
       }
       ```
    3. **`processSubFlow` の通常スロット else 分岐も同じ構造に整理**: `lockedCard` / `acceptOnly` / `multiplier` を独立 `if` ブロックに分解 + multiplier チェックを追加（ステージ ID は持たないので警告メッセージは `slot-N` ID のみで構成）。

    > **設計変更メモ**: 当初案では `lockedCard && acceptOnly` の排他警告を残す予定だったが、「locked スロットは全ドロップを拒否するので acceptOnly は無害に無視される」ため警告を撤去し、3 フィールドを完全独立に整理した（コード簡素化）。これにより restricted-slot 初期実装の排他警告も消えるが、完了済み restricted-slot spec は更新しない（指示通り）。
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：なし
  - 完了条件：(a) スロット定義に `"multiplier": 2` を書くと、ロード後の `stage.slots[N].multiplier === 2` になる（DevTools コンソールで `stagesData` を確認）。(b) `multiplier: 1.5` / `"2"` / `-1` / `0` / `1` のような不正値はすべて warning + 無視され、`multiplier` フィールドが付かない。(c) `lockedCard` / `acceptOnly` と同時指定しても両方が正常に展開される（multiplier は他フィールドと完全独立）。(d) flow 形式のステージでも同じ挙動。
  - 対応要件：要件 1-1〜1-6、要件 4-1〜4-3（multiplier と他フィールドの共存）

- [x] **2. `battleStore.js` の `slotMetadata` 拡張と `scheduleNodePhase` 倍率適用**  ✓ 完了
  - 内容：以下 2 点を変更する。
    1. **`buildSlotMetadataFromStage` を `multiplier` も含める形に拡張**:
       ```js
       function buildSlotMetadataFromStage(stage) {
         const metadata = {};
         for (const slot of stage.slots ?? []) {
           const entry = {};
           if (slot.acceptOnly) entry.acceptOnly = slot.acceptOnly;
           if (slot.multiplier) entry.multiplier = slot.multiplier;
           if (Object.keys(entry).length > 0) {
             metadata[slot.id] = entry;
           }
         }
         return metadata;
       }
       ```
       `acceptOnly` と `multiplier` のどちらか（または両方）があるスロットのみ map に登録する設計を維持。
    2. **`scheduleNodePhase` のカード効果分岐に multiplier 適用を追加**: `const card = get().slotAssignments[nodeId];` の直下に `multiplier` 取得行を追加し、attack / heal / guard のブランチで `card.power` に掛ける（monster / reflect は変更なし）。
       ```js
       const card = get().slotAssignments[nodeId];
       const multiplier = get().slotMetadata[nodeId]?.multiplier ?? 1;

       if (card && card.id === 'attack' && card.power > 0) {
         get().applyEnemyDamage(card.power * multiplier);
       }
       if (card && card.id === 'monster' && card.power > 0) {
         // multiplier は適用しない（要件 2-5）
         if (get().reflectActive) {
           get().applyReflectDamage(card.power);
         } else {
           get().consumeShieldOnDamage(card.power);
         }
       }
       if (card && card.id === 'heal' && card.power > 0) {
         get().applyPlayerHeal(card.power * multiplier);
       }
       if (card && card.id === 'guard' && card.power > 0) {
         get().applyGuard(card.power * multiplier);
       }
       if (card && card.id === 'reflect') {
         // multiplier は適用しない（要件 2-6、power フィールドなし）
         get().applyReflect();
       }
       ```
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：なし（独立、タスク 1 と並列可能）
  - 完了条件：(a) `useBattleStore.getState().slotMetadata` が `multiplier` 持ちスロットのエントリを含む。`{ acceptOnly, multiplier }` のように両方持つ場合もある。(b) `multiplier: 2` のスロットを attack 10 のカードが通ると `applyEnemyDamage(20)` が呼ばれて敵 HP が 20 減る。(c) monster カードが multiplier スロットを通っても倍率は適用されない（既存ダメージ量のまま）。(d) multiplier 未指定スロットは `?? 1` で従来通り。
  - 対応要件：要件 2-1〜2-7（効果適用と監視）、要件 4-2（locked card への倍率も適用）、要件 5-1〜5-4（既存挙動の維持）

- [x] **3. `MultiplierIndicator` 新規作成 + `RestrictedSlotIcon` 左上移設**  ✓ 完了
  - 内容：以下 3 ファイルを変更（2 ファイル新規 + 1 ファイル既存改修）。
    - **`MultiplierIndicator.jsx`**（新規）:
      ```jsx
      import styles from './MultiplierIndicator.module.css';

      function MultiplierIndicator({ value }) {
        return <div className={styles.indicator}>x{value}</div>;
      }

      export default MultiplierIndicator;
      ```
    - **`MultiplierIndicator.module.css`**（新規）:
      ```css
      .indicator {
        position: absolute;
        top: 2px;
        right: 2px;
        color: #f5f5f5;
        font-family: 'Press Start 2P', monospace;
        font-size: 9px;
        font-weight: bold;
        text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
        pointer-events: none;
        z-index: 2;
        user-select: none;
      }
      ```
    - **`RestrictedSlotIcon.module.css`**（既存改修）: `right: 2px;` → `left: 2px;` の 1 文字列変更。
      ```css
      .icon {
        position: absolute;
        top: 2px;
        left: 2px;       /* 変更前: right: 2px */
        width: 12px;
        height: 12px;
        pointer-events: none;
        z-index: 2;
      }
      ```
  - ファイル：`frontend/src/features/battle/flowchart/MultiplierIndicator.jsx`（新規）、`frontend/src/features/battle/flowchart/MultiplierIndicator.module.css`（新規）、`frontend/src/features/battle/flowchart/RestrictedSlotIcon.module.css`（既存改修）
  - 依存：なし（独立、タスク 1, 2 と並列可能）
  - 完了条件：単体では検証しにくいが、タスク 4 完了後に「`multiplier: 2` のスロット右上に白文字で `x2` 表示」「`acceptOnly` 制限スロットのアイコンが左上に表示される」状態が完了。
  - 対応要件：要件 3-1〜3-6（インジケータ位置・色・常時表示）、要件 4-4（左右配置の分離）

- [x] **4. `FlowchartArea.jsx` / `SlotNode.jsx` の UI 統合**  ✓ 完了
  - 内容：以下 2 ファイルを変更する。
    - **`FlowchartArea.jsx` の `slotsToNodes`**: `data` に `multiplier` を追加。
      ```jsx
      function slotsToNodes(slots) {
        return slots.map((slot) => ({
          id: slot.id,
          type: 'slot',
          position: slot.position,
          data: { acceptOnly: slot.acceptOnly, multiplier: slot.multiplier },
        }));
      }
      ```
    - **`SlotNode.jsx`**:
      1. import 追加: `import MultiplierIndicator from './MultiplierIndicator';`
      2. 派生変数追加（既存 `acceptOnly` の隣）: `const multiplier = data?.multiplier;`
      3. return 内に `<MultiplierIndicator>` を追加（既存 `<RestrictedSlotIcon>` の隣、兄弟要素として）:
         ```jsx
         {acceptOnly && <RestrictedSlotIcon type={acceptOnly} />}
         {multiplier && <MultiplierIndicator value={multiplier} />}
         ```
  - ファイル：`frontend/src/features/battle/flowchart/FlowchartArea.jsx`、`frontend/src/features/battle/flowchart/SlotNode.jsx`
  - 依存：タスク 1（`slot.multiplier` が展開される）、タスク 2（`slotMetadata` 連動）、タスク 3（`MultiplierIndicator` を import + acceptOnly 左上で衝突回避）
  - 完了条件：(a) `multiplier` 指定スロットの右上に `x<n>` 表示が出る。(b) `acceptOnly` 指定スロットのアイコンが左上に表示される（移設）。(c) 両方指定スロットでは左上にアイコン、右上にテキストが並ぶ。(d) multiplier 未指定スロットはインジケータ非表示。
  - 対応要件：要件 3-1〜3-5（描画タイミング・配置）、要件 4-4（acceptOnly と multiplier の配置分離）

- [x] **5. `stages.json` に検証用ステージ追加 + 実機検証**  ✓ 完了
  - 内容：ステージ 4-2 を新規追加し、`demoStageIds` 配列に追加する。複数の機能組み合わせを含めて網羅検証する。
    ```jsonc
    "4-2": {
      "enemyId": "wolf",
      "cards": [
        { "id": "attack", "power": 10 },
        { "id": "heal",   "power": 20 },
        { "id": "guard",  "power": 15 }
      ],
      "slots": [
        { "multiplier": 2 },
        { "lockedCard": { "id": "attack", "power": 10 }, "multiplier": 3 },
        { "acceptOnly": "heal", "multiplier": 2 },
        {}
      ]
    }
    ```
    `demoStageIds` に `"4-2"` を追加。
  - ファイル：`frontend/src/data/stages.json`
  - 依存：タスク 1, 2, 3, 4 すべて
  - 完了条件：(a) デモボタンから `4-2` を選択 → 戦闘画面進入。(b) スロット 1（multiplier 2）の右上に白文字 `x2`、スロット 4 はインジケータなし。(c) スロット 2 は locked attack 10 表示 + 右上に `x3`（左上はアイコンなし）。(d) スロット 3 は左上に緑十字アイコン（heal 制限）+ 右上に `x2`。(e) 手札の attack 10 をスロット 1 に置いて実行 → 敵 HP が 20 減る（10 × 2）。(f) スロット 2（locked attack 10 × 3）を通過 → 敵 HP が 30 減る。(g) heal 20 をスロット 3 に置いて実行 → プレイヤー HP が 40 回復（20 × 2、max クランプ）。(h) 既存ステージ（1-1〜4-1）が引き続き正常動作する。
  - 対応要件：要件 1（multiplier データモデル）、要件 2（効果適用）、要件 3（インジケータ）、要件 4（共存）、要件 5（非破壊性）の総合検証

## トレーサビリティ確認

| 要件 | 対応タスク |
|---|---|
| 1-1〜1-4（multiplier フィールドの受け入れ + 検証） | タスク 1（`isValidMultiplier` + ローダー取り込み） |
| 1-5（`multiplier: 1` 明示も無効扱い） | タスク 1（`isValidMultiplier` で `>= 2` 判定） |
| 1-6（線形 / flow 両形式対応） | タスク 1（両関数で同じパターン） |
| 2-1（attack の倍率適用） | タスク 2（attack ブランチ） |
| 2-2（heal の倍率適用） | タスク 2（heal ブランチ） |
| 2-3（guard の倍率適用） | タスク 2（guard ブランチ） |
| 2-4（locked card にも倍率適用） | タスク 2（`card.id` で分岐、locked かどうかは不問） |
| 2-5（monster は倍率非適用） | タスク 2（monster ブランチで multiplier を掛けない） |
| 2-6（reflect は倍率非適用） | タスク 2（reflect ブランチも multiplier を掛けない） |
| 2-7（未指定スロットは × 1） | タスク 2（`?? 1` フォールバック） |
| 3-1（右上 `x<n>` 白色） | タスク 3（CSS `right: 2px` + `color: #f5f5f5`） |
| 3-2, 3-3（常時表示） | タスク 4（`{multiplier && ...}` 条件付き render） |
| 3-4（acceptOnly と衝突しない位置） | タスク 3（acceptOnly を `left: 2px` へ移設） |
| 3-5（未指定スロットは非表示） | タスク 4（`{multiplier && ...}` で false なら未描画） |
| 3-6（ピクセル風フォント、`#f5f5f5`） | タスク 3（`font-family: 'Press Start 2P'`） |
| 4-1〜4-3（acceptOnly / lockedCard との共存） | タスク 1（独立ブロック）、タスク 2（独立に処理） |
| 4-4（左右配置の分離） | タスク 3（CSS `left` / `right` 分離） |
| 5-1〜5-4（既存挙動の維持） | 全タスクで「multiplier 未指定 / `?? 1`」分岐 |
