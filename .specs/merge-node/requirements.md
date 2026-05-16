# 要件定義: 合流ノードの追加（merge-node）

## はじめに

条件分岐ステージで True / False の経路がどちらも次のノードへ向かう「合流」を、視覚的に明示する **合流ノード（merge node）** を導入する。`branching-ui-fixes` で smoothstep エッジを採用したが、合流先 slot に top から入る挙動は「slot 内に上から入る」見た目になり、本来の「2 つの経路が 1 点で合流して、その先で次のノードへ進む」というフローチャート的な意味と合わなかった。

合流ノードは IEC 5807 などのフローチャート慣習に従い **小さな円** で表現する（条件分岐の菱形と視覚的に区別される）。ステージデザイナーが `flow` 配列を書くときに合流ノードを明示する必要はなく、`stagesLoader` が条件分岐の存在を検知して自動的に挿入する。バトルロジック側では合流ノードは「素通りするノード」として扱われ、カード効果のような副作用は持たない。

## 用語

- **合流ノード（merge node）**: 条件分岐後の True / False 経路の終端から伸びるエッジが集まる「点」を表すノード。視覚的には小さな円（直径 16〜20px 程度）。`type: 'merge'` のカスタムノードとして React Flow に登録する。
- **合流先**: 合流ノードの直後にある通常スロット、または goal。`flow` 配列で条件分岐要素の次にある要素、または「条件分岐がメイン経路の最後の要素のとき」は goal。
- **自動挿入**: ステージデザイナーは `stages.json` の `flow` に合流ノードを書かない。`stagesLoader` の `processSubFlow` が条件分岐を展開する際に合流ノードを暗黙的に生成し、`ctx.mergeNodes` に追加する。

## 要件

### 要件1: 合流ノード（MergeNode）の追加と描画

**ユーザーストーリー：** プレイヤーとして、フローチャート上で「ここで分岐した経路が合流する」が視覚的に分かるマーカーを見たい。なぜならフローチャートの慣習として「合流点を 1 つの記号で示す」ことで、複数経路の意味が即座に理解できるから。

#### 受け入れ基準

1. WHEN フローチャート上に合流ノードが配置される THEN the system SHALL 小さな円（直径 16〜20px、白枠 `#f5f5f5`、内側暗色 `#15151c`）の形で描画する
2. WHEN 合流ノードを `React Flow` に登録する THEN the system SHALL `type: 'merge'` のカスタムノードとして `nodeTypes` に追加する
3. WHEN 合流ノードを描画する THEN the system SHALL Handle を 3 つ持つ：`Left target`（True 経路から入ってくる）、`Top target`（False 経路から入ってくる）、`Right source`（合流先へ出る）
4. WHEN `executionStep` が合流ノードと一致する THEN the system SHALL 既存の `SlotNode` / `ConditionNode` と同様に `.active` クラスで点滅発光させる
5. WHEN `traversedNodeIds` に合流ノード id が含まれる THEN the system SHALL `.traversed` クラスで固定の白い発光を維持する

### 要件2: 合流ノードの自動挿入（stagesLoader）

**ユーザーストーリー：** ステージデザイナーとして、`stages.json` の `flow` 配列に合流ノードを明示的に書きたくない。なぜなら合流は「条件分岐の必然的な帰結」であり、ステージ設計者が意識する必要のない技術的詳細だから。

#### 受け入れ基準

1. WHEN `stagesLoader` の `processSubFlow` が条件分岐要素を展開する THEN the system SHALL 内部的に合流ノードを 1 つ生成し、`ctx.mergeNodes` 配列に追加する
2. WHEN 合流ノードを生成する THEN the system SHALL id を `merge-K` 形式で連番採番する（K は ctx の merge カウンター、1 から始まる）
3. WHEN 合流ノードの座標を決める THEN the system SHALL `x = 合流先ノードの x - 60`、`y = メイン経路の yLevel`（条件分岐ノードと同じ高さ）にする
4. WHEN True 経路を展開する THEN the system SHALL その終端から合流ノードの left target へエッジを引く（直線、`sourceHandle` / `targetHandle` なし）
5. WHEN False 経路を展開する THEN the system SHALL その終端から合流ノードの top target へエッジを引く（smoothstep、`targetHandle: 'top'`）
6. WHEN 合流ノードから次へ繋ぐ THEN the system SHALL 合流ノードの right source から合流先（次の通常スロット または goal）へエッジを引く（直線）
7. IF 条件分岐がメイン経路の最後の要素である（後続要素なし）THEN the system SHALL 合流ノードを `goal` の直前に挿入し、`merge → goal` のエッジを引く

### 要件3: `expandStage` の戻り値に `mergeNodes` を追加

**ユーザーストーリー：** 開発者として、合流ノードを既存のノード配列（`slots` / `conditions`）と並列に扱える形でローダーが返してほしい。

#### 受け入れ基準

