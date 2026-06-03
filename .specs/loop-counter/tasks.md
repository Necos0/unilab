# タスク一覧: ループカウンタ機能

## 概要

データ層（ローダー）→ 状態層（`battleStore`）→ シミュレーション → 描画層（`SlotNode` / `MultiplierIndicator`）→ アセット → ステージ定義、の順でボトムアップに積む。これにより各層は完成済みの下位層に依存できる。クリティカルパスは「ローダーのスキーマ拡張 → battleStore の state＆実行統合 → SlotNode のペア判定と発光」。アセット（`counter.png`）はコードから独立しているため任意のタイミングで並行作業可能。

合計タスク数：15件 ｜ 想定工数：12〜15時間（アセット制作除く）

## タスク

- [x] **1. counter カード画像アセット `counter.png` の制作**  ✓ 完了（暫定 SVG プレースホルダーで対応）
  - 内容：本来は力こぶ／パワーアップを連想させるピクセルアート風カードイラストを制作する。デザイン班から本番 `counter.png` が届くまでの暫定として、シンプルな金枠＋「+1」「COUNTER」ラベルの SVG プレースホルダー（`public/cards/counter.svg`）を配置し、`Card.jsx` の拡張子解決に `counter → .svg` の三項演算分岐を入れた。
  - ファイル：`frontend/public/cards/counter.svg`（新規）、`frontend/src/features/cards/Card.jsx`（拡張子分岐追加）
  - 依存：なし（他タスクと並行可能）
  - 完了条件：SVG が存在し、`Card.jsx` が counter のときだけ `.svg` を読むようになっている。本番 `counter.png` が届いた時点で、`Card.jsx` の三項演算を削除し `counter.svg` をリポジトリから削除して切り替える。

- [x] **2. ローダー: `isValidMultiplier` をオブジェクト記法対応に拡張**  ✓ 完了
  - 内容：`isValidMultiplier(value)` を「2 以上の整数」または「`{ counterRef: 非空文字列 }`」の Sum 型を受け入れるよう拡張する。既存の数値リテラル経路（`multiplier: 5` 等）は完全後方互換。
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：なし
  - 完了条件：既存ステージ（1-X〜5-X、`multiplier: 数値` も含む）のローダー展開結果が変わらないことを `node` REPL もしくはユニットテストで確認。`multiplier: { counterRef: "c1" }` を含むステージで `slot.multiplier` がそのままオブジェクトとして展開後の slot に保持される。

- [x] **3. ローダー: counter `lockedCard` の `counterId` 検証と `buildBodySlot` / `expandSlots` での透過**  ✓ 完了（warn メッセージ修正含む）
  - 内容：`buildBodySlot` および `expandSlots` 内の `lockedCard` コピー処理に分岐を追加し、`raw.lockedCard.id === 'counter'` のときに `counterId` が非空文字列かを検証する。非空ならそのまま `slot.lockedCard` にコピー、不正なら `console.warn` ＋ `{ id: 'counter' }`（counterId を剥がす）に縮退。
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：タスク2
  - 完了条件：design.md の `1-2` で示した分岐が実装され、不正 `counterId`（空文字／非文字列）に対して warn が出る。それ以外の lockedCard 既存挙動は不変。

- [x] **4. ローダー: `validateCounterPairs` を新設し `expandStage` から呼ぶ**  ✓ 完了
  - 内容：`expandStage` の最後（`flow` ルート・`slots` ルート両方）に `validateCounterPairs(stage, stageId)` を追加。`stage.slots` を 1 度走査して (1) 重複 `counterId` を検出 → 2 つ目以降の `lockedCard` から `counterId` を剥がす、(2) `slot.multiplier` がオブジェクトで `counterRef` が指す `counterId` が同ステージに存在しない場合 `slot.multiplier` を `delete` する。両ケースで `console.warn` を出す。
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：タスク3
  - 完了条件：意図的に重複 `counterId` および浮遊 `counterRef` を持つテスト用ステージで warn が出て、対応する `slot.lockedCard.counterId` / `slot.multiplier` が無害化される。既存ステージは無変化。

- [x] **5. battleStore: `counterValues` / `activeCounterId` state の宣言と `initializeBattle` / `retryFromFail` での初期化**  ✓ 完了
  - 内容：`battleStore.js` の initial state に `counterValues: {}` と `activeCounterId: null` を追加。`initializeBattle(stage)` 内で `stage.slots` を走査し、`lockedCard?.id === 'counter'` を持つスロットの `counterId` を集めて `Object.fromEntries(ids.map(id => [id, 0]))` を `counterValues` に投入。`retryFromFail` でも同じ初期化を行う（または `counterValues` を 0 リセット）。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク4
  - 完了条件：stage 4-3（タスク15 で書き換え後）または手動データで `counterValues: { c1: 0 }`、`activeCounterId: null` が `initializeBattle` 後に観測できる。counter スロットを持たない既存ステージでは `counterValues: {}` のままで他の state に影響なし。

