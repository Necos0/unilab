# タスク一覧: 条件分岐ノード周りの UI 修正（branching-ui-fixes）

## 概要

実装は 4 つの独立した変更で構成される。タスク 1（CSS 修正）は他のタスクと完全に独立し並列可能。タスク 2〜4 は「直角折れ線エッジ」の実装で、`SlotNode` に Top ハンドル追加 → `AnimatedProgressEdge` のパス切り替え → `stagesLoader` の `targetHandle` 自動付与の順で繋がる（タスク 2 と 3 が揃って初めて Top ハンドル経由のエッジが描画され、タスク 4 で短縮形式から自動生成される）。

合計タスク数：4 件 ｜ 想定工数：約 1.5 時間

## タスク

- [x] **1. `ConditionNode.module.css` の枠線・サイズ・改行制御をまとめて修正する**  ✓ 完了
  - 内容：以下 3 点を `ConditionNode.module.css` 内で一括変更する。
    1. **枠線の追加**: `.diamond` に `background: #f5f5f5`（枠線色 = 白）を設定。`::before` 疑似要素を新規追加し、`content: ''; position: absolute; inset: 4px; background: #15151c; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);` で内側 4px に暗色の小菱形を重ねる。`.expression` には `position: relative; z-index: 1;` を追加して `::before` の上に表示。
    2. **サイズ変更**: `.diamond` の `height` を `140px` から `120px` に変更（SlotNode と同じ高さに揃え、ハンドル位置を一致させる）。`width: 140px` はそのまま。
    3. **数字途中改行の抑止**: `.expression` の既存 `word-break: break-all` を撤回し、`word-break: keep-all` と `overflow-wrap: break-word` に置き換える。
  - ファイル：`frontend/src/features/battle/flowchart/ConditionNode.module.css`
  - 依存：なし
  - 完了条件：(a) 菱形ノードに `StartNode` と同じ太さ・色の白枠線が表示される。(b) 菱形と隣接スロット（左右の slot）を繋ぐエッジが水平直線で描かれる（要件 2、ハンドル位置が揃ったため）。(c) `playerHp > 50` のような条件式テキストが「5」と「0」の途中で改行されない。(d) `.active` / `.traversed` ハイライト時に枠線が消えない。
  - 対応要件：要件 1-1, 1-2, 1-3、要件 2-1, 2-2, 2-3、要件 4-1, 4-2, 4-3

- [x] **2. `SlotNode` に Top target ハンドルを追加する**  ✓ 完了
  - 内容：`SlotNode.jsx` の Handle 群に、以下の Top target ハンドルを追加する。配置位置は既存の Left target Handle の直後がよい。
    ```jsx
    <Handle
      type="target"
      position={Position.Top}
      id="top"
      className={styles.handle}
      isConnectable={false}
    />
    ```
    既存の Left target / Right source ハンドルは触らない（後方互換）。
  - ファイル：`frontend/src/features/battle/flowchart/SlotNode.jsx`
  - 依存：なし
  - 完了条件：(a) React DevTools で SlotNode の Handle が 3 つ（Left target、Top target、Right source）になっていることを確認できる。(b) `stages.json` のエッジで `targetHandle: 'top'` を指定すれば、そのエッジが SlotNode の上端に接続される。(c) 既存ステージ（マップ 1）でエッジが従来通り Left ハンドルに繋がる（後方互換）。
  - 対応要件：要件 3-1, 3-2（Top ハンドル経由の合流エッジの受け側）

- [x] **3. `AnimatedProgressEdge` を smoothstep 対応に拡張する**  ✓ 完了
  - 内容：`AnimatedProgressEdge.jsx` を以下 3 点で変更する。
    1. **import に `getSmoothStepPath` を追加**:
       ```js
       import { getStraightPath, getSmoothStepPath } from '@xyflow/react';
       ```
    2. **関数シグネチャに 4 つの props を追加**:
       ```js
       function AnimatedProgressEdge({
         id,
         sourceX, sourceY, targetX, targetY,
         sourcePosition, targetPosition,  // 追加
         sourceHandleId, targetHandleId,  // 追加
         markerEnd,
       }) { ... }
       ```
       React Flow がカスタムエッジに自動で渡してくれる props。
    3. **`edgePath` の算出を分岐**:
       ```js
       const shouldUseStep =
         sourceHandleId === 'false' || targetHandleId === 'top';
       const [edgePath] = shouldUseStep
         ? getSmoothStepPath({
             sourceX, sourceY, sourcePosition,
             targetX, targetY, targetPosition,
             borderRadius: 5,
           })
         : getStraightPath({ sourceX, sourceY, targetX, targetY });
       ```
       既存の `getStraightPath({...})` 1 行を上記の三項演算子に置き換える。`isActive` / `isTraversed` / マーカー処理など以降のロジックはすべて維持。
  - ファイル：`frontend/src/features/battle/flowchart/AnimatedProgressEdge.jsx`
  - 依存：タスク 2（Top target ハンドルが存在しないと、`targetHandle: 'top'` のエッジが繋がらないため、視覚確認できない）
  - 完了条件：(a) 条件分岐ノードの False 経路から出るエッジが直角折れ線（下→右→上）で描かれる。(b) True 経路や線形ステージのエッジは従来通り直線で描かれる。(c) `borderRadius: 5` で直角部分が滑らかに丸まる。(d) 通過軌跡（白いネオン光）の演出が smoothstep / straight 両方で正しく動作する。
  - 対応要件：要件 3-1, 3-3, 3-4, 3-5

