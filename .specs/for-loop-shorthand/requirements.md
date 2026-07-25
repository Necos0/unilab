# 要件定義: for ループ短縮記法（stagesLoader 拡張）

## はじめに

`for-loop` 仕様で追加した `for-start` / `for-end` ノードと `forLoopCounters` 機構を、**`stages.json` の `flow` 短縮記法**（`loader-branching-shortcut` 仕様）から自然に書けるようにする機能。ステージデザイナーが `for-start` / `for-end` の座標、ID、ループバックエッジを手書きしなくても `{ "for": { "iterations": 3, "body": [...] } }` の 1 要素で for ループが定義できるようにする。stage 4-2 「for 文」など、for ループを使うステージ実装の書きやすさを大幅に向上させる。

## 要件

### 要件1: `for` 要素の flow 内サポート
**ユーザーストーリー：** ステージデザイナーとして、`flow` 配列の中に `{ "for": {...} }` の 1 要素を書くだけで for ループを表現したい。なぜなら for-start / for-end の座標計算やループバックエッジの手書きは煩雑で、ミスの温床になるから。

#### 受け入れ基準
1. WHEN `flow` 配列の要素が `{ "for": {...} }` 形式（`for` キーに object 値） THEN the system SHALL この要素を for ループ短縮記法として扱う
2. WHEN `for` 要素が展開される THEN the system SHALL 対応する `for-start` ノード 1 個・`for-end` ノード 1 個・ボディ内のノード群・ループバックエッジ・ボディ終端 → for-end エッジ・for-start → ボディ先頭エッジを自動生成する
3. WHEN `for.for` の値が非オブジェクト（`null` / 配列 / 文字列 / 数値等）である THEN the system SHALL 通常スロット要素として扱う（既存の `isCondition` / `isLoop` / `isTurn` と同じ型ガード戦略）

### 要件2: `iterations` と `body` フィールドのサポート
**ユーザーストーリー：** ステージデザイナーとして、for ループの反復回数とボディ内容を直感的なキー名で書きたい。

#### 受け入れ基準
1. WHEN `for` の値が `{ "iterations": <整数>, "body": [...] }` の形式 THEN the system SHALL `iterations` を for ループの初期反復回数として使う
2. WHEN `for.iterations` が **1 以上の整数** THEN the system SHALL その値を `for-start` ノードの `iterations` プロパティに転記する
3. IF `for.iterations` が **1 未満・非整数・undefined** THEN the system SHALL `console.warn` を出し、当該 for 要素を **スキップ**（当該要素は無視して次の要素に進む）
4. IF `for.body` が **配列でない** THEN the system SHALL `console.warn` を出し、当該 for 要素を **スキップ**
5. WHEN `for.body` が空配列 `[]` THEN the system SHALL for-start → for-end を直接繋ぐエッジを生成し、body 無しの空ループとして展開する（無限ループのように見えるが、`forLoopCounters` が iterations 回で減衰するので安全）

### 要件3: body 内でのネスト構造サポート
**ユーザーストーリー：** ステージデザイナーとして、for ループのボディ内に **条件分岐** や **既存の while / do-while ループ** を入れ子で書きたい。stage 4-2 「for 文」の設計案（body 内に condition ノード）を直接表現できるように。

#### 受け入れ基準
1. WHEN `for.body` の要素が **通常スロット**（空オブジェクト `{}` や `lockedCard` 持ち等） THEN the system SHALL 既存の `buildBodySlot` と同じ流儀で slot を生成する
2. WHEN `for.body` の要素が **`isCondition(item) === true`**（`condition` キー持ち） THEN the system SHALL 既存の `processSubFlow` の condition 展開ロジックを再利用し、body 内に condition ノード + true/false 分岐 + merge ノードを生成する
3. WHEN `for.body` の要素が **`isLoop(item) === true`**（`loop` キー持ち、while/do-while） THEN the system SHALL 既存の `expandLoop` の呼び出しを再利用してネストループを生成する
4. WHEN `for.body` の要素が **`isForLoop(item) === true`**（`for` キーがネスト） THEN the system SHALL 本仕様の `expandForLoop` を再帰的に呼び出してネスト for を生成する
5. IF `for.body` の要素が **turn** THEN the system SHALL 既存の `processSubFlow` の turn ガード（top-level 外での turn は warn + skip）に従い、警告を出して無視する

