# 要件定義: StartNode 実行トリガー化

## はじめに

フローチャートの実行トリガーを、画面右上の独立した PlayButton から、フローチャート左端の StartNode 自体に移す機能。StartNode をクリックすることで「ここから処理が始まる」という視覚的な意味と「ここを押せば実行が始まる」という操作を一致させ、プレイヤー（小学生〜中学生）が直感的に実行できるようにする。既存の PlayButton は本仕様で削除し、空いた右上の領域には別の仕様で別ボタンが配置される予定（本仕様のスコープ外）。

## 要件

### 要件1: StartNode のクリック実行トリガー化
**ユーザーストーリー：** プレイヤーとして、フローチャートの開始地点（StartNode）をクリックすることで実行を開始したい。なぜなら「ここから始まる」と書かれた要素を押すのが最も自然な操作だから。

#### 受け入れ基準
1. WHEN プレイヤーが StartNode をクリックする AND 全実行条件が満たされている THEN the system SHALL `battleStore.startExecution(stage)` を呼び出してフローチャートを実行開始する
2. WHEN フローチャートの実行が開始される THEN the system SHALL 既存の PlayButton 実行時と完全に同じ実行シーケンス（フェーズ列構築・スロット/ノードのハイライト進行・所要時間算出）で動作する
3. WHEN StartNode がクリックされて実行が開始される THEN the system SHALL StartNode 自身の `.active` クラスによる発光・点滅演出（既存の `startGoalHighlight` キーフレーム）を維持する

### 要件2: 実行可否判定（disabled 条件）
**ユーザーストーリー：** プレイヤーとして、実行できない状態のときは StartNode をクリックしても何も起きないようにしてほしい。なぜなら無効な操作が通ると挙動が壊れるから。

#### 受け入れ基準
1. IF `isExecuting` が true（既に実行中） THEN the system SHALL StartNode のクリックを無効化する（`startExecution` を呼ばない）
2. IF `isTransitioning` が true（拡大/縮小切替アニメーション中） THEN the system SHALL StartNode のクリックを無効化する
3. IF 全スロットが埋まっていない（`selectAllSlotsFilled` が false） THEN the system SHALL StartNode のクリックを無効化する
4. IF `victoryPhase !== null`（勝利演出中） THEN the system SHALL StartNode のクリックを無効化する
5. IF `failPhase !== null`（失敗演出中） THEN the system SHALL StartNode のクリックを無効化する
6. WHILE 上記いずれかが成立 the system SHALL StartNode に視覚的な無効状態（半透明 + `cursor: not-allowed`）を表示する

### 要件3: アイコンの差し替え（PlayButton の緑アイコンに統一）
**ユーザーストーリー：** プレイヤーとして、StartNode が実行ボタンであることが一目で分かるアイコンになっていてほしい。なぜなら「右向き矢印」より「再生マーク（▶）」の方が「実行」のメタファとして広く知られているから。

#### 受け入れ基準
1. WHEN StartNode がレンダリングされる THEN the system SHALL アイコン素材として `/icons/flowchart/play.svg`（緑色の再生アイコン）を使用する
2. WHEN StartNode がレンダリングされる THEN the system SHALL 旧アイコン `/icons/flowchart/start.svg` への参照を持たない
3. WHEN StartNode のアイコンが表示される THEN the system SHALL StartNode のマーカー（80×120 px）の中央に視覚的にバランスの取れたサイズで表示される（既存の `icon` クラス指定の `48×48` を基準に、`play.svg` の見え方に応じて微調整可）

### 要件4: PlayButton の完全削除
**ユーザーストーリー：** 開発者として、StartNode が実行トリガーになったあとは、旧 PlayButton コンポーネントとその配置箇所を完全に削除したい。なぜなら同じ機能の重複は将来のメンテで混乱の元になるから。