- [x] **6. battleStore: `incrementCounter` action を追加**  ✓ 完了
  - 内容：`set` ベースの action `incrementCounter(counterId)` を追加。`counterValues[counterId] === undefined` のときは何もせず（防御的早期 return）、それ以外は新しいオブジェクトで +1 した値を入れる。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク5
  - 完了条件：React DevTools あるいは zustand のセレクタ経由で `incrementCounter('c1')` を呼ぶと `counterValues.c1` が +1 される。未登録 ID では state が変わらない。

- [x] **7. battleStore: `buildSlotMetadataFromStage` を新 multiplier 形に対応**  ✓ 完了
  - 内容：`slot.multiplier` を見る箇所で型分岐を追加：数値なら従来どおり `entry.multiplier = slot.multiplier`、オブジェクトかつ `counterRef` を持つなら `entry.counterRef = slot.multiplier.counterRef` を設定する（`multiplier` キーは入れない）。`acceptOnly` 経路は無変更。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク5
  - 完了条件：`slotMetadata` が design.md 「データモデル」の表どおりに振り分けられる。既存ステージ（数値リテラル）で metadata の中身が変わらない。

- [x] **8. battleStore: `scheduleNodePhase` に counter 処理と倍率三分岐を統合、`scheduleEdgePhase` で `activeCounterId` をクリア**  ✓ 完了（multiplier 三分岐の typo 修正含む）
  - 内容：
    - `scheduleNodePhase` の card 効果分岐の冒頭に counter 処理を追加：`card.id === 'counter'` なら `incrementCounter(card.counterId)` を呼び、`set({ activeCounterId: card.counterId })`。
    - 倍率取得の既存 1 行（`const multiplier = get().slotMetadata[nodeId]?.multiplier ?? 1`）を、`typeof meta?.multiplier === 'number'` → 数値、`typeof meta?.counterRef === 'string'` → `counterValues[counterRef] ?? 0`、それ以外 → 1 の三分岐に書き換える。
    - `scheduleEdgePhase` 冒頭で `get().activeCounterId !== null` なら `set({ activeCounterId: null })`。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク6、タスク7
  - 完了条件：counter ノードを通過するたびに `counterValues` の値が +1 され、ノードフェーズ中に `activeCounterId` が立ち、次エッジで null に戻る。倍率連動 multiplier スロットの効果が `card.power × counterValues[counterRef]` で適用される。既存ステージは挙動完全不変。

- [x] **9. battleStore: `slotAssignments` への `counterId` 伝播確認**  ✓ 完了（counterId 明示コピー追加）
  - 内容：`buildSlotAssignmentsFromStage`（または既存の lockedCard → slotAssignments 経路）が `lockedCard` をどう積んでいるか確認し、`counter` の場合に `counterId` が `slotAssignments[slotId]` のカードオブジェクトに含まれていることを保証する。既存実装が `{ ...slot.lockedCard, locked: true }` のスプレッドなら追加実装不要、明示コピーなら `counterId` を追加。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク5
  - 完了条件：`slotAssignments['slot-N'].counterId === 'c1'` が観測でき、タスク8 の `card.counterId` 参照が動作する。

- [x] **10. simulateBattle: `counterValues` 統合と倍率三分岐対応**  ✓ 完了
  - 内容：`simulateBattle({ ..., initialState })` の `initialState` に `counterValues` を含める拡張を行い、内部ループで counter ノード（`card?.id === 'counter'`）通過時に `counterValues` をイミュータブルに更新する。multiplier 解決のロジックを live と同じ三分岐（数値 / counterRef / 1）に統一。`battleStore.startExecution` 側で stage の全 counterId を 0 で埋めた `counterValues` を `initialState` に渡すよう更新。
  - ファイル：`frontend/src/engine/simulateBattle.js`、`frontend/src/stores/battleStore.js`（呼び出し側）
  - 依存：タスク7、タスク8
  - 完了条件：stage 4-3 の正解配置で sim 結果が `'win'`、明らかにダメ配置で `'lose'`、ループ脱出条件を満たせない手札配置で `'runaway'` が返る。`scheduleComplete` の dev 整合チェック（`liveOutcome !== simOutcome`）が warn を出さない。

- [x] **11. FlowchartArea: `slotsToNodes` の multiplier 型透過確認**  ✓ 完了（docstring 更新のみ、コード変更なし）
  - 内容：`slotsToNodes` 内の `multiplier: slot.multiplier` がオブジェクトもそのまま React Flow `data` に渡せることを確認する。既存コードは型を問わず転記しているはずだが、明示的なコメントを足してオブジェクト保持を保証する。
  - ファイル：`frontend/src/features/battle/flowchart/FlowchartArea.jsx`
  - 依存：タスク7
  - 完了条件：SlotNode の `data.multiplier` がオブジェクト `{ counterRef: 'c1' }` として渡る（DevTools で React Flow のノード data を確認）。