### 要件4: 座標の自動計算とレイアウト
**ユーザーストーリー：** ステージデザイナーとして、for-start / for-end / body 内ノードの座標をひとつずつ書かなくても、自然な横並びレイアウトが自動生成されてほしい。

#### 受け入れ基準
1. WHEN `for` 要素が展開される THEN the system SHALL for-start ノードを **`for` 要素が置かれた column** に配置する（既存の `flow` 位置ロジックに従い、`SLOT_X_START + column * SLOT_X_STEP`、y は現在の `yLevel`）
2. WHEN body が展開される THEN the system SHALL body の最初のノードを **for-start の右隣**（column + 1）に配置する
3. WHEN body の全ノードが展開される THEN the system SHALL for-end ノードを **body の最後のノードの右隣**（body 終了 column、または body が空なら for-start の右隣）に配置する
4. WHEN for ループ全体の展開が終わる THEN the system SHALL `for` 要素の次の要素が **for-end の右隣**（for-end column + 1）から始まるように column を進める
5. WHEN body 内にネストした構造（condition の false 分岐等）で y 座標が下段に伸びる THEN the system SHALL 既存の `processSubFlow` の column / yLevel 管理に従い、for-end はメイン経路（body の main endings の column）に置く

### 要件5: 自動生成される ID の一貫性
**ユーザーストーリー：** 開発者として、`for-start` / `for-end` ノードの ID が **同じペア番号** で識別できるようにしてほしい。

#### 受け入れ基準
1. WHEN N 個目の `for` 要素が展開される THEN the system SHALL `for-start` ノードの ID を **`for-start-${N}`** の形式で自動採番する
2. WHEN 同じ for 要素の for-end が生成される THEN the system SHALL `for-end` ノードの ID を **`for-end-${N}`** の形式で自動採番する
3. WHEN `for-end` ノードが生成される THEN the system SHALL 対応する `for-start` の ID を **`forLoopId` フィールド**（例: `"for-start-1"`）として持たせる
4. WHEN ネストした for（内側の for）が展開される THEN the system SHALL N のカウンタは **flow 全体で共有**（内側でも外側でも独立してインクリメント）し、同じ ID が二度使われないことを保証する

### 要件6: エッジの自動生成
**ユーザーストーリー：** 開発者として、for-start と for-end 周辺のエッジ（ループバック・入口・出口）を手書きせず、自動生成されるようにしてほしい。

#### 受け入れ基準
1. WHEN `for` 要素が展開される THEN the system SHALL 直前の終端（endings）から **for-start へ入口エッジ** を生成する（通常の `buildEdge`）
2. WHEN body が展開される THEN the system SHALL for-start から body の最初のノードへ **入口エッジ** を生成する
3. WHEN body 展開が完了する THEN the system SHALL body の main endings から **for-end へ入口エッジ** を生成する
4. WHEN for-end が生成される THEN the system SHALL for-end から for-start へ **ループバックエッジ** を生成する（`sourceHandle: 'loop-back'`、`targetHandle: 'loop-back'`）
5. WHEN for ループ全体の展開が終わる THEN the system SHALL 次の要素と繋がる endings として `{ nodeId: 'for-end-N', sourceHandle: 'exit' }` を返す（exit エッジは次の要素展開時に自動的に生成される）

### 要件7: 短縮記法と `forStarts` / `forEnds` の統合
**ユーザーストーリー：** 開発者として、`for` 短縮記法で生成した for-start / for-end ノードが、既存の `for-loop` 仕様の `stage.forStarts` / `stage.forEnds` 配列に正しく積まれてほしい。