- [x] **4. `stagesLoader.js` の False 経路 endings に `targetHandle: 'top'` を自動付与する**  ✓ 完了
  - 内容：`stagesLoader.js` の `processSubFlow` と `buildEdge` を以下 2 点で変更する。
    1. **`buildEdge` に `targetHandle` 付与ロジックを追加**:
       ```js
       function buildEdge(ending, targetId) {
         const edge = {
           id: `e-${ending.nodeId}-${targetId}`,
           source: ending.nodeId,
           target: targetId,
         };
         if (ending.sourceHandle) edge.sourceHandle = ending.sourceHandle;
         if (ending.targetHandle) edge.targetHandle = ending.targetHandle;  // 追加
         return edge;
       }
       ```
    2. **`processSubFlow` で False 経路の `endings` 各要素に `targetHandle: 'top'` を付与**:
       既存の `endings = [...trueResult.endings, ...falseResult.endings]` の代わりに以下に書き換え：
       ```js
       const falseEndingsWithTop = falseResult.endings.map((e) => ({
         ...e,
         targetHandle: 'top',
       }));
       endings = [...trueResult.endings, ...falseEndingsWithTop];
       ```
       これにより、False 経路の終端（途中スロットがあればその最後、なければ `cond-N` 自身）から合流先へのエッジが `targetHandle: 'top'` を持つようになる。
  - ファイル：`frontend/src/data/stagesLoader.js`
  - 依存：タスク 2、タスク 3（Top ハンドルとエッジパス切り替えが揃っていないと視覚効果が出ない）
  - 完了条件：(a) ステージ 2-1 を表示すると、条件分岐の False 経路エッジが「下→右→上→合流先 top」の L 字経路で描かれる。(b) 条件分岐の True 経路エッジは水平直線。(c) マップ 1 のステージは従来通り（`flow` キーがないので `processSubFlow` は呼ばれず影響なし）。(d) 入れ子の分岐（将来のテストケース）でも、各 False 経路の合流エッジに `targetHandle: 'top'` が正しく付与される。
  - 対応要件：要件 3-1, 3-2, 3-3、要件 5-1, 5-2, 5-3

## トレーサビリティ確認

| 要件 | 対応タスク |
|---|---|
| 1-1, 1-2, 1-3（菱形の白枠線） | タスク 1 |
| 2-1, 2-2, 2-3（横頂点と隣接スロットの y 整合） | タスク 1（菱形サイズ変更） |
| 3-1（False 経路の L 字エッジ） | タスク 2、タスク 3、タスク 4 |
| 3-2（False 経路にスロットなしでも L 字） | タスク 4（cond 自身に `targetHandle: 'top'` 付与） |
| 3-3（False 経路スロット間も直角折れ線） | タスク 3（`sourceHandleId === 'false'` の判定） |
| 3-4（True 経路は水平直線） | タスク 3（`shouldUseStep === false` で straight） |
| 3-5（マップ 1 線形ステージは既存スタイル） | タスク 3（`sourceHandleId` / `targetHandleId` 未指定 → straight） |
| 4-1, 4-2, 4-3（数字途中改行抑止） | タスク 1 |
| 5-1（マップ 1 への影響なし） | タスク 2（既存 Left target は維持）、タスク 3（既存 straight ルート）、タスク 4（`flow` キーがないステージは触らない） |
| 5-2（マップ 1 の演出維持） | タスク 3（`.traversed` ハイライト等の演出ロジックは変更なし） |
| 5-3（変更スコープは `ConditionNode` 関連に限定） | タスク 1（CSS のみ）、タスク 2（Handle 1 行追加）、タスク 3（パス分岐のみ）、タスク 4（条件分岐周辺ロジックのみ） |