1. WHEN `expandFlow` が返すオブジェクトに THEN the system SHALL 新たに `mergeNodes` フィールドを追加する（`Array<{ id, position }>` 形式）
2. WHEN `expandStage` がローダーから完全形式を組み立てる THEN the system SHALL `mergeNodes` を含めて返す
3. WHEN マップ 1 の線形ステージ（`flow` キーなし）を展開する THEN the system SHALL `mergeNodes: []`（空配列）を返す

### 要件4: バトルロジックでの合流ノードの素通り

**ユーザーストーリー：** プレイヤーとして、合流ノードを通っても HP やカード効果に変化がないことを期待する。なぜなら合流ノードは「視覚マーカー」であって「効果を持つカード配置場所」ではないから。

#### 受け入れ基準

1. WHEN 実行シーケンスが合流ノードに到達する THEN the system SHALL カード効果（attack / monster / heal / guard / reflect）の分岐を発火しない
2. WHEN 実行が合流ノードを通過する THEN the system SHALL `executionStep` のセットと `traversedNodeIds` への追加は通常通り行う（視覚的に通過が分かる）
3. WHEN `startExecution` の `scheduleNodePhase` が合流ノードを処理する THEN the system SHALL ノードフェーズの所要時間（`NODE_PHASE_MS`）を通常通り消費する（実行のテンポを乱さない）

### 要件5: エッジの描画（合流ノード周辺）

**ユーザーストーリー：** プレイヤーとして、合流ノード周辺のエッジが直感的に描かれてほしい。

#### 受け入れ基準

1. WHEN True 経路の終端から合流ノードへエッジが伸びる THEN the system SHALL 水平直線で描画する（両者の y 座標が同じため、`getStraightPath` で自然に直線になる）
2. WHEN False 経路の終端から合流ノードの top へエッジが伸びる THEN the system SHALL `getSmoothStepPath` で L 字経路（下→右→上→top に入る）で描画する
3. WHEN 合流ノードから合流先（次の通常スロット または goal）へエッジが伸びる THEN the system SHALL 水平直線で描画する
4. WHEN `AnimatedProgressEdge` が合流ノード周辺のエッジを判定する THEN the system SHALL 既存の `sourceHandleId === 'false' || targetHandleId === 'top'` の条件で smoothstep を採用する（追加変更不要）

### 要件6: 入れ子分岐への対応

**ユーザーストーリー：** 開発者として、True 経路の中にさらに条件分岐があるような入れ子構造でも、合流ノードが正しく挿入されることを保証したい。

#### 受け入れ基準

1. WHEN `processSubFlow` が入れ子の条件分岐を再帰展開する THEN the system SHALL 入れ子の各レベルで独自の合流ノードを生成する（外側と内側の合流が混同されない）
2. WHEN 入れ子の合流ノードに id を採番する THEN the system SHALL 外側の合流ノード採番と独立した連番（`merge-1`、`merge-2`、…）を維持する（ctx グローバルカウンター）
3. WHEN 入れ子の合流ノードの座標を決める THEN the system SHALL その合流ノードが所属するレベルの `yLevel` を使う（False 経路内の合流は y=280 のような下経路上に配置）

### 要件7: ステージ 2-1 の動作確認

**ユーザーストーリー：** プレイヤーとして、ステージ 2-1 を実機で動かしたときに、現在の問題（ロック attack ノードの裏を貫通する False 経路エッジ）が解消されていることを確認したい。

#### 受け入れ基準

1. WHEN ステージ 2-1 を起動する THEN the system SHALL 条件分岐ノード（cond-1）の右に「True 経路」が伸び、下に「False 経路」が伸び、両者が合流ノード（小さな円）で合流し、その先の slot-4 へ繋がる
2. WHEN ステージ 2-1 を実行する THEN the system SHALL ノード通過の順序が `start → slot-1 → slot-2 → cond-1 → (条件評価) → slot-3 または skip → merge-1 → slot-4 → goal` になる
3. WHEN False 経路を実行する THEN the system SHALL cond-1 から下に出て、ロック attack ノード（slot-3）の **裏を通らず**、合流ノードの top に入る
4. WHEN `stages.json` の ステージ 2-1 を変更しない THEN the system SHALL `flow` 形式の記述はそのまま、合流ノードは自動挿入される

### 要件8: マップ 1 線形ステージへの影響なし

**ユーザーストーリー：** 開発者として、合流ノードの導入が線形ステージ（マップ 1）の挙動を一切変更しないことを保証したい。

#### 受け入れ基準

1. WHEN マップ 1 のステージ（1-1〜1-4、`slots` キーで記述）を展開する THEN the system SHALL 合流ノードを生成せず、`mergeNodes: []` を返す
2. WHEN マップ 1 のステージを実行する THEN the system SHALL 既存の通過順・カード効果発火・通過軌跡が全て従来通り動作する
3. WHEN `MergeNode` を nodeTypes に追加する THEN the system SHALL 既存の `slot` / `start` / `goal` / `condition` の描画には影響しない
