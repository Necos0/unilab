# タスク一覧: カード種別制限スロット（restricted-slot）

## 概要

実装は (1) `stagesLoader.js` に `acceptOnly` 取り込みと `lockedCard` との排他処理を追加 → (2) `battleStore.js` に `slotMetadata` state と `computeDropTransition` のガードを追加 → (3) `RestrictedSlotIcon` コンポーネント新規 → (4) `FlowchartArea.jsx` / `SlotNode.jsx` / `SlotNode.module.css` の UI 統合 → (5) `stages.json` に検証用ステージを追加して実機確認、の 5 タスクで進める。

タスク 1〜3 は依存関係なく並列着手可能（ローダー、ストア、アイコンコンポーネントは互いに独立）。タスク 4 で 1〜3 を統合し、タスク 5 で実機検証する。クリティカルパスは 1 → 4 → 5 と 2 → 4 → 5 の合流地点（タスク 4）。

合計タスク数：5 件 ｜ 想定工数：約 2 時間

## タスク

- [x] **1. `stagesLoader.js` の `acceptOnly` 対応と `lockedCard` 排他処理**  ✓ 完了
  - 内容：以下 4 点を変更する。
    1. **モジュールトップに `isValidAcceptOnly` ヘルパー追加**:
       ```js
       function isValidAcceptOnly(value) {
         return value === 'attack' || value === 'guard' || value === 'heal';
       }
       ```
    2. **`expandSlots` のシグネチャに `stageId` 引数を追加し、`acceptOnly` 取り込みと `lockedCard` 排他を実装**:
       ```js
       function expandSlots(slots, stageId) {
         return slots.map((raw, index) => {
           const id = raw.id ?? `slot-${index + 1}`;
           const position = raw.position ?? { x: SLOT_X_START + index * SLOT_X_STEP, y: SLOT_Y_DEFAULT };
           const expanded = { id, position };
           if (raw.lockedCard && raw.acceptOnly) {
             console.warn(`[stagesLoader] stage "${stageId}" slot "${id}": both lockedCard and acceptOnly are set. Ignoring acceptOnly.`);
             expanded.lockedCard = raw.lockedCard;
           } else if (raw.lockedCard) {
             expanded.lockedCard = raw.lockedCard;
           } else if (raw.acceptOnly) {
             if (isValidAcceptOnly(raw.acceptOnly)) {
               expanded.acceptOnly = raw.acceptOnly;
             } else {
               console.warn(`[stagesLoader] stage "${stageId}" slot "${id}": invalid acceptOnly "${raw.acceptOnly}". Ignoring.`);
             }
           }
           return expanded;
         });
       }
       ```
    3. **`processSubFlow` の通常スロット else 分岐に同じ排他処理を組み込む** （現状は `if (item.lockedCard) slot.lockedCard = item.lockedCard;` のみ）:
       ```js
       if (item.lockedCard && item.acceptOnly) {
         console.warn(`[stagesLoader] slot "${slotId}": both lockedCard and acceptOnly are set. Ignoring acceptOnly.`);
         slot.lockedCard = item.lockedCard;
       } else if (item.lockedCard) {
         slot.lockedCard = item.lockedCard;
       } else if (item.acceptOnly) {
         if (isValidAcceptOnly(item.acceptOnly)) {
           slot.acceptOnly = item.acceptOnly;
         } else {
           console.warn(`[stagesLoader] slot "${slotId}": invalid acceptOnly "${item.acceptOnly}". Ignoring.`);
         }
       }
       ```
    4. **`expandStage` で `expandSlots` を呼ぶ箇所に `stageId` を渡す**: 既存呼び出し `expandSlots(raw.slots ?? [])` を `expandSlots(raw.slots ?? [], stageId)` に変更。`expandStage` のシグネチャに `stageId` 引数を追加し、`for (const [key, raw] of ...)` の `key` を渡す。
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：なし
  - 完了条件：(a) `stages.json` のスロットに `"acceptOnly": "attack"` を書くと、ロード後の `stage.slots[N].acceptOnly === 'attack'` になる（DevTools コンソールで `stagesData` を確認）。(b) `lockedCard` と `acceptOnly` を両方書くと `console.warn` が出て `lockedCard` のみ残る。(c) 不正値（例: `"acceptOnly": "atack"`）も warning + 無視。(d) `acceptOnly` 未指定スロットは従来通り展開され、`acceptOnly` フィールドを持たない。
  - 対応要件：要件 1-1〜1-6、要件 2-1〜2-4

