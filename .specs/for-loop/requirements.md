# 要件定義: for ループノード（stage 4-2 「for 文」）

## はじめに

stage 4-2 「for 文」で使う **for ループ専用のノード種**（`for-start` と `for-end`）と、それらを組み合わせた **ステージ定義** を新規追加する機能。プログラミング学習の題材として「for 文（決まった回数だけ繰り返す）」の概念を、フローチャート上に **開始ノード（残り回数を大きく表示）** と **終了ノード（ループバックの起点）** の対で視覚化する。既存の loop-counter・flowchart-loop・condition・merge を組み合わせても同等の挙動は作れるが、for 文の学習効果を高めるため **専用の見た目と自動セマンティクス** を持つノードを用意する。

## 要件

### 要件1: `for-start` ノードの追加
**ユーザーストーリー：** プレイヤーとして、for ループの開始点を一目で分かるように、専用の見た目と現在の残り回数表示を持つノードでフローチャートに置きたい。なぜなら「for 文がここから始まる」「あと何回ループするか」を視覚的に把握したいから。

#### 受け入れ基準
1. WHEN ステージ定義で `for-start` ノード（`type: 'for-start'`）が定義される THEN the system SHALL React Flow のカスタムノードとして描画する
2. WHEN `for-start` ノードが描画される THEN the system SHALL **左辺（start 側）の 2 つの角を斜めに切った長方形**（右向きに突き出た形状）で表示する
3. WHEN `for-start` ノードが描画される THEN the system SHALL **中央に「残り n 回」の残回数を大きな数字で表示** する（プレイヤーが実行中に一目で残り回数を把握できる文字サイズ）
4. WHEN ステージ定義で `for-start` ノードに **`iterations: 3`** のような初期回数（1 以上の整数、上限なし）が指定される THEN the system SHALL 実行開始時に内部カウンタをこの値で初期化する。実行中の暴走は既存の `LOOP_MAX_VISITS`（100）runaway ガードで保護される

### 要件2: `for-end` ノードの追加
**ユーザーストーリー：** プレイヤーとして、for ループの終端を一目で分かるように、for-start と対になる見た目のノードでフローチャートに置きたい。なぜなら「for 文がここで一区切り／繰り返しの折り返し」を視覚的に把握したいから。

#### 受け入れ基準
1. WHEN ステージ定義で `for-end` ノード（`type: 'for-end'`）が定義される THEN the system SHALL React Flow のカスタムノードとして描画する
2. WHEN `for-end` ノードが描画される THEN the system SHALL **右辺（goal 側）の 2 つの角を斜めに切った長方形**（`for-start` を左右反転した形状、左向きに凹んだ形状）で表示する
3. WHEN `for-end` ノードが描画される THEN the system SHALL 数字などの動的な表示は持たず、for-start と対になる装飾のみを持つ

### 要件3: for ループの実行セマンティクス
**ユーザーストーリー：** 開発者として、for-start と for-end のペアが「決まった回数繰り返す for 文」として一貫した挙動をするようにしたい。なぜなら教材としての意味が壊れると学習効果が下がるから。

#### 受け入れ基準
1. WHEN 実行が `for-start` ノードに **初めて** 到達する THEN the system SHALL for ループの内部カウンタを `iterations` の初期値（例: 3）にセットする
2. WHEN 実行が `for-start` ノードに到達する THEN the system SHALL 常に「本体へ進む」1 本の outgoing エッジに沿ってループ本体へ進む（`for-start` 側では分岐しない）
3. WHEN 実行が `for-end` ノードに到達する THEN the system SHALL 内部カウンタを **1 減らす**（デクリメント）
4. WHEN 実行が `for-end` ノードでデクリメント後の内部カウンタ > 0 THEN the system SHALL **`for-start` へ戻るループバックエッジ** に沿って進む
5. WHEN 実行が `for-end` ノードでデクリメント後の内部カウンタ === 0 THEN the system SHALL **ループ出口エッジ** に沿ってループ外の次ノード（例: 後続の Attack ノード）へ進む
6. WHEN 内部カウンタが実行中に変化する THEN the system SHALL `for-start` ノードの残り回数表示を **即座に更新** する
7. WHEN ループ本体の実行中に条件ノードが `for-start` の残回数を参照する THEN the system SHALL その iteration で **body に入ってから for-end に到達するまでの間の値**（デクリメント前の値、`for-start` 表示中と同一値）を返す
8. IF stage 定義に for-end ノードから 2 本の outgoing エッジ（loop-back + exit）が定義されていない THEN the system SHALL 実行時に警告を出しつつ通常のリンク不備扱いで安全に処理する（既存の edge validation ガードと同じ流儀）

### 要件4: 残回数の可視化と分岐条件
**ユーザーストーリー：** プレイヤー・教材利用者として、for ループのカウンタ値を **条件ノード** の判定に使えるようにしたい。なぜなら「for i in ...: if i == 2: ... else: ...」のような複合構造を組みたいから。

