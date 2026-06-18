# 要件定義: フローチャートの折り返し（turn）構文

## はじめに

戦闘画面のフローチャートに **折り返し（turn）構文** を導入する。これまで `flow` ショートカットは「線形」「条件分岐（auto-merge）」「ループ（while / do-while）」を表現できたが、いずれも **横一列** のレイアウトで、スロット数や `lockedCard` の連続が増えるとフローチャートが画面右に大きくはみ出し、戦闘画面の他の UI（敵スプライト・HP バー・手札パネル）を圧迫する。

本機能では `flow` 配列のトップレベルに **キリのいい位置で** `{"turn": {}}` という新しい要素を 1 個書けるようにし、ローダーがそれ以降のスロットを次の行へ折り返して **右から左へ** 並べる。折り返し点は視覚的なノードとしては描画されず、垂直下方向に伸びるエッジと、その後の左向きエッジの形だけで「ここで折れた」が伝わる。

利用者は 2 種類いる：
- **ステージデザイナー**（このプロジェクトの作成者）：横長になったステージを `{"turn": {}}` 1 行追加するだけで 2 行レイアウトにできるようになる。
- **プレイヤー（小学生想定）**：フローチャートが画面に収まり、敵スプライトや手札と一緒に視認できる状態でゲームを楽しめる。

最初の具体的な活用先は、横長化が進んでいる既存ステージ（例: stage 4-3 のループ後の `{}, monster:50, multiplier` セクション）を 2 行化することだが、本機能の要件としてはどの特定ステージへの適用も必須としない（適用は別タスクで判断する）。

### スコープと前提（今回の方針）

- **対象は flow トップレベルの 1 個の turn のみ**。1 つの flow に turn は最大 1 個。複数 turn（3 行以上のスネークレイアウト）は将来拡張。
- **turn は loop の body 内・condition の true / false 内には書けない**。ステージデザイナーは「キリのいい位置」（loop / condition の境目）でのみ turn を書く。`flow` 配列のトップレベル要素として、他の構造要素の間に挟む形で配置する。
- **turn は視覚的なノードとして描画しない**。React Flow の nodes 配列にも条件・スロット・merge と並ぶような独立要素を生成せず、レイアウトのメタデータとしてのみ機能する。エッジの曲がり方（垂直下 + その後の左向き）で折り返し位置をプレイヤーに伝える。
- **将来拡張を見込んだスキーマ**。`{"turn": {}}` のオブジェクト形式とし、将来 `{"turn": {"direction": "down"}}` 等のプロパティ追加で複数 turn・方向指定に拡張できる構造を選ぶ。

### 想定する記述イメージ

```jsonc
"X-Y": {
  "enemyId": "...",
  "cards": [ ... ],
  "flow": [
    {},
    {},
    { "turn": {} },     // 折り返し点（ノードは生成されない）
    {},
    {}
  ]
}
```

上記の展開後レイアウト（イメージ）：

```
start → (1) → (2)
              ↓
goal  ← (4) ← (3)
```

- 行 1: `start` → (1) → (2)（右向き、既存挙動）
- 折り返し: (2) の下辺から垂直下方向にエッジが伸びて、(3) の上辺に接続
- 行 2: (3) → (4) → goal（**左向き**、新規）
- (3) は (2) の真下、(4) は (3) の左、goal は (4) の左に配置

---

## 要件

### 要件1: `flow` への turn 構文の追加とローダー認識
**ユーザーストーリー：** ステージデザイナーとして、`flow` 配列のトップレベルに `{"turn": {}}` を 1 個書くことで、後続のスロットを次の行に折り返したい。なぜなら、横長になったステージを 1 行追加するだけで 2 行化でき、戦闘画面に収まるサイズに調整できるから。

#### 受け入れ基準
1. WHEN `flow` 配列の要素が `turn` キーにオブジェクトを持つ THEN the system SHALL その要素を turn 要素として認識し、後続要素を折り返しレイアウトで展開する
2. WHEN turn 要素を展開する THEN the system SHALL ノード（slot / condition / merge いずれも）を生成しない（レイアウトのメタデータとしてのみ機能する）
3. IF `flow` 配列に turn 要素が含まれない場合 WHEN ステージを展開する THEN the system SHALL 既存の線形展開・分岐展開・ループ展開を一切変更せず従来どおり動作させる
4. IF `turn` キーの値がオブジェクトでない（数値・配列・null 等）場合 WHEN 展開する THEN the system SHALL `console.warn` で警告を出し、当該 turn 要素を安全側でスキップする（無視して通常の線形展開を継続）