- [x] **2. `battleStore.js` の `slotMetadata` state 追加と `computeDropTransition` ガード**  ✓ 完了
  - 内容：以下 3 点を変更する。
    1. **state 初期値に `slotMetadata: {}` を追加**（既存の `guardShield: 0` 等が並ぶ箇所）。
    2. **モジュールスコープに `findCardByInstanceId` ヘルパー追加** （`computeDropTransition` の直前あたり）:
       ```js
       function findCardByInstanceId(state, instanceId) {
         const fromHand = state.handCards.find((c) => c.instanceId === instanceId);
         if (fromHand) return fromHand;
         for (const card of Object.values(state.slotAssignments)) {
           if (card && card.instanceId === instanceId) return card;
         }
         return null;
       }
       ```
    3. **`computeDropTransition` に acceptOnly ガードを追加**: 既存の `destCard?.locked` ガードの直後に挿入。
       ```js
       if (destination !== null) {
         const destCard = state.slotAssignments[destination];
         if (destCard?.locked) {
           return {};
         }
         // 新規: acceptOnly 不一致ガード
         const meta = state.slotMetadata[destination];
         if (meta?.acceptOnly) {
           const draggedCard = findCardByInstanceId(state, instanceId);
           if (draggedCard && draggedCard.id !== meta.acceptOnly) {
             return {};
           }
         }
       }
       ```
    4. **`initializeBattle` で `slotMetadata` を構築する処理を追加**: 既存の `slotAssignments` 構築ループ周辺で、`slot.acceptOnly` を持つスロットを `slotMetadata[slot.id] = { acceptOnly: slot.acceptOnly }` として収集し、`set({ ... slotMetadata })` に含める。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：なし（独立、タスク 1 と並列可能）
  - 完了条件：(a) `useBattleStore.getState().slotMetadata` が `acceptOnly` を持つスロットだけを含むマップになる。(b) `acceptOnly: 'attack'` のスロットに heal カードをドラッグ&ドロップしても、`slotAssignments` が更新されない（DevTools で確認）。(c) `acceptOnly: 'attack'` のスロットに attack カードをドロップすると通常通り `slotAssignments` が更新される。(d) `acceptOnly` 未指定スロットへのドロップは従来通り全カード受け入れ。
  - 対応要件：要件 4-2（ドロップ拒否のロジック）、要件 5-1, 5-2（実行時挙動は既存ロジック維持）

- [x] **3. `RestrictedSlotIcon` コンポーネント新規作成**  ✓ 完了
  - 内容：以下 2 ファイルを新規作成する。
    - **`RestrictedSlotIcon.jsx`**：`type` props（`'attack' | 'guard' | 'heal'`）に応じて 3 種類の SVG を返す。
      - attack: 縦バー (`x=6, y=1, w=2, h=7`) + 横ガード (`x=3, y=7, w=8, h=2`) + 短い柄 (`x=6, y=9, w=2, h=4`)、`fill: #ff4d4d`、柄部分は `#8a2a2a` の暗赤
      - guard: GuardBar.jsx の盾アイコンと同形・同色（`#4a8ef0`、5 段の rect）
      - heal: BattleScreen.jsx の CrossIcon と同形・同色（`#3ad430`、2 つの rect）
      - 共通: `viewBox="0 0 14 14"` ／ `shapeRendering="crispEdges"` ／ `className={styles.icon}`
      - 不正な `type` には `null` を返す（防御的）
    - **`RestrictedSlotIcon.module.css`**：
      ```css
      .icon {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 12px;
        height: 12px;
        pointer-events: none;
        z-index: 2;
      }
      ```
      `position: absolute` でスロット内側右上に配置。`z-index: 2` で配置済みカード（`DraggableCard`）の上に表示。`pointer-events: none` でドラッグ操作を奪わない。
  - ファイル：`frontend/src/features/battle/flowchart/RestrictedSlotIcon.jsx`（新規）、`frontend/src/features/battle/flowchart/RestrictedSlotIcon.module.css`（新規）
  - 依存：なし（独立、タスク 1, 2 と並列可能）
  - 完了条件：単体では検証しにくいが、タスク 4 完了後に「`acceptOnly: 'attack'` のスロットの右上に小さな赤い剣アイコンが表示される」状態が完了。`<RestrictedSlotIcon type="invalid" />` を呼んでもクラッシュせず `null` が返る。
  - 対応要件：要件 3-2〜3-7（アイコンデザインとサイズ・配置）

