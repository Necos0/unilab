# 要件定義: 実行速度トグルボタン（2倍速）

## はじめに

フローチャート実行中に「もう失敗が確定しているのに長いループが終わるのを待つだけ」という退屈な体験を解消するため、実行中に **押下可能な早送りボタン**（`>>` 形状）をフローチャート右上の `.flowchartControls` 下段（旧 `PlayButton` 位置）に追加する。ボタンを押すと **次のエッジ／ノードから実行進行の所要時間が 50%**（= 2 倍速）になり、もう一度押すと 1 倍速に戻る。倍率は将来 3 倍速・4 倍速等に拡張可能な構造で実装する。

## 要件

### 要件1: 2倍速トグルボタンの配置と外観
**ユーザーストーリー：** プレイヤーとして、フローチャート実行中に「もう結果が見えているから早送りしたい」と感じたときに、画面上に常に見える早送りボタンを押せるようにしたい。なぜなら待ち時間がストレスになるから。

#### 受け入れ基準
1. WHEN 戦闘画面がレンダリングされる THEN the system SHALL `.flowchartControls` の下段（旧 `PlayButton` 位置）に早送りボタン（`>>`）を表示する
2. WHEN 早送りボタンがレンダリングされる THEN the system SHALL `ZoomButton` / `ResetButton` と統一感のある外観（パディング・色・角丸・font-family）で表示する
3. WHEN 早送りボタンがレンダリングされる THEN the system SHALL `aria-label="2倍速切替"` 等の支援技術向けラベルを持つ
4. WHEN 倍速がオン（2 倍速）の状態 THEN the system SHALL ボタンのアイコンを薄く（opacity 低下等）表示し、現在オン中であることが視覚的にわかる
5. WHEN 倍速がオフ（1 倍速）の状態 THEN the system SHALL ボタンのアイコンを通常通り表示する

### 要件2: 押下可能タイミングの制限
**ユーザーストーリー：** プレイヤーとして、実行中以外には倍速ボタンが反応しないようにしたい。なぜなら配置中や勝利演出中に押せても意味がないし、状態管理が複雑になるから。

#### 受け入れ基準
1. IF `isExecuting` が false（実行中ではない） THEN the system SHALL 早送りボタンを `disabled` 状態にする
2. IF `isExecuting` が true（実行中） THEN the system SHALL 早送りボタンを押下可能（`disabled` でない）状態にする
3. WHILE 早送りボタンが `disabled` the system SHALL `opacity: 0.4`、`cursor: not-allowed` 等の視覚的フィードバックを表示する（既存パターンに合わせる）
4. IF 早送りボタンが `disabled` THEN the system SHALL クリック・Enter / Space キーいずれでも倍速トグルを発火しない（既存 `<button disabled>` のネイティブ挙動で達成）

### 要件3: トグル機構と倍率の適用
**ユーザーストーリー：** プレイヤーとして、早送りボタンを押した瞬間からフローチャートの進行が速くなり、もう一度押せば元の速度に戻したい。なぜなら状況に応じて切り替えたいから。

#### 受け入れ基準
1. WHEN プレイヤーが早送りボタンをクリックする AND 現在の倍率が 1x THEN the system SHALL 倍率を 2x に切り替える
2. WHEN プレイヤーが早送りボタンをクリックする AND 現在の倍率が 2x THEN the system SHALL 倍率を 1x に戻す
3. WHEN 倍率が切り替わる THEN the system SHALL **次のエッジ／ノードのフェーズから** 新しい倍率を適用する（現在進行中のフェーズの所要時間は変えない、途中で時間が縮んだり延びたりしない）
4. WHEN 倍率が 2x の状態でフェーズが開始される THEN the system SHALL そのフェーズの所要時間を通常の **50%** にする
5. WHEN 倍率が 1x の状態でフェーズが開始される THEN the system SHALL そのフェーズの所要時間を通常通りにする

### 要件4: 倍率適用範囲
**ユーザーストーリー：** プレイヤーとして、倍速時はフローチャート進行・スロット光彩・HP エフェクトのすべてが揃って速くなってほしい。なぜなら一部だけ速くなると不揃いで違和感があるから。