### 要件2: 折り返し後のレイアウト
**ユーザーストーリー：** プレイヤーとして、折り返した後のスロットが「直前のスロットの真下から始まって、左方向に並ぶ」見え方であってほしい。なぜなら、視線が U 字に動くことで「同じステージの続き」だと自然に理解できるから。

#### 受け入れ基準
1. WHEN turn 直後の最初のスロットを配置する THEN the system SHALL 直前最後のスロットと同じ x 座標（同じ列）、y 座標は **`turn 発火時点で配置済みの全ノードの最大 y` + `LOOP_ROW_GAP`** に配置する
2. WHEN turn 後の 2 個目以降のスロットを配置する THEN the system SHALL 直前スロットの **左隣**（x 座標が `SLOT_X_STEP` ぶん減る位置、同じ行 2）に配置する
3. WHEN turn 後の最終終端から goal を配置する THEN the system SHALL 最終スロットの **左隣**（x 座標が `SLOT_X_STEP` ぶん減る位置、同じ行 2）に goal を配置する
4. IF turn の直前に line, loop, condition 等の構造要素がある場合 WHEN 折り返しの基準列を決定する THEN the system SHALL turn 直前の終端（最終 column）を基準とし、その x 座標から垂直下方向に折り返す
5. IF 行 1 に condition の false 分岐がある場合（false 分岐が `SLOT_Y_DEFAULT + LOOP_ROW_GAP` の位置にスロットを生成する）WHEN turn を展開する THEN the system SHALL false 分岐のスロット y 座標を含めた `max_y` を考慮し、行 2 の y 座標を **false 分岐より下** に動的に決定する（行 1 がスロットのみで構成される単純なケースでは max_y = `SLOT_Y_DEFAULT` となり、結果として行 2 = `SLOT_Y_DEFAULT + LOOP_ROW_GAP` で従来想定と一致する）
6. WHILE turn 直前と直後の垂直下エッジが描画される the system SHALL エッジが既存ノード（condition の false 分岐スロット等）の **視覚的に上を横切る可能性** を許容する（エッジルーティングはステージデザイナーが flow 配列の構造を工夫する責務）

### 要件3: 折り返し時のエッジ描画
**ユーザーストーリー：** プレイヤーとして、折り返しの瞬間が「線が下に曲がる」と目で見て分かってほしい。なぜなら、フローチャートの実行順序が見た目で分からないと、どこを通っているか追えなくなるから。

#### 受け入れ基準
1. WHEN turn 直前の終端ノードから turn 直後の最初のスロットへエッジを描画する THEN the system SHALL **垂直下方向** の経路（source 側の下辺ハンドルから target 側の上辺ハンドルへ）でエッジを引く
2. WHEN turn 後のスロット同士 / 最終スロットと goal を結ぶエッジを描画する THEN the system SHALL **左向き** の経路（source 側の左辺ハンドルから target 側の右辺ハンドルへ）でエッジを引く
3. WHILE 実行シーケンスが turn 後のエッジを通過する the system SHALL 既存の `AnimatedProgressEdge` の通過演出（`traversedEdgeIds` による発光トレイル）を従来どおり反映する
4. WHEN turn 直前と直後を結ぶ垂直下エッジが描画される THEN the system SHALL 既存の `getSmoothStepPath` 等の経路計算で自然な L 字または垂直線として描画する

### 要件4: ハンドル構成の拡張
**ユーザーストーリー：** 開発者として、`SlotNode` と `goal` ノードに左向きエッジ・下向きエッジを引くのに必要なハンドルを追加したい。なぜなら、React Flow はハンドル ID に基づいてエッジの接続点を決めるため、新方向のエッジには対応するハンドルが必須だから。

#### 受け入れ基準
1. WHEN `SlotNode` を描画する THEN the system SHALL 既存のハンドル（Left target / Top target `id="top"` / Right source / Top source `id="loop-out"`）に加え、**下辺の source** ハンドル（折り返し開始用）、**左辺の source** ハンドル（左向きエッジ用）、**右辺の target** ハンドル（左向きエッジ用）を提供する
2. WHEN `goal` ノードを描画する THEN the system SHALL 既存の Left target / Top target ハンドルに加え、**右辺の target** ハンドル（左向きで進入する goal 用）を提供する
3. IF 既存ステージで左向き・下向きエッジが使われていない場合 THEN the system SHALL NOT 新ハンドルの存在によって既存の見た目・挙動を変えない（未使用ハンドルは透明で無害に存在するだけ）