- [ ] **12. SlotNode: ペア判定と `counterValue` 解決、MultiplierIndicator への値渡し**
  - 内容：
    - `isCounterSlot = assignedCard?.id === 'counter' && assignedCard?.locked` を派生計算。
    - `isCounterLinkedMultiplier = typeof data?.multiplier === 'object' && typeof data.multiplier.counterRef === 'string'` を派生計算。
    - `isCounterPaired = isCounterSlot || isCounterLinkedMultiplier` を className に反映（`styles.counterPaired`）。
    - `activeCounterId` を zustand から購読し、`activeCounterId === assignedCard?.counterId`（counter 側）または `activeCounterId === data.multiplier.counterRef`（multiplier 側）で `isCounterFlashing` を判定して `styles.counterFlash` を付与。
    - `isCounterLinkedMultiplier` のとき `counterValues[data.multiplier.counterRef] ?? 0` をセレクタで購読し、`displayMultiplier` に渡す。`MultiplierIndicator` には数値リテラル時もカウンタ連動時も同じ `value` を渡す。
  - ファイル：`frontend/src/features/battle/flowchart/SlotNode.jsx`
  - 依存：タスク8、タスク11
  - 完了条件：stage 4-3 の counter slot と末尾 multiplier slot に金枠が出る。counter ノード到達時に両方が同期して光る。multiplier の `x{N}` の N が counter 通過のたびに増える。既存ステージ（金枠条件に該当しない）では `.counterPaired` / `.counterFlash` クラスが付かない。

- [ ] **13. SlotNode.module.css: `counterPaired` / `counterFlash` スタイル追加**
  - 内容：
    - `.slot.counterPaired { border-color: #FFD54A; box-shadow: 0 0 6px rgba(255, 213, 74, 0.5); }`（具体値は実機で微調整）。
    - `.slot.counterFlash` クラスと `@keyframes counterFlash`（強い金色 box-shadow を 360ms ease-out で減衰）。
    - `.lockedCard` の outline 抑制 CSS と衝突しないよう、必要に応じて `:not(.counterPaired)` のセレクタで隔離する。
  - ファイル：`frontend/src/features/battle/flowchart/SlotNode.module.css`
  - 依存：タスク12
  - 完了条件：DevTools で counter/multiplier ペアスロットの境界に金色が見え、counter ノード通過のフェーズで両者がパチンと 1 回光って減衰する。既存ステージのスロット外観は無変化。

- [ ] **14. MultiplierIndicator: framer-motion による値変化アニメ**
  - 内容：`motion.div` + `AnimatePresence` で `key={value}` 駆動の再マウントアニメに変える（`initial={{ scale: 1.6, opacity: 0.5 }}` → `animate={{ scale: 1.0, opacity: 1 }}`、duration 180ms 程度）。`x{value}` のテキスト出力は維持。
  - ファイル：`frontend/src/features/battle/flowchart/MultiplierIndicator.jsx`
  - 依存：タスク12
  - 完了条件：counter 通過で値が +1 されるたびに数字がパチンと拡大→等倍に戻るアニメが見える。既存の数値リテラル multiplier スロットでは初回マウント時に 1 回だけアニメするが、視覚的に違和感がなく許容可能。

- [ ] **15. preloadBattleAssets: `counter.png` を読み込み対象に追加**
  - 内容：`preloadBattleAssets.js` の既存パターン（カード ID から `/cards/<id>.png` を構築してプリロード）に counter を加える。stage 4-3 のように locked counter を含むステージで戦闘開始時にチラつきが出ないようにする。
  - ファイル：`frontend/src/features/battle/preloadBattleAssets.js`
  - 依存：タスク1（`counter.png` の存在）
  - 完了条件：戦闘画面遷移時に `Network` パネルで `counter.png` が事前 fetch される。stage 4-3 の counter スロットに画像が即時表示される（遅延なし）。

- [ ] **16. stages.json: stage 4-3 を新スキーマで書き換え**
  - 内容：design.md「実装方針 7」の JSON を反映：`body` 末尾に `{ "lockedCard": { "id": "counter", "counterId": "c1" } }` を 6 番目として追加、ループ後の `{ "multiplier": 5 }` を `{ "multiplier": { "counterRef": "c1" } }` に置換。`enemyId` / `maxEnemyHp` / `cards` / `loop.mode` / `loop.condition` / `loop.label` / `loop.trueDir` / `loop.falseDir` は変更しない。
  - ファイル：`frontend/src/data/stages.json`
  - 依存：タスク2〜14（すべての実装が終わってから書き換えると、書き換えた瞬間にステージが動く）
  - 完了条件：ローダー展開ログに warn が出ない。stage 4-3 をデモから起動すると counter（金枠＋力こぶ）と末尾 multiplier（金枠）が金色で表示され、ループ周回で counter を通るたびに両方が光り、末尾の `x{N}` が増える。プレイヤーが末尾 multiplier slot に attack カードを置いて実行すると `power × N` のダメージが敵に入る。