- [x] **4. `FlowchartArea.jsx` / `SlotNode.jsx` / `SlotNode.module.css` の UI 統合**  ✓ 完了
  - 内容：以下 3 ファイルを変更する。
    - **`FlowchartArea.jsx` の `slotsToNodes`**：
      ```jsx
      function slotsToNodes(slots) {
        return slots.map((slot) => ({
          id: slot.id,
          type: 'slot',
          position: slot.position,
          data: { acceptOnly: slot.acceptOnly },
        }));
      }
      ```
      `slot.acceptOnly` が undefined なら `data.acceptOnly === undefined` で SlotNode 側がアイコン非表示にする。
    - **`SlotNode.jsx`**：
      1. 冒頭 import に `import RestrictedSlotIcon from './RestrictedSlotIcon';` を追加。
      2. 関数シグネチャに `data` を追加: `function SlotNode({ id, data })`。
      3. `data?.acceptOnly` を変数として取り出す。
      4. ドラッグ中カードの id を派生計算する selector を追加:
         ```jsx
         const activeCardId = useBattleStore((s) => {
           const aid = s.activeInstanceId;
           if (!aid) return null;
           const fromHand = s.handCards.find((c) => c.instanceId === aid);
           if (fromHand) return fromHand.id;
           for (const card of Object.values(s.slotAssignments)) {
             if (card && card.instanceId === aid) return card.id;
           }
           return null;
         });
         ```
      5. `showReject` を計算: `const showReject = isOver && !!acceptOnly && activeCardId !== null && activeCardId !== acceptOnly;`
      6. className 配列を以下に書き換える（`isOver` を `!showReject` 条件下に変更、`rejectHover` を新規追加）:
         ```jsx
         const className = [
           styles.slot,
           showAsFilled && styles.filled,
           isDragActive && styles.dropTarget,
           isOver && !showReject && styles.isOver,
           showReject && styles.rejectHover,
           (isExecuting || isTransitioning) && styles.locked,
           isActive && styles.active,
           isTraversed && styles.traversed,
           isLockedCard && styles.lockedCard,
         ].filter(Boolean).join(' ');
         ```
      7. return 内の DraggableCard の直後（または Handle の直後あたり）に `{acceptOnly && <RestrictedSlotIcon type={acceptOnly} />}` を追加。
    - **`SlotNode.module.css`**：以下 2 セレクタを追加（既存の `.isOver` の付近）。
      ```css
      .slot.rejectHover {
        border-color: #ff4d4d;
        background: rgba(255, 77, 77, 0.08);
      }
      .slot.filled.rejectHover {
        outline: 2px solid #ff4d4d;
        outline-offset: 2px;
        border-radius: 6px;
        background: rgba(255, 77, 77, 0.08);
      }
      ```
  - ファイル：`frontend/src/features/battle/flowchart/FlowchartArea.jsx`、`frontend/src/features/battle/flowchart/SlotNode.jsx`、`frontend/src/features/battle/flowchart/SlotNode.module.css`
  - 依存：タスク 1（`slot.acceptOnly` が展開される）、タスク 2（`slotMetadata` ガードと連動）、タスク 3（`RestrictedSlotIcon` を import）
  - 完了条件：(a) `acceptOnly` 指定スロットを開くとアイコンが右上に表示される（タスク 5 で実機検証）。(b) 不一致カードをドラッグしてスロットにホバーすると赤枠ハイライト。(c) 一致カードのホバーは従来通り青枠。(d) ドロップ拒否時、カードが手札に戻る or 元のスロットに戻る。
  - 対応要件：要件 3-1, 3-5, 3-6（描画タイミング・常時表示）、要件 4-1, 4-3〜4-5（赤/青ハイライトの使い分け）、要件 6-1〜6-4（acceptOnly 未指定の後方互換）