### 要件5: 将来拡張を見込んだスキーマ
**ユーザーストーリー：** 開発者として、将来「複数 turn」「方向指定」を追加するときに既存ステージへの破壊的変更を避けたい。なぜなら、ステージデータが増えてからのスキーマ変更はコストが大きいから。

#### 受け入れ基準
1. WHEN turn を `flow` に書く THEN the system SHALL **オブジェクト形式**（`{"turn": {}}`）を受け入れる
2. WHEN `turn` キーのオブジェクトが空（`{}`）の場合 THEN the system SHALL デフォルトの折り返し挙動（垂直下 → 左向き）を適用する
3. WHERE 将来 `turn` オブジェクト内に `direction` 等の追加プロパティが書かれた場合 the system SHALL 現時点ではそれを無視するか warn を出す（破壊的に拒否しない）
4. IF `flow` 配列内に turn が **2 個以上** 含まれる場合 WHEN 展開する THEN the system SHALL **最初の 1 個のみ** を採用し、2 個目以降は `console.warn` で警告して通常スロット相当に格下げする（または無視する）

### 要件6: turn の配置制約
**ユーザーストーリー：** 開発者として、turn を loop の body 内・condition の true / false 内に書かれてもレイアウトが破綻しないようにしたい。なぜなら、それらの構造の途中で折り返すと座標計算が複雑になり、また小学生プレイヤーの混乱を招くから。

#### 受け入れ基準
1. IF turn 要素が `loop.body` 配列の中に書かれている WHEN 展開する THEN the system SHALL `console.warn` で警告を出し、その turn を無視して通常のループボディとして展開する（クラッシュさせない）
2. IF turn 要素が `condition.true` または `condition.false` 配列の中に書かれている WHEN 展開する THEN the system SHALL `console.warn` で警告を出し、その turn を無視して通常の分岐ボディとして展開する
3. WHEN turn が `flow` のトップレベル（loop / condition 要素の外側、`flow` 配列の直接の子）に書かれている THEN the system SHALL 正常に折り返しを適用する

### 要件7: 既存ステージへの非破壊性
**ユーザーストーリー：** 開発者として、既存ステージ（1-X / 2-X / 3-X / 4-X / 5-X 等）の挙動を一切変えずに本機能を導入したい。なぜなら、デグレ検証コストが上がるから。

#### 受け入れ基準
1. WHEN 既存ステージで `flow` に turn 要素を一切持たない THEN the system SHALL 線形展開・分岐展開・ループ展開を本機能導入前と完全に同一に動作させる
2. WHEN 既存ステージで `slots` ベースのルート（`flow` を持たないステージ）で展開される THEN the system SHALL `expandSlots` / `buildLinearEdges` の挙動を変更しない
3. WHEN `FlowchartArea` / `BattleScreen` / `battleStore` が turn を持たないステージを実行する THEN the system SHALL 既存の動的エッジ追跡・実行アニメーション・通過演出を一切変更しない（turn 関連のコードパスに分岐しない）

### 要件8: ランタイムでの実行
**ユーザーストーリー：** プレイヤーとして、turn を含むフローチャートを実行ボタンで動かすと、行 1 → 折り返し → 行 2（左向き）の順に通過アニメが流れてほしい。

#### 受け入れ基準
1. WHILE 実行シーケンスが turn 直前のスロットから直後のスロットへ通過する the system SHALL `traversedEdgeIds` に垂直下エッジの id を追加し、既存の `AnimatedProgressEdge` が発光トレイルを表示する
2. WHILE 実行シーケンスが turn 後の左向きエッジを通過する the system SHALL 同様にエッジ id を `traversedEdgeIds` に追加して通過演出を再生する
3. WHEN turn 後の最終スロットを通過して goal に到達する THEN the system SHALL 既存の `scheduleComplete` 経路で勝敗判定に進む
4. IF turn を含むステージで失敗（プレイヤー HP 0）が発生する THEN the system SHALL 既存の `failPhase` 機構で停止し Fail とする