#### 受け入れ基準
1. WHEN 本仕様の実装が完了する THEN the system SHALL `frontend/src/features/battle/flowchart/PlayButton.jsx` を削除する
2. WHEN 本仕様の実装が完了する THEN the system SHALL `frontend/src/features/battle/flowchart/PlayButton.module.css` を削除する
3. WHEN 本仕様の実装が完了する THEN the system SHALL `BattleScreen.jsx` から `PlayButton` の import と JSX 利用箇所（`<PlayButton stage={stage} />`）を削除する
4. WHEN 本仕様の実装が完了する THEN the system SHALL `BattleScreen.module.css` の `.flowchartControls` 関連の構造を維持する（次の仕様で別ボタンを置く場所として残す）
5. IF PlayButton の docstring・コメントが他のファイルから参照されている THEN the system SHALL それらの参照をすべて削除または StartNode 側の docstring に統合する

### 要件5: 既存の StartNode 機能の維持
**ユーザーストーリー：** プレイヤーとして、実行トリガー化された後も StartNode の既存の見た目・挙動が変わらないでほしい。なぜなら学習済みのメンタルモデルが壊れると混乱するから。

#### 受け入れ基準
1. WHEN フローチャートが描画される THEN the system SHALL StartNode をフローチャート最左に配置し続ける（既存の `flowchart-start-goal` 仕様の位置を維持）
2. WHEN 実行中に StartNode が現在フェーズの対象になる THEN the system SHALL 既存の `startGoalHighlight` キーフレームによる発光・点滅演出を表示する
3. WHEN 実行終了後に `traversedNodeIds` に `'start'` が含まれている THEN the system SHALL 既存の `.traversed` クラスによる固定光を維持する
4. WHEN StartNode がレンダリングされる THEN the system SHALL 既存の右辺 `source` Handle を維持し、エッジ起点として機能し続ける
5. IF カードがドラッグされている THEN the system SHALL StartNode を dnd-kit のドロップ対象にしない（既存どおり `useDroppable` を呼ばない）

### 要件6: アクセシビリティ
**ユーザーストーリー：** 支援技術ユーザーとして、StartNode がボタンとして機能することが支援技術に伝わってほしい。なぜなら見た目だけでは「クリック可能」が伝わらないから。

#### 受け入れ基準
1. WHEN StartNode がレンダリングされる THEN the system SHALL 操作可能要素として認識される DOM 構造（`<button>` または `role="button"` + `tabIndex`）を持つ
2. WHEN StartNode が支援技術に読み上げられる THEN the system SHALL `aria-label="実行"` 相当のラベルを持つ（旧 PlayButton から踏襲）
3. WHEN StartNode がフォーカス可能になる AND Enter または Space キーが押される THEN the system SHALL クリック時と同じ実行トリガーを発火する（`<button>` 要素を使えば標準で達成される）
4. IF 実行不可状態 THEN the system SHALL `disabled` 属性または `aria-disabled="true"` を併用してキーボード経由の発火も防ぐ

### 要件7: 既存の他の演出・処理との非干渉
**ユーザーストーリー：** 開発者として、StartNode 実行トリガー化が他の既存機能を壊さないことを保証したい。なぜなら回帰バグは品質を損なうから。

#### 受け入れ基準
1. WHEN 本仕様の実装が完了する THEN the system SHALL 既存のリセットボタン（ResetButton）・拡大トグル（ZoomButton）の動作を変えない
2. WHEN 実行中に StartNode の `.active` 演出が走る THEN the system SHALL カード `.flashing` 演出やスロット `.active` 演出と視覚的に競合しない
3. WHEN 拡大/縮小トランジション中に StartNode 上にホバーする THEN the system SHALL `cursor: not-allowed` を表示し、クリックしても何も起きない（要件2との整合）
4. WHEN 勝利演出中（`.root.victory`）または失敗演出中（`.root.failed`）のオーバーレイが表示される THEN the system SHALL 既存の `pointer-events: none` ガードに加え、StartNode の `disabled` 状態が併存する（要件2-4・要件2-5と整合する二重防御）