#### 受け入れ基準
1. WHEN 条件ノードの式に **`forCounter('<for-loop-id>')` 構文** が書ける（例: `forCounter('for-1') === 2`） THEN the system SHALL 現在の for ループカウンタ値と比較して true / false を返す
2. WHEN `forCounter('<id>')` が既存の `counter('<id>')` と **別関数として** 評価される THEN the system SHALL 通常のカウンタカードとは名前空間・値が独立している（同名 ID があっても混線しない）
3. IF 条件ノードで参照される for ループ ID が実行時に初期化されていない（まだ for-start に到達していない） THEN the system SHALL 参照値は 0 として扱う（既存 counter の挙動と同じ）
4. WHEN 条件ノードが for ループカウンタを参照して判定する THEN the system SHALL 判定タイミングは条件ノードに到達した瞬間の for カウンタ値を使う

### 要件5: stage 4-2 「for 文」ステージ実装のための基盤保証
**ユーザーストーリー：** 開発者として、stage 4-2 「for 文」を JSON で定義するときに、必要なノード種と機構が **すべて提供されている** ことを保証したい。ステージ定義そのもの（カード枚数・スロット配置・エッジ座標）は stage 4-2 実装者（本仕様のスコープ外）が担う。

#### 受け入れ基準
1. WHEN stage 4-2 相当のシナリオ（Start → 攻撃 → for-start(3) → 条件 → 分岐 → merge → for-end → Attack → Goal、ループバック付き）が JSON で書ける THEN the system SHALL 以下の要素をすべて提供する：
   - `type: 'for-start'` および `type: 'for-end'` ノードの定義
   - `for-end` から `for-start` へのループバックエッジのサポート（既存の loop-back エッジと同じ描画・実行機構でよい）
   - `forCounter('<id>')` を条件式で使える評価器（要件4）
   - 既存の condition / merge / slot / start / goal ノードとの共存
2. WHEN ステージ定義で iterations が **3 以外の値**（例: 1・5・10・50 など）を持つ for ループが書かれる THEN the system SHALL 同じセマンティクスでその回数分ループする（上限なし、ただし既存の `LOOP_MAX_VISITS` runaway ガードは掛かる）
3. WHEN stage 4-2 の詳細な JSON 定義（カード枚数、正確なスロット配置、エッジ座標、演出）が本仕様の外で追加される THEN the system SHALL 本仕様のノード・機構の変更なしにそれを受け入れる

### 要件6: 見た目のバリアント（開始・終了で対称）
**ユーザーストーリー：** プレイヤー・教材利用者として、for-start と for-end が **開始／終了の対** であることが一目で分かる見た目にしてほしい。

#### 受け入れ基準
1. WHEN `for-start` と `for-end` が同じフローチャート上に並ぶ THEN the system SHALL 両者は **左右反転した装飾**（開始は左角を切った右向き、終了は右角を切った左向き）で対を成す
2. WHEN `for-start` / `for-end` ノードが描画される THEN the system SHALL 既存の SlotNode / ConditionNode / MergeNode と **色・角丸・境界の統一感** を保つ（背景色・枠色などが浮かない）
3. WHEN `for-start` ノードがハイライト（`.active`）または通過済み（`.traversed`）になる THEN the system SHALL 既存のスロット／条件ノードと同じキーフレーム（`startGoalHighlight` 等）の発光・点滅演出を適用する
4. WHEN `for-end` ノードがハイライト・通過済みになる THEN the system SHALL for-start と同じ演出パターンを適用する

### 要件7: 既存機能との互換性
**ユーザーストーリー：** 開発者として、for ループの追加が既存の loop-counter / flowchart-loop / condition / merge の挙動を壊さないことを保証したい。

#### 受け入れ基準
1. WHEN ステージ定義に `for-start` / `for-end` ノードが含まれない THEN the system SHALL 既存の全ステージ（1-x〜5-x）で挙動の変化がない
2. WHEN for ループ内部に既存の loop-counter カード・restricted-slot・multiplier-slot が置かれる THEN the system SHALL それらは通常通り動作する（for カウンタと counter card は独立）
3. WHEN for ループ内部に condition ノードが置かれる THEN the system SHALL 通常の条件式判定が動く（for カウンタ参照式も含めて）
4. WHEN for ループ内部に merge ノードが置かれる THEN the system SHALL 通常の合流ロジックが動く
5. WHEN for ループが実行中に `LOOP_MAX_VISITS`（=100）を超える THEN the system SHALL 既存の runaway ガード（`failPhase: 'shown'`）が発火して安全に停止する

### 要件8: 実行速度と加速機構との整合
**ユーザーストーリー：** プレイヤーとして、for ループ内のノードにも既存の 2 倍速トグル・ボス第二形態の段階加速が同じように適用されてほしい。

#### 受け入れ基準
1. WHEN for ループ内部のノード・エッジで実行が進行する THEN the system SHALL 既存の `speedMultiplier` による所要時間短縮が **全 for ループノードに適用**される（for-start・for-end・その内部）
2. WHEN 第二形態ステージで for ループが使われる THEN the system SHALL 既存の段階加速（`nextPhaseMs`）が for ループ内のノードにも適用される