### 要件9: leftward 文脈での condition の認識と配置
**ユーザーストーリー：** ステージデザイナーとして、turn の後にも `condition` 要素を書きたい。なぜなら、stage 3-4 のような長いステージは後半に条件分岐が来ることが多く、turn を導入した動機（横長を 2 段化）の本来のユースケースだから。

#### 受け入れ基準
1. WHEN turn 後（`currentDirection === 'left'`）に condition 要素が `flow` トップレベルに現れる THEN the system SHALL その condition を turn 後の行（`currentYLevel`）上に **leftward** 配置する
2. WHEN leftward 文脈で condition ノードを配置する THEN the system SHALL ノード x 座標を直前要素から `SLOT_X_STEP` ぶん左にずらす（`column` を `-1` 方向に進める）
3. WHEN leftward 文脈で condition の true / false 分岐をサブフロー展開する THEN the system SHALL `direction: 'left'` を再帰呼び出しに伝播し、サブフロー内のスロットも leftward に並べる
4. WHEN leftward 文脈で condition の true / false サブフロー終端を集約する THEN the system SHALL **`mergeColumn = Math.min(trueResult.endColumn, falseResult.endColumn)`**（leftward では「左にいる方が後ろ」なので min が必要）で merge 位置を決定する
5. WHEN leftward 文脈の condition の column を整える THEN the system SHALL 既存の rightward 用 `column += 1` のロジックを **`column += currentDirection === 'right' ? 1 : -1`** に置き換える

### 要件10: leftward 文脈での condition の出口方向の既定値
**ユーザーストーリー：** ステージデザイナーとして、turn 後の condition で `trueDir` / `falseDir` を毎回手書きしなくても自然な方向に出口が向いてほしい。なぜなら、人間が想定する「フローの進行方向と同じ向きを true、それと垂直な向きを false」というデフォルト挙動が、ローダー側で direction-aware に提供されるのが妥当だから。

#### 受け入れ基準
1. WHEN leftward 文脈の condition に `trueDir` が **指定されていない** THEN the system SHALL `'left'` を既定値として使用する（rightward 文脈の `'right'` 既定の mirror）
2. WHEN leftward 文脈の condition に `falseDir` が **指定されていない** THEN the system SHALL `'down'` を既定値として使用する（rightward 文脈と共通、false 分岐は常に下の行へ）
3. IF leftward 文脈の condition で `trueDir` / `falseDir` が **明示的に指定されている** THEN the system SHALL 既定値を上書きせず明示指定をそのまま採用する（既存の `flowchart-loop` 仕様と一貫）
4. IF rightward 文脈の condition が `trueDir` / `falseDir` 未指定の場合 THEN the system SHALL `'right'` / `'down'` を既定値として使用する（**既存挙動を完全保持**）

### 要件11: leftward 文脈での condition 周辺のエッジハンドル
**ユーザーストーリー：** プレイヤーとして、turn 後の condition への入口エッジ、condition から true / false 分岐への出口エッジ、merge への集約エッジが、すべて違和感のない方向で描画されてほしい。

#### 受け入れ基準
1. WHEN leftward 文脈で直前ノードから condition への入口エッジを生成する THEN the system SHALL `sourceHandle: 'left-out'` / `targetHandle: 'right-in'` を付与する（左向きエッジとして描画）
2. WHEN leftward 文脈で condition の true 出口から後続スロット（または merge）へのエッジを生成する THEN the system SHALL condition 側の出口ハンドル位置を `trueDir`（既定 `'left'`）から決定し、target 側を `'right-in'`（または merge の右辺 target）で受ける
3. WHEN leftward 文脈で condition の false 出口から false 分岐の最初のスロットへエッジを生成する THEN the system SHALL condition 側の出口ハンドル位置を `falseDir`（既定 `'down'`）から決定する
4. WHEN leftward 文脈で merge から後続スロットへのエッジを生成する THEN the system SHALL `sourceHandle: 'left-out'` / `targetHandle: 'right-in'` を付与する
5. WHEN leftward 文脈で true 分岐の最終終端から merge へのエッジを生成する THEN the system SHALL `sourceHandle` を分岐由来のハンドル（`'true'` 等）、`targetHandle` を `'right-in'`（merge 側の新ハンドル）で接続する
6. WHEN leftward 文脈で false 分岐の最終終端から merge へのエッジを生成する THEN the system SHALL `sourceHandle` を分岐由来、`targetHandle` を `'bottom'`（merge 側の既存下辺ハンドル）で接続する（rightward と同様、false 分岐は下から merge へ進入）

