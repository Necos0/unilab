# 要件定義: 敵アクションカード（敵防御・敵回復・敵カウンター）

## はじめに

ワールド5で、敵が「攻撃（`monster`）するだけ」から卒業し、**防御・回復・カウンター**をフローチャート上の `lockedCard` として使ってくる。プレイヤー側の `guardShield` / `reflectActive` と**完全対称**な敵側ロジックを追加する（設計資料：`docs/enemy-action-cards.html`）。対称だから、プレイヤーは自分のカードで学んだ知識をそのまま敵の読みに使える。

現状これら3カードは**エンジン未実装（no-op）**。本機能で `simulateBattle`（ヘッドレス）と `battleStore`（live）の両方に効果を実装し、`evaluateCondition` の評価コンテキストに敵バフ変数を足す。カード画像（`public/cards/monster_guard.png` 等）とスロット埋め込み（`stages.json` の `lockedCard`）は既存の仕組みをそのまま使う。

**初登場ステージ**：`monster_guard` / `monster_heal` は **5-2**、`monster_reflect` は **5-3**（検証はこの2ステージ＋単体ケースで行う）。

## 要件

### 要件1: 3種の敵カードの効果
**ユーザーストーリー：** プレイヤーとして、敵の防御・回復・カウンターがフローチャート上で意図どおり作用してほしい。なぜなら、敵の作戦を読んで対抗するのがこのゲームの核だから。

#### 受け入れ基準
1. WHEN `monster_guard`（power N）のノードを通過する THEN the system SHALL 敵のシールド `enemyGuardShield` を N にセットする（累積でなく上書き。プレイヤーの `guard` と対称）
2. WHEN `monster_heal`（power N）のノードを通過する THEN the system SHALL 敵HPを N 回復する（`maxEnemyHp` を上限にクランプ）
3. WHEN `monster_reflect` のノードを通過する THEN the system SHALL `enemyReflectActive` を true にし、`enemyGuardShield` を 0 にする（プレイヤーの `reflect` と対称）

### 要件2: 敵側状態変数と「直後1マス」寿命
**ユーザーストーリー：** 開発者として、敵バフをプレイヤー側と対称に扱いたい。なぜなら、対称ルールが学習効果とコードの単純さの両方を生むから。

#### 受け入れ基準
1. WHEN 対戦を初期化する THEN the system SHALL `enemyGuardShield: 0` / `enemyReflectActive: false` を初期状態に含める
2. WHEN あるノードを離れて次のノードへ進む THEN the system SHALL 直前ノードが `monster_guard` なら `enemyGuardShield` を維持し、`monster_reflect` なら `enemyReflectActive` を維持し、それ以外では 0 / false に戻す（`clearTransientBuffs` の対称拡張。「直後の1マスだけ有効」）

### 要件3: プレイヤー攻撃の解決順（`monster` の鏡写し）
**ユーザーストーリー：** プレイヤーとして、自分の攻撃が敵のカウンター／シールドで跳ね返り／吸収されるのを、自分が受けるときと同じ理屈で処理してほしい。

#### 受け入れ基準
1. IF `enemyReflectActive` が true WHEN プレイヤーの `attack`/`finisher`（power×倍率 = D）が解決する THEN the system SHALL 敵HPを変えず、プレイヤーHPを D 減らす（反射）
2. IF `enemyReflectActive` が false かつ `enemyGuardShield > 0` WHEN `attack`/`finisher`（D）が解決する THEN the system SHALL `min(enemyGuardShield, D)` を吸収して `enemyGuardShield` を減らし、残り `D - 吸収` だけ敵HPを減らす
3. IF 敵バフが無い WHEN `attack`/`finisher`（D）が解決する THEN the system SHALL 敵HPを D 減らす（従来どおり）
4. WHEN `finisher`（ひっさつ）が解決する THEN the system SHALL `attack` と同じ解決順（反射→吸収→全部）で処理する（**貫通の特例は設けない＝(B)対称**）。※ `finisher` は 4-4 第二形態だけの例外カードで、その相手は敵バフを持たないため挙動に影響なし

### 要件4: 条件式での敵バフ参照
**ユーザーストーリー：** ステージ作者として、条件ノードで敵の構え（`enemyReflectActive === true`）やシールド（`enemyGuardShield > 0`）を読ませたい。なぜなら「状態変数を読む」上級ステージを作れるから。

#### 受け入れ基準
1. WHEN 条件式を評価する THEN the system SHALL `enemyGuardShield` / `enemyReflectActive` を変数として参照できる（`buildEvalContext` に追加。sim/live 両方）
2. WHEN `evaluateCondition` 本体 THEN the system SHALL 変更不要（変数はコンテキスト経由で解決される）

### 要件5: sim / live の整合と演出
**ユーザーストーリー：** 開発者として、ヘッドレスシミュレータと実戦（live）で結末が一致してほしい。なぜなら、ステージの解答検証（simulateBattle）が live の挙動を保証する前提だから。

#### 受け入れ基準
1. WHEN 同じ配置を `simulateBattle` と `battleStore`（live）で解決する THEN the system SHALL 同一の結末（win/lose）にする（既存の sim/live 整合チェックで mismatch 警告が出ない）
2. WHEN 敵カードが作用する THEN the system SHALL live に演出を出す（敵シールド表示・カウンター構えの表示・反射ダメージの敵→自分フロータ）。演出の具体はプレイヤー側の対称実装を流用

### 要件6: カードヘルプと非回帰
**ユーザーストーリー：** 開発者として、新カードの説明を用意しつつ既存ステージを壊したくない。

#### 受け入れ基準
1. WHEN 新カードを追加する THEN the system SHALL `card_help.json` に3種の説明（ふりがな付き）を追加する
2. WHEN `monster` / `attack` / `guard` / `heal` / `reflect` のみを使う既存ステージ（1-1〜4-4）を実行する THEN the system SHALL 変更前と同一の挙動にする
3. WHEN 変更後に build / lint を実行する THEN the system SHALL エラーなく通過する
