# 要件定義: 防御カード効果（guard-card-effect）

## はじめに

本機能は、フローチャート実行時に防御カード（`id === 'guard'`）が通過された際の具体的なゲーム効果を実装する。プレイヤーがフローチャート上に配置した防御カードは、その直後に位置する 1 ノードでの敵攻撃ダメージを防御カードの `power` 値分だけ軽減する。同時にプレイヤーの HP バーには「青い拡張領域（シールド）」が表示され、防御カードの効果が発動したことと有効範囲（次のノード 1 つのみ）が視覚的に理解できる設計とする。

本ゲームの目的の一つである「プログラミング的思考の学習」を踏まえ、防御カードを「敵攻撃の直前」という正しい位置に配置することの重要性を、視覚フィードバックと体感を通じてプレイヤーに伝えることを意図している。マップ 1-2 / 1-4 では既に防御カードのスロット配置と `power` 値（`guard 10` / `guard 80`）が定義済みであり、本機能でその効果ロジックを実装する。

## 用語

- **シールド**: 防御カード通過時に付与される、次のノード 1 つに対してのみ有効な一時的なダメージ軽減バッファ。`battleStore` の `guardShield` フィールドで管理する。現在 HP には算入されないが、被弾時に通常 HP より先に消費される。
- **次のノード**: 防御カードがあるスロットの直後に位置するノード。エッジで直接結ばれた次のスロット（空きスロット／ロックカードを持つスロット）または goal ノードを指す。
- **シールド消費**: 次のノードがモンスターカードのときに、ダメージからシールド値を差し引き、その後シールドを 0 にクリアする処理。
- **シールド失効**: 次のノードがモンスターカード以外（空きスロット、別カード、goal など）のときに、シールドが何の効果も発揮せず単に 0 にクリアされる処理（余剰防御は持ち越さない）。

## 要件

### 要件1: 防御カード通過時のシールド付与

**ユーザーストーリー：** プレイヤーとして、防御カードを通った瞬間にシールドが付与されたことを HP バーで視覚的に確認したい。なぜなら防御カードの効果が発動したか否かを実行中に把握できないと、攻略のフィードバックが得られず、配置の良し悪しを学習できないから。

#### 受け入れ基準

1. WHEN 実行シーケンス中に `id === 'guard'` のカードが配置されたスロットに `executionStep` が到達する THEN the system SHALL `battleStore.guardShield` フィールドにそのカードの `power` 値をセットする
2. WHEN `card.id === 'guard'` AND `card.power <= 0` THEN the system SHALL シールドを付与しない（既存の `card.power > 0` ガードと整合）
3. WHEN `guardShield` が正の値にセットされる THEN the system SHALL プレイヤー HP バーに「シールド分の青い拡張領域」を表示する
4. WHILE `guardShield > 0` the system SHALL プレイヤー HP の数値表示を `(currentPlayerHp + guardShield) / maxPlayerHp` の形式で表示する（例: `130 / 100`）
5. WHILE `guardShield > 0` the system SHALL 数値表示の「分子」部分（`currentPlayerHp + guardShield`）のみを青色で表示し、`/maxPlayerHp` 部分は通常色のままにする。これにより「現在の見かけ HP のうち、シールドを含んだ値である」ことを数値表示でも視覚的に示す
6. WHEN `guardShield` が 0 になる THEN the system SHALL 分子の青色を通常色に戻し、数値表示を `currentPlayerHp / maxPlayerHp` の通常形式に戻す

### 要件2: シールドによるダメージ軽減

**ユーザーストーリー：** プレイヤーとして、防御カードの直後に来る敵攻撃のダメージが軽減されることを実行画面上で確認したい。なぜなら、防御カードを正しく配置した報酬として「ダメージを受けない／受けにくくなる」体験が必要だから。

#### 受け入れ基準

1. WHEN `guardShield > 0` AND モンスターカード（`id === 'monster'`）が配置されたスロットに `executionStep` が到達する THEN the system SHALL `damage = Math.max(0, card.power - guardShield)` を最終ダメージとしてプレイヤー HP に適用する
2. WHEN シールドが攻撃を吸収する THEN the system SHALL シールド値を「吸収したダメージ量（`Math.min(guardShield, card.power)`）」分だけ減算する。残量がある場合は HP バーの青い領域がその分短く再描画される（例: シールド 30 で攻撃 20 を吸収 → シールド 10 に減少 → HP バー `110 / 100` で青い領域は 10 分のみ）
3. IF 残ダメージ `damage === 0` THEN the system SHALL `applyPlayerDamage` を呼び出さず、プレイヤー被弾演出（HP バー shake + 被弾フロート）も発火しない
4. IF 残ダメージ `damage > 0` THEN the system SHALL `applyPlayerDamage(damage)` を従来通り呼び出し、HP バー shake + 被弾フロート演出を発火する。フロートの数値はシールド吸収後の `damage` を表示する（例: 攻撃 50 をシールド 30 で軽減 → フロートは「-20」）

### 要件3: シールドのクリア（次のノード通過後）

**ユーザーストーリー：** プレイヤーとして、防御カードの効果が「次のノード 1 つだけ」に限定されていることを HP バーの挙動で視覚的に理解したい。なぜなら、防御カードの「適用範囲は 1 ノードのみ」という重要な制約をプレイヤーが内的モデルとして獲得できるよう、視覚演出でこの制約を表現する必要があるから。