### 要件12: `MergeNode` のハンドル拡張
**ユーザーストーリー：** 開発者として、leftward 文脈で merge ノードに入出力する新方向のエッジに対応する Handle を `MergeNode` に追加したい。

#### 受け入れ基準
1. WHEN `MergeNode` を描画する THEN the system SHALL 既存の Left target / Top target `id="top"` / Bottom target `id="bottom"` / Right source に加え、**右辺の target ハンドル**（`id="right-in"`、leftward 文脈で true 分岐からの入力用）と **左辺の source ハンドル**（`id="left-out"`、leftward 文脈で merge から後続への出力用）を提供する
2. IF 既存ステージで右辺 target / 左辺 source ハンドルが使われていない場合 THEN the system SHALL NOT 新ハンドルの存在によって既存の見た目・挙動を変えない（未使用ハンドルは透明で無害に存在するだけ）

### 要件13: leftward 文脈での merge ノード座標計算
**ユーザーストーリー：** プレイヤーとして、leftward 文脈でも merge ノードが「true 分岐と false 分岐の中央」に綺麗に配置されてほしい。

#### 受け入れ基準
1. WHEN leftward 文脈で merge ノードを配置する THEN the system SHALL **rightward の x 計算式を mirror した式**で配置する：rightward では `slot[mergeColumn-1]` と `slot[mergeColumn]` の中間 x、leftward では `slot[mergeColumn]` と `slot[mergeColumn+1]` の中間 x（中心を merge / slot の左上座標オフセットで補正する仕組みは共通）
2. WHEN merge ノードの y を決定する THEN the system SHALL leftward / rightward 共通で `currentYLevel + SLOT_HEIGHT / 2 - MERGE_SIZE / 2`（slot の縦中心と一致させる）を使用する
3. IF rightward 文脈の merge ノード座標 THEN the system SHALL 既存の計算式を **完全保持**（既存ステージ非破壊性）

### 要件14: leftward 文脈での condition の false 分岐の行配置
**ユーザーストーリー：** プレイヤーとして、turn 後の condition の false 分岐が、画面上で「行 2 のさらに下」に綺麗に展開されてほしい。

#### 受け入れ基準
1. WHEN leftward 文脈の condition で false 分岐を展開する THEN the system SHALL サブフローの `yLevel` を `currentYLevel + LOOP_ROW_GAP`（行 3 相当）に設定する
2. WHEN leftward 文脈の condition で true 分岐を展開する THEN the system SHALL サブフローの `yLevel` を `currentYLevel`（行 2 相当）に設定する
3. WHEN leftward 文脈の condition 内に **入れ子で** condition が現れる THEN the system SHALL 再帰的に `currentYLevel + N * LOOP_ROW_GAP` で行をさらに下にずらす（rightward 文脈と同じ再帰的下方拡張）
4. WHEN false 分岐の最終 column を返す THEN the system SHALL leftward 文脈では「最も左に到達した column」（=最小値）を、rightward 文脈では「最も右に到達した column」（=最大値）を採用する

### 要件15: stage 3-4 への適用（具体的成果物）
**ユーザーストーリー：** プレイヤーとして、stage 3-4 を turn 込みの 2 段レイアウトで遊びたい。なぜなら、横長すぎて画面に収まらないのが本機能の動機だから。

#### 受け入れ基準
1. WHEN stage 3-4 を本拡張完了後に開く THEN the system SHALL `flow` 配列の途中（現在の `{ "turn": {} }` の位置）で折り返し、後半の monster:5、condition（playerHp === 10）、後続スロットが **leftward** で配置される
2. WHEN stage 3-4 の最後の condition を展開する THEN the system SHALL `trueDir` / `falseDir` の **明示指定なし** で leftward 既定値（true=left / false=down）を適用する
3. WHEN stage 3-4 の最後の condition の false 分岐（monster:100）を配置する THEN the system SHALL 行 3（y = 行 2 + LOOP_ROW_GAP）に leftward で配置する
4. WHEN stage 3-4 を実行する THEN the system SHALL 行 1 → 折り返し → 行 2 → condition → true 分岐 / false 分岐 → 合流 → goal の順に通過アニメが流れる（要件 8 と一貫）
5. the system SHALL NOT stage 3-4 の `cards` / `flow` の構造（turn の位置、cond の位置、`maxEnemyHp` 等）を本拡張のために変更する必要はない（パズル設計を保ったまま動く）

