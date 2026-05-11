# 要件定義: バトル失敗演出とやり直し機能（battle-fail-retry）

## はじめに

本機能はバトル画面の実行フェーズ（`startExecution`）の挙動を拡張し、「失敗時にプレイヤーが自分のフローチャートを振り返ってデバッグ的に修正できる」体験を提供する。具体的には、(1) 実行中に通過した経路を白いネオンライトの軌跡として残し、通過したスロット／カードのハイライトも保持する、(2) 敵を倒せなかった場合に Fail 演出（赤文字 + やり直し／マップへ戻るの 2 ボタン）を表示する、(3)「やり直す」を押すとカード配置を保持したまま操作可能状態に戻し、ピンポイントで配置を直して再実行できるようにする、の 3 点を実現する。

本ゲームの開発目的の一つである「ユーザーにプログラミング的思考を学んでもらう」を踏まえ、失敗時に「どこを通ったか」を視覚的に残すことで、将来の条件分岐ノード追加時にも自分の実行経路を振り返れる土台にする。

## 用語

- **実行シーケンス**: `PlayButton` 押下から `executionStep` がゴールに到達するまでの一連の進行。`startExecution(stage)` がドライブする。
- **通過経路**: 実行シーケンス中に `executionStep` がセットされた全ノード／全エッジの集合。途中で枝分かれが入る将来の拡張を見越して「経路」と呼ぶ。
- **Fail フェーズ**: 実行シーケンス完了時点で `currentEnemyHp > 0` の場合に開始される失敗演出フェーズ。`victoryPhase` と相互排他で、新規に `failPhase` として導入する。
- **やり直し操作可能状態（G 状態）**: Fail 後に「やり直す」ボタンを押した直後の状態。カード配置と通過経路の表示はクリアされ、ユーザーがカードを動かせる通常操作状態に戻る。

## 要件

### 要件1: 実行中の通過経路を白いネオンライトの軌跡として残す

**ユーザーストーリー：** プレイヤーとして、実行終了後にフローチャートのどの経路を通ったかを視覚的に確認したい。なぜなら、失敗時にどこで意図と違う処理が走ったかをデバッグ的に振り返りたいから。

#### 受け入れ基準

1. WHEN 実行中に `executionStep` があるエッジに到達する THEN the system SHALL そのエッジに白いネオンライト風の発光スタイルを付与する
2. WHEN 実行中に `executionStep` がそのエッジから次のノードへ進む THEN the system SHALL 通過済みのエッジの白い発光を維持する（消さない）
3. WHEN 実行中に `executionStep` があるスロット（または Start／Goal ノード）に到達する THEN the system SHALL そのノードに従来どおりハイライトを点灯する
4. WHEN 実行中に `executionStep` がそのノードから次のエッジへ進む THEN the system SHALL 通過済みノードのハイライトを **点滅状態ではなく固定された光った状態** で維持する
5. WHILE 通過経路の発光が表示されている the system SHALL 緑の進行アイコン（`AnimatedProgressEdge` の `<circle>`）は従来どおりアクティブなエッジ上のみで表示する
6. WHEN 実行シーケンスが完了する THEN the system SHALL 通過経路の発光（エッジ・ノード両方）をその状態で固定し、後続のフェーズ（CLEAR! または Fail）に持ち越す

### 要件2: 失敗判定と Fail フェーズへの遷移

**ユーザーストーリー：** プレイヤーとして、敵を倒せなかったときや相打ちになったときには明確に「失敗した」とわかるフィードバックを受け取りたい。なぜなら、結果が曖昧だと「もう一度実行していいのか」「マップへ戻るべきか」の判断ができないから。

#### 受け入れ基準