#### 受け入れ基準
1. WHEN 倍率が 2x の状態でエッジ上を点が進む THEN the system SHALL エッジ上のドット移動時間（`phaseMs` 等）を 50% に短縮する
2. WHEN 倍率が 2x の状態でスロットノードが `.active` になる THEN the system SHALL スロットの発光アニメーション（`slotHighlight` 等）の所要時間を 50% に短縮する
3. WHEN 倍率が 2x の状態で条件ノード・スタート/ゴールマーカー・合流ノードが `.active` になる THEN the system SHALL それぞれの発光アニメーション所要時間を 50% に短縮する
4. WHEN 倍率が 2x の状態で HP バーのダメージ・回復・シールド・反射等のエフェクトアニメが発火する THEN the system SHALL それらの所要時間を 50% に短縮する
5. WHEN 倍率が 2x の状態で DamageFloater 等のダメージ表示が表示される THEN the system SHALL 表示時間・フェード時間を 50% に短縮する
6. IF 倍率が 2x WHEN 勝利演出が始まる THEN the system SHALL NOT 勝利演出（VictoryClearOverlay 等）の時間を倍速適用しない（演出は通常速度のまま）
7. IF 倍率が 2x WHEN 敗北演出が始まる THEN the system SHALL NOT 敗北演出（BattleFailOverlay 等）の時間を倍速適用しない（演出は通常速度のまま）

### 要件5: 実行終了時のリセット
**ユーザーストーリー：** プレイヤーとして、実行が終わったら倍率は自動的に 1x に戻ってほしい。なぜなら次の試行で意図せず 2 倍速のまま始まると驚くから。

#### 受け入れ基準
1. WHEN 実行が **勝利** で終了する THEN the system SHALL 倍率を 1x にリセットする
2. WHEN 実行が **敗北** で終了する THEN the system SHALL 倍率を 1x にリセットする
3. WHEN 実行が **`retryFromFail` でリセット** される THEN the system SHALL 倍率を 1x にリセットする
4. WHEN ユーザーが **マップへ戻る** THEN the system SHALL 倍率を 1x にリセットする
5. WHEN `initializeBattle(stage)` が呼ばれる THEN the system SHALL 倍率を 1x で初期化する

### 要件6: 将来拡張可能な構造
**ユーザーストーリー：** 開発者として、将来「3 倍速」「4 倍速」を追加できる設計にしたい。なぜなら最初から 2x ハードコードだと、後で改修コストが増えるから。

#### 受け入れ基準
1. WHEN 倍率値が状態に保存される THEN the system SHALL 倍率を **数値（例: `1`, `2`）** として保持する（boolean `isSpeedUp` のような 2 値固定にしない）
2. WHEN 倍率適用ロジック（JS の `setTimeout` や CSS animation duration）が書かれる THEN the system SHALL **`baseDuration / multiplier`** のような一般化された式で計算する
3. WHERE 将来「3 倍速ボタン」が追加される場合 the system SHALL 倍率配列（例: `[1, 2]` → `[1, 2, 3]`）と UI ボタンの追加だけで対応できる構造を持つ（store のロジックには手を入れない想定）

### 要件7: アクセシビリティと既存機能との非干渉
**ユーザーストーリー：** プレイヤー（支援技術ユーザー含む）として、早送りボタンが安全に使えて、他の機能を壊さないでほしい。

#### 受け入れ基準
1. WHEN 早送りボタンがフォーカスされる AND Enter または Space キーが押される THEN the system SHALL クリックと同じトグル動作を発火する（`<button>` の標準挙動）
2. WHEN 早送りボタンが追加される THEN the system SHALL 既存の StartNode クリック実行・ZoomButton・ResetButton・カードドラッグ・拡大/縮小トグルの動作を変えない
3. WHEN フローチャート実行中に倍率が変更される THEN the system SHALL 実行ロジックそのもの（フェーズの順序・カードの効果・HP 計算・勝敗判定）を変えない（時間だけ短縮）
4. WHEN 倍率変更が起こる THEN the system SHALL 実行中の進行（`executionStep` の遷移・`traversedNodeIds` の追記）を中断・スキップしない