### 要件16: 既存ステージへの非破壊性（再確認）
**ユーザーストーリー：** 開発者として、本拡張で導入する direction-aware ロジックが、既存の rightward 文脈の condition / merge 展開を一切壊さないようにしたい。

#### 受け入れ基準
1. WHEN turn を含まないステージで condition を展開する THEN the system SHALL 本拡張導入前と完全に同一の column 更新（`column += 1`）・同一の mergeColumn 計算（`Math.max(...)`）・同一の x 座標式・同一の trueDir / falseDir 既定値（`'right'` / `'down'`）を使用する
2. WHEN turn を含むが turn より **前** に condition があるステージで condition を展開する THEN the system SHALL 同様に rightward 文脈の挙動を完全保持する（cond は turn 前にあるため `currentDirection === 'right'`）
3. WHEN 既存ステージ（1-X / 2-X / 3-X / 4-X / 5-X 等、turn 後に cond を持たない全ステージ）の `stage.slots` / `stage.conditions` / `stage.mergeNodes` / `stage.edges` を本拡張後に展開する THEN the system SHALL 本拡張導入前と **完全にバイト等価** な出力を生成する

---

## 対象外（今回のスコープ外）

- **複数 turn**（スネーク状の 3 行以上のレイアウト）。スキーマは拡張可能な形にするが、ローダーは 1 個目のみ採用。
- **方向指定**（`{"turn": {"direction": "up"}}` のような上方向折り返し）。デフォルトの「下方向 → 左向き」のみ対応。
- **loop の body 内 turn / condition の true / false 内 turn**。warn で無効化。
- **turn より後の loop**。`expandLoop` の direction 対応は本拡張のスコープ外。turn の後に loop を書いたステージは挙動が崩れるため、デザイナーは慣習として turn 後に loop を置かない。必要になった際は別途設計しなおす。
- **turn 専用の演出**（折り返し時の特別なエフェクト・アニメーション等）。既存の通過トレイル演出のみ流用。
- **turn 専用の視覚マーカー**（小さな円や別ノード等）。表示しない方針を維持。
- **既存ステージへの自動適用**。turn を使って書き換えるステージは本機能の要件外（別タスクで判断）。stage 3-4 への適用は要件 15 で扱う具体成果物。

## 用語

| 用語 | 意味 |
|---|---|
| turn 構文 | `flow` 配列のトップレベルに書く折り返しの宣言。ローダーが後続要素を次の行へ折り返す。視覚ノードは生成されない。 |
| 折り返し点 | turn 直前の終端ノードと turn 直後の最初のスロットを結ぶ垂直下方向のエッジが描画される位置。 |
| 行 1 / 行 2 / 行 3 | turn 前のスロットが並ぶ y 座標（行 1、`SLOT_Y_DEFAULT`）、turn 後のスロットが並ぶ y 座標（行 2、`SLOT_Y_DEFAULT + LOOP_ROW_GAP`、または `maxY + LOOP_ROW_GAP`）、行 2 の condition の false 分岐が並ぶ y 座標（行 3、`行 2 の y + LOOP_ROW_GAP`、要件 14 で導入）。 |
| 左向きエッジ | turn 後のスロット同士 / スロットと goal / スロットと condition / condition と merge / merge とスロット を結ぶエッジ。source 側の左辺ハンドルから target 側の右辺ハンドルへ伸びる。 |
| 下辺 source ハンドル | `SlotNode` に追加する新ハンドル。折り返し開始時の垂直下エッジの出口。 |
| 左辺 source / 右辺 target ハンドル | `SlotNode` / `goal` / `MergeNode` に追加する新ハンドル。左向きエッジの両端。 |
| leftward 文脈 | `processSubFlow` 内で `currentDirection === 'left'` の状態。turn 通過後、または親が leftward の再帰呼び出しで `direction: 'left'` を継承した状態。column 増減、merge 計算、condition の既定出口方向などが direction-aware に切り替わる。 |
| rightward 文脈 | `processSubFlow` 内で `currentDirection === 'right'` の状態。既定値で、turn が出現するまでの全フローで適用される。 |