1. WHEN 実行シーケンスが正常に完了する AND `currentEnemyHp === 0` AND `currentPlayerHp > 0` THEN the system SHALL 既存の勝利演出（`startVictorySequence`）を起動する
2. WHEN 実行シーケンスが正常に完了する AND `currentEnemyHp > 0` THEN the system SHALL Fail フェーズを開始する
3. WHEN 実行シーケンスが正常に完了する AND `currentEnemyHp === 0` AND `currentPlayerHp === 0` THEN the system SHALL Fail フェーズを開始する（相打ちは失敗として扱う：README の勝利条件「ユーザーが死んでいない AND 相手が死んでいる」と整合）
4. WHILE 実行シーケンスが進行中 WHEN プレイヤー HP が 0 になる THEN the system SHALL 即座に Fail フェーズへ遷移し、残りのフェーズ（ノード／エッジ）の実行と効果発火（`applyEnemyDamage` / `applyPlayerDamage` / `applyPlayerHeal`）を打ち切る（理由：プレイヤー HP=0 の状態でモンスター被弾を受けたあと heal カードで復活すれば勝利できる、という抜け道を防ぐ）
5. IF 実行シーケンスが要件 4 の中断によって終了した THEN the system SHALL 完了タイマーで予定されていた勝敗判定（要件 1〜3）を実行しない（中断時点で確定した Fail フェーズを上書きしない）
6. IF Fail フェーズが開始されている THEN the system SHALL 勝利演出の `victoryPhase` 系の遷移は行わない
7. IF Fail フェーズが開始されている THEN the system SHALL 戦闘画面ルートに `pointer-events: none` 相当の操作ロックを付与する（`VictoryClearOverlay` と同等の扱い）

### 要件3: Fail オーバーレイの表示

**ユーザーストーリー：** プレイヤーとして、失敗時には「Fail」というメッセージと「やり直す」「マップへ戻る」の選択肢を 1 画面で受け取りたい。なぜなら、再挑戦するか撤退するかをその場で決められると体験がスムーズだから。

#### 受け入れ基準

1. WHEN Fail フェーズが開始される THEN the system SHALL 敵エリア（`.enemyArea`）に Fail オーバーレイを絶対配置でマウントする
2. WHEN Fail オーバーレイがマウントされる THEN the system SHALL 「Fail」テキストを赤色（明確に「失敗」を示す赤系の色）で表示する
3. WHEN Fail オーバーレイがマウントされる THEN the system SHALL 「Fail」テキストの下にボタン行を配置し、左側に「マップへ戻る」、右側に「やり直す」ボタンを配置する
4. WHEN Fail オーバーレイがマウントされる THEN the system SHALL 既存の右上 `BackToMapButton` を unmount する（`VictoryClearOverlay` と同じ扱い）
5. WHILE Fail フェーズの間 the system SHALL 敵スプライトを完全透明ではなく薄く（半透過）表示する
6. WHILE Fail フェーズの間 the system SHALL 敵 HP バー領域も薄く（半透過）表示し、敵スプライトと整合した「敵がまだ残っている」視覚を保つ
7. WHILE Fail フェーズの間 the system SHALL 通過経路の白い発光は維持される（要件1と整合）

### 要件4: 「マップへ戻る」操作（Fail 時の撤退）

**ユーザーストーリー：** プレイヤーとして、失敗したバトルから撤退してマップへ戻る選択肢が欲しい。なぜなら、強すぎる敵に当たったときや一旦準備し直したいときに、無理に再挑戦せずに離脱できるべきだから。

#### 受け入れ基準

1. WHEN ユーザーが Fail オーバーレイの「マップへ戻る」ボタンを押す THEN the system SHALL マップ画面へ遷移する（既存の `onExitToMap` と同じハンドラを呼ぶ）
2. WHEN ユーザーが「マップへ戻る」を押す THEN the system SHALL Fail フェーズを終了し、戦闘画面の状態をクリアする（次回バトル進入時に通常状態から開始するため）

### 要件5: 「やり直す」操作とカード配置の保持

**ユーザーストーリー：** プレイヤーとして、失敗したときに自分のフローチャートのうち「直したいカードだけ」を差し替えて再挑戦したい。なぜなら、毎回ゼロからカードを並べ直すのはデバッグ的思考の妨げになるから。

#### 受け入れ基準

1. WHEN ユーザーが Fail オーバーレイの「やり直す」ボタンを押す THEN the system SHALL Fail フェーズを終了する
2. WHEN ユーザーが「やり直す」を押す THEN the system SHALL **スロット割当（`slotAssignments`）と手札（`handCards`）の状態をそのまま保持する**
3. WHEN ユーザーが「やり直す」を押す THEN the system SHALL 通過経路の白い発光（エッジ）と通過済みノードの固定ハイライトをすべてクリアする
4. WHEN ユーザーが「やり直す」を押す THEN the system SHALL 敵 HP・プレイヤー HP・敵スプライトの透過度・敵 HP バーの透過度を初期状態に戻す（敵スプライトは完全表示、HP は max）
5. WHEN ユーザーが「やり直す」を押す THEN the system SHALL 戦闘画面ルートの操作ロック（`pointer-events: none`）を解除し、ユーザーがカードを動かせる通常操作状態（A 状態相当）に戻す
6. IF Fail 直後のやり直し操作可能状態に入っている WHEN ユーザーが任意のスロットからカードをドラッグして別のスロットへ移動する THEN the system SHALL 通常時と同じ配置遷移ロジックを適用する（既存の `endDrag` 動作）