#### 受け入れ基準
1. WHEN `flow` 内の `for` 要素が展開される THEN the system SHALL ステージ完全形式に **`forStarts: [{id, iterations, position}]`** と **`forEnds: [{id, forLoopId, position}]`** を追加する
2. WHEN `flow` を使わない slots ベースのステージが展開される THEN the system SHALL 既存挙動を維持し、`forStarts: []` / `forEnds: []` を空配列として付与する（`FlowchartArea` の `stage.forStarts ?? []` フォールバックとも整合、ただし明示的に空配列を持たせる方が state 初期化の予測可能性が上がる）
3. WHEN `for` を全く含まない既存の `flow` ステージが展開される THEN the system SHALL 既存の `slots` / `conditions` / `mergeNodes` / `edges` の出力が **完全に無変化** で、`forStarts: []` / `forEnds: []` が追加されるのみ

### 要件8: `collectSlotTypeIds` への統合（ヘルプウィンドウ対応）
**ユーザーストーリー：** プレイヤーとして、for ループが登場するステージに入ったとき、for-start の残回数表示の意味を「？？？」から既存のカウントマス系ヘルプで理解できるようにしたい。for-start は「実行中に数字が変わるマス」という点で既存のカウントマスと概念的に対応するので、既存ヘルプを流用する。

#### 受け入れ基準
1. WHEN raw ステージ定義に `for` 要素が含まれる THEN the system SHALL `collectSlotTypeIds` の結果に **既存の `'counter'`** を追加する（for-start は「数字が変わるマス」というカテゴリで既存の counter 種別と同じ扱い）
2. WHEN body 内にネストされた `for` が含まれる THEN the system SHALL 再帰的に検出し、`'counter'` は 1 回だけ追加される（Set で重複排除）
3. WHEN `slot_help.json` の `counter` エントリが既に存在する THEN the system SHALL 新規エントリ（`'for'` 等）を追加せず、既存 counter ヘルプを流用する（本仕様は `slot_help.json` を触らない）

### 要件9: 既存機能との非干渉
**ユーザーストーリー：** 開発者として、for 短縮記法の追加が既存の loop / condition / turn / slot / linear の展開挙動を壊さないことを保証したい。

#### 受け入れ基準
1. WHEN `for` 要素を含まない既存の全 flow ステージが展開される THEN the system SHALL slots / conditions / mergeNodes / edges / start / goal の出力が **完全に無変化**（byte-level diff = 0 でなくとも意味的等価）
2. WHEN `for` 要素を含まない既存の全 slots ベースステージが展開される THEN the system SHALL 出力が完全に無変化
3. WHEN `expandFlow` の `ctx` に新規フィールド（`forCounter` 等）が追加される THEN the system SHALL 既存の `slotCounter` / `condCounter` / `mergeCounter` / `turnCount` / `afterTurn` の挙動は無変化
4. WHEN `for-loop` 仕様の runtime 機構（`forLoopCounters` / `decrementForLoopCounter` / `forCounter()` 構文 / `ForStartNode` / `ForEndNode`）が既に実装済み THEN the system SHALL 本仕様は runtime 機構を **一切変更せず**、ローダー層のみの拡張とする

### 要件10: バリデーションと警告
**ユーザーストーリー：** ステージデザイナーとして、for 短縮記法の誤記が **静かに壊れる**（無視される・意図と違う挙動になる）のではなく、コンソール警告で気づけるようにしてほしい。

#### 受け入れ基準
1. WHEN `for.iterations` が不正（1 未満・非整数・undefined） THEN the system SHALL `console.warn` を出し、当該 for 要素をスキップ
2. WHEN `for.body` が非配列 THEN the system SHALL `console.warn` を出し、当該 for 要素をスキップ
3. WHEN `for.body` 内に turn 要素が含まれる THEN the system SHALL 既存の `processSubFlow` の `isTopLevel: false` ガードで warn + skip
4. WHEN 警告が出るケースでも、他のステージや同じステージの他の要素は **クラッシュせず正常展開** される（既存の警告時と同じ流儀の安全側フォールバック）