- [ ] **5. `stages.json` に検証用ステージを追加 + 実機検証**
  - 内容：既存ステージのうち 1 つに `acceptOnly` 制限を追加するか、新規ステージ（例: ステージ 4-1）を作成して制限スロットを含める。
    例（既存 3-2 を一部書き換え or 新規ステージ）:
    ```jsonc
    "4-1": {
      "enemyId": "wolf",
      "cards": [
        { "id": "attack", "power": 20 },
        { "id": "guard",  "power": 30 },
        { "id": "heal",   "power": 40 }
      ],
      "slots": [
        { "acceptOnly": "attack" },
        { "acceptOnly": "guard" },
        { "acceptOnly": "heal" },
        {}
      ]
    }
    ```
    `demoStageIds` 配列に `"4-1"` を追加してデモボタンから選べるようにする。
  - ファイル：`frontend/src/data/stages.json`
  - 依存：タスク 1, 2, 3, 4 すべて
  - 完了条件：(a) 戦闘デモボタンから `4-1` を選択 → 戦闘画面進入。(b) スロット 1（attack 制限）の右上に赤い剣アイコン、スロット 2（guard）に青い盾、スロット 3（heal）に緑十字、スロット 4 は無印が表示される。(c) attack カードをスロット 2 にドラッグ → 赤枠ハイライト + ドロップ不可で手札に戻る。(d) attack カードをスロット 1 にドラッグ → 青枠ハイライト + ドロップ成功。(e) スロット 4（無制限）には全カード配置可能。(f) `lockedCard` と `acceptOnly` を両方書いたスロットを試すと console に warning が出て `lockedCard` が優先される。(g) マップ 1 のステージ（1-1〜1-4）が引き続き正常動作する。
  - 対応要件：要件 1（acceptOnly データモデル）、要件 3（視覚アイコン）、要件 4（ドロップ拒否）、要件 5（実行時挙動）、要件 6（非破壊性）の総合検証

## トレーサビリティ確認

| 要件 | 対応タスク |
|---|---|
| 1-1〜1-4（acceptOnly フィールドの 3 種類 + 未指定対応） | タスク 1（`expandSlots` / `processSubFlow` の取り込み）、タスク 5（検証） |
| 1-5（不正値の warning） | タスク 1（`isValidAcceptOnly` ガード） |
| 1-6（線形 / flow 両形式対応） | タスク 1（両関数で同じ排他処理） |
| 2-1〜2-4（lockedCard 排他、warning、優先順位） | タスク 1（ローダー内の if/else if 構造） |
| 3-1, 3-5, 3-6（アイコン常時表示、配置済みカード上でも） | タスク 3（CSS `z-index: 2`）、タスク 4（条件付き render） |
| 3-2〜3-4（attack/guard/heal アイコンの色とデザイン） | タスク 3（3 種類の SVG） |
| 3-7（HpBar/GuardBar との意匠統一） | タスク 3（guard は GuardBar 盾と同形・heal は CrossIcon と同形） |
| 4-1, 4-3, 4-5（赤/青ハイライト切替、待機時はハイライトなし） | タスク 4（`.rejectHover` / `.isOver` 排他クラス）、タスク 4 CSS |
| 4-2, 4-4（ドロップ拒否 vs 受け入れ） | タスク 2（`computeDropTransition` ガード） |
| 5-1〜5-3（実行時挙動は既存ロジック維持） | コード変更なし（タスク 1〜4 はドロップ時の制限のみ追加） |
| 6-1〜6-4（既存挙動の非破壊性） | 全タスクで `acceptOnly` 未指定時は従来通りの分岐構造 |