#### 受け入れ基準

1. WHEN `guardShield > 0` AND 防御カード配置スロットの直後にあるノードを `executionStep` が通過し終える（次のエッジフェーズに移行する） THEN the system SHALL `guardShield` を 0 にクリアする
2. WHEN 次のノードがモンスターカードでない（空きスロット・別カード・goal 等） THEN the system SHALL シールドをダメージ軽減に使わず、ノード通過時点で `guardShield` を 0 にクリアする（余剰防御の持ち越しはしない、=シールドは無駄に消費される）
3. WHEN `guardShield` が 0 にクリアされる THEN the system SHALL HP バーの青い拡張領域を除去し、HP 数値表示を `currentPlayerHp / maxPlayerHp` の通常表記に戻す

### 要件4: シールドの初期化とリセット

**ユーザーストーリー：** 開発者として、シールドが実行シーケンスや初期化のタイミングで確実にクリアされることを保証したい。なぜなら、シールドが前回実行から残ったまま新しい実行が始まると、防御カードを置いていないのに無敵状態になる等の不整合が起こりうるから。

#### 受け入れ基準

1. WHEN `initializeBattle(stage)` が呼ばれる THEN the system SHALL `guardShield` を 0 にクリアする
2. WHEN `startExecution(stage)` が実行シーケンスを開始する THEN the system SHALL `guardShield` を 0 にクリアする
3. WHEN `retryFromFail()` が呼ばれる THEN the system SHALL `guardShield` を 0 にクリアする
4. WHEN 実行中にプレイヤー HP が 0 に達して Fail フェーズへ遷移する（既存 `applyPlayerDamage` 内の中断処理） THEN the system SHALL `guardShield` を 0 にクリアする

### 要件5: 連続防御カードの扱い（将来の備え）

**ユーザーストーリー：** 開発者として、将来 1 ステージに防御カードが複数配置されるステージが追加されても、防御効果のロジックが破綻しないことを保証したい。なぜなら、現在のマップ 1 のステージでは防御カードは各ステージに最大 1 枚しか含まれていないが、マップ 2 以降で複数枚配置可能になる可能性があるから。

#### 受け入れ基準

1. IF `guardShield > 0` WHEN 別の防御カード（`id === 'guard'`）が配置されたスロットに到達する THEN the system SHALL 新しい `power` 値で `guardShield` を上書きする（前のシールドの残量とは累積しない）

### 要件6: HP バーの拡張バー表示

**ユーザーストーリー：** プレイヤーとして、シールド残量と通常 HP を一目で区別したい。なぜならシールドは「次のノード 1 つに限定された一時的なバッファ」なので、通常 HP と同じ色で表示されると「シールドだと思って油断していたら通常 HP が減っていた」という誤解が起こり得るから。

#### 受け入れ基準

1. WHEN `guardShield > 0` THEN the system SHALL HP バーの右端に「シールド分の青い拡張領域」を追加で表示する
2. WHEN `guardShield > 0` THEN the system SHALL HP バーの全長を `maxPlayerHp + guardShield` を分母とした `(currentPlayerHp + guardShield)` の比率で描画する。これにより通常 HP 部分の長さは変わらず、右側にシールド分が追加で出現する見た目になる
3. WHEN `guardShield` が変動する（付与・消費・クリア） THEN the system SHALL HP バーの長さ変化と色変化を 250ms 程度のトランジションで滑らかにアニメートする
4. WHILE `guardShield > 0` the system SHALL シールド領域のカラーを既存の HP バー（赤系）と明確に区別できる青系の色に設定する
5. WHEN `guardShield` が変動する THEN the system SHALL HP バーラッパーを「青く光らせる」フラッシュ演出（既存の被弾時の赤フラッシュ、ヒール時の緑フラッシュと同様の発火）を行う

### 要件7: 既存システムとの整合

**ユーザーストーリー：** 開発者として、本機能の追加が既存の HP バー演出・攻撃カード処理・モンスターカード処理・回復カード処理・勝利演出・失敗演出のいずれも壊さないことを保証したい。なぜなら、これらは既にユーザーが触れる機能であり、回帰させると体験が損なわれるから。

#### 受け入れ基準

1. WHEN 攻撃カード（`id === 'attack'`）が通過する THEN the system SHALL 従来通り `applyEnemyDamage(card.power)` を発火する（防御カードロジックは敵側 HP に影響しない）
2. WHEN 回復カード（`id === 'heal'`）が通過する THEN the system SHALL 従来通り `applyPlayerHeal(card.power)` を発火し、`guardShield` は変動させない（回復はシールドを増やさない）
3. WHEN `guardShield > 0` AND 次のノードが空きスロット（プレイヤー配置の attack / heal / reflect カード等） THEN the system SHALL その配置カードの効果を従来通り発火しつつ、ノード通過後に `guardShield` を 0 にクリアする（シールドは敵攻撃以外には作用しない）
4. WHEN 実行シーケンスが正常完了する THEN the system SHALL 従来通り「敵 HP === 0 AND プレイヤー HP > 0」で勝利演出を起動する（`guardShield` の値は勝利判定に影響しない）
5. IF プレイヤー HP=0 になって即 Fail へ遷移する THEN the system SHALL 既存の `battle-fail-retry` 要件 2-4 / 2-5 の中断機構を維持する（シールド吸収後に HP=0 になるケースでも、中断処理は同じ）