### 要件6: 「やり直す」状態でのリセットボタン挙動

**ユーザーストーリー：** プレイヤーとして、Fail からやり直す状態に戻ったあとも、必要なら一括でカード配置をクリアして組み直したい。なぜなら、「ピンポイント修正では太刀打ちできない」と気付いた瞬間に手早くやり直す手段が要るから。

#### 受け入れ基準

1. IF Fail 直後のやり直し操作可能状態に入っている WHEN ユーザーがリセットボタンを押す THEN the system SHALL 既存の `initializeBattle(stage)` の挙動どおり、ユーザー配置のカードをすべて手札に戻し、ロックカード（モンスターカード等）は復元する
2. IF Fail 直後のやり直し操作可能状態に入っている WHEN ユーザーがリセットボタンを押す THEN the system SHALL 既存どおりプレイヤー HP・敵 HP も初期値に戻す（要件5-4 が「やり直す」で既に戻っているため、リセットでは再度初期化されるだけ）
3. WHILE 通常の操作可能状態（A 状態） the system SHALL リセットボタンの挙動は従来どおり変更しない（本機能の追加で既存の振る舞いを壊さない）

### 要件7: 実行中・Fail フェーズ中のボタン無効化

**ユーザーストーリー：** プレイヤーとして、実行中や Fail オーバーレイ表示中には誤って実行ボタンやリセットボタンを押せないようにしてほしい。なぜなら、状態遷移中にボタンが押せると Fail オーバーレイの後ろで意図せぬ実行が走るような不整合が起きうるから。

#### 受け入れ基準

1. IF 実行中（`isExecuting`）または Fail フェーズ中 THEN the system SHALL `PlayButton` を `disabled` にする
2. IF 実行中（`isExecuting`）または Fail フェーズ中 THEN the system SHALL `ResetButton` を `disabled` にする
3. IF 実行中（`isExecuting`）または Fail フェーズ中 THEN the system SHALL `ZoomButton` の挙動は既存仕様を踏襲する（既存スペック準拠で問題なければ追加変更しない）
4. WHILE Fail フェーズの間 the system SHALL 全スロットからのドラッグ操作を不可にする（戦闘画面ルートの `pointer-events: none` で吸収する想定）

### 要件8: 既存スペックとの整合性

**ユーザーストーリー：** 開発者として、本機能の追加が既存の勝利演出（victory-clear）・実行ボタン仕様（play-button）・モンスターカード仕様（monster-attack）・回復カード仕様（heal-card）の挙動を壊さないことを保証したい。なぜなら、これらは既にユーザーがプレイしている機能であり、回帰させると体験が損なわれるから。

#### 受け入れ基準

1. IF 実行シーケンス完了時点で `currentEnemyHp === 0` AND `currentPlayerHp > 0` THEN the system SHALL 既存の勝利演出シーケンス（dead → fading → cleared）を維持する
2. WHEN `victoryPhase === 'cleared'` THEN the system SHALL 既存の `VictoryClearOverlay` を表示する（本機能では変更しない）
3. NOTE: 既存の `startExecution` 完了時判定（`currentEnemyHp === 0` のみで勝利を起動）は本機能で `currentPlayerHp > 0` 条件を加えて修正する。これは挙動の回帰ではなく、README の勝利条件記述に既存実装を合わせる訂正である
3. WHEN モンスターカードが配置されている AND 実行中にプレイヤー被弾が発生する THEN the system SHALL 既存の `applyPlayerDamage` 演出（HP バー shake、被弾フロート）を維持する
4. WHEN 回復カードが配置されている AND 実行中にプレイヤー回復が発生する THEN the system SHALL 既存の `applyPlayerHeal` 演出（緑フラッシュ、ヒールフロート）を維持する
5. IF 通常の操作可能状態（A 状態） WHEN ユーザーがカードをドラッグ＆ドロップする THEN the system SHALL 既存の `endDrag` ロジックを変更しない
