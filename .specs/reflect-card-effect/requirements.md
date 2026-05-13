# 要件定義: カウンター（reflect）カード効果（reflect-card-effect）

## はじめに

本機能は、フローチャート実行時にカウンターカード（`id === 'reflect'`）が通過された際の具体的なゲーム効果を実装する。プレイヤーがフローチャート上に配置したカウンターカードは、その直後に位置する 1 ノードでのモンスターカードの攻撃を **完全無効化** し、その攻撃値分のダメージを敵モンスターに反射する。同時にプレイヤーの HP バーをオレンジ色に変化させ、反射が成立した際は敵側にオレンジ色のダメージフロートを表示する。

本ゲームの目的の一つである「プログラミング的思考の学習」を踏まえ、カウンターカードを「敵攻撃の直前」という正しい位置に配置することで「逆襲できる」という強い報酬体験を提供する。マップ 1-3 / 1-4 では既にカウンターカードのスロット配置と手札定義（`{ "id": "reflect" }`、power なし）が済んでおり、本機能でその効果ロジックを実装する。

## 用語

- **リフレクト状態**: カウンターカード通過時に有効化される、次のノード 1 つに対してのみ作用する「反射バフ」状態。`battleStore` の `reflectActive` フラグ（boolean）で管理する。
- **次のノード**: カウンターカードがあるスロットの直後に位置するノード。エッジで直接結ばれた次のスロット（空きスロット／ロックカードを持つスロット）または goal ノードを指す。
- **反射成立**: リフレクト状態でモンスターカードに到達したときに発火する処理。モンスターの攻撃を完全に無効化し、攻撃値分を敵 HP から減算、オレンジダメージフロートを表示する。
- **リフレクト失効**: 次のノードがモンスターカードでない場合に、何も起きずリフレクト状態が解除される処理。
- **オレンジエフェクト**: リフレクト状態が有効な間、HP バー fill とラッパーに付与される視覚演出。`.fill` の色をオレンジ系（緑から変化）に、`playerHpBox` ラッパーにオレンジ系の box-shadow グローを付与する。HP 数値の分子部分も同様にオレンジ色に変化する。

## 要件

### 要件1: カウンターカード通過時のリフレクト状態付与

**ユーザーストーリー：** プレイヤーとして、カウンターカードを通った瞬間にリフレクトが発動したことを HP バー全体の色変化で視覚的に確認したい。なぜなら、カウンターカードを正しい位置に配置できたかどうかのフィードバックを実行中に得られないと、攻略の学習にならないから。

#### 受け入れ基準

1. WHEN 実行シーケンス中に `id === 'reflect'` のカードが配置されたスロットに `executionStep` が到達する THEN the system SHALL `battleStore.reflectActive` フィールドを `true` にセットする
2. WHEN `reflectActive` が `true` にセットされる THEN the system SHALL プレイヤー HP バーの `.fill` をオレンジ色（緑から変化）に切り替える
3. WHEN `reflectActive` が `true` にセットされる THEN the system SHALL プレイヤー HP バーラッパー（`playerHpBox`）にオレンジ色のグロー演出（`box-shadow` ベースのフラッシュ）を付与する
4. WHILE `reflectActive === true` the system SHALL プレイヤー HP 数値の「分子」部分（`currentPlayerHp` 表示）をオレンジ色で表示し、`/maxPlayerHp` 部分は通常色のままにする

### 要件2: 反射成立（次のノードがモンスターカード）

**ユーザーストーリー：** プレイヤーとして、カウンターカードの直後に敵攻撃が来たときに、その攻撃を完全に無効化し、敵にダメージを与え返したい。なぜなら、カウンターカードを正しく配置した報酬として「逆襲」という強い成功体験が必要だから。

#### 受け入れ基準

1. WHEN `reflectActive === true` AND モンスターカード（`id === 'monster'`）が配置されたスロットに `executionStep` が到達する THEN the system SHALL `currentEnemyHp` を `Math.max(0, currentEnemyHp - card.power)` で減算する
2. WHEN 反射が成立する THEN the system SHALL `applyPlayerDamage` を呼び出さない（プレイヤー HP は変動せず、被弾フロート・HP バー shake も発火しない）
3. WHEN 反射が成立する THEN the system SHALL 敵エリアに **オレンジ色のリフレクトダメージフロート**（`ReflectDamageFloater`）を発火し、`-card.power` の数値が浮き上がる演出を再生する
4. WHEN 反射が成立する THEN the system SHALL 既存の `applyEnemyDamage` ルートを通らないため、既存の赤系 `DamageFloater` は発火しない（フロートの色で「通常攻撃」と「反射」を視覚的に区別する）
5. WHEN 反射が成立する AND 反射ダメージで `currentEnemyHp === 0` になる AND `currentPlayerHp > 0` THEN the system SHALL シーケンス完了タイマーでの判定により勝利演出（`startVictorySequence`）を起動する（既存の勝利条件と整合）

### 要件3: リフレクト失効（次のノードがモンスター以外）

**ユーザーストーリー：** プレイヤーとして、カウンターカードの直後に敵攻撃以外のものが来た場合は、カウンターが無駄になることを HP バーの挙動で視覚的に理解したい。なぜならカウンターカードの「効果は次のノード 1 つだけ・対象はモンスターだけ」という制約をプレイヤーが内的モデルとして獲得できるよう、視覚演出でこの制約を表現する必要があるから。

#### 受け入れ基準

1. WHEN `reflectActive === true` AND 次のノードがモンスターカード以外（空きスロット・他カード・goal） THEN the system SHALL `currentEnemyHp` を変動させない（反射ダメージ発火なし）
2. WHEN 次のノードが配置済みの attack / heal / guard カード等 THEN the system SHALL そのカード本来の効果（`applyEnemyDamage` / `applyPlayerHeal` / `applyGuard`）を従来通り発火する（リフレクト状態は他カードの効果を妨害しない）

### 要件4: リフレクト状態のクリア（次のノード通過後）

**ユーザーストーリー：** プレイヤーとして、カウンターカードの効果が「次のノード 1 つだけ」に限定されていることを HP バーの色が戻ることで視覚的に確認したい。なぜなら防御カードと同じく、リフレクトの効果範囲が限定的であることをプレイヤーが学習する必要があるから。

#### 受け入れ基準

1. WHEN `reflectActive === true` AND カウンターカード配置スロットの直後にあるノードを `executionStep` が通過し終える（次のエッジフェーズに移行する） THEN the system SHALL `reflectActive` を `false` にクリアする
2. WHEN `reflectActive` が `false` にクリアされる THEN the system SHALL HP バーの `.fill` を通常色（緑）に戻す
3. WHEN `reflectActive` が `false` にクリアされる THEN the system SHALL HP 数値の分子色を通常色（白系）に戻す
4. WHEN `reflectActive` が `false` にクリアされる THEN the system SHALL `playerHpBox` のオレンジグロー演出をフェードアウトで除去する

### 要件5: リフレクト状態の初期化とリセット

**ユーザーストーリー：** 開発者として、リフレクト状態が実行シーケンスや初期化のタイミングで確実にクリアされることを保証したい。なぜなら、リフレクトが前回実行から残ったまま新しい実行が始まると、カウンターカードを置いていないのに敵攻撃を無効化してしまう等の不整合が起こりうるから。

#### 受け入れ基準

1. WHEN `initializeBattle(stage)` が呼ばれる THEN the system SHALL `reflectActive` を `false` にクリアし、`enemyReflectEvents` 配列も空にする
2. WHEN `startExecution(stage)` が実行シーケンスを開始する THEN the system SHALL `reflectActive` を `false` にクリアし、`enemyReflectEvents` も空にする
3. WHEN `retryFromFail()` が呼ばれる THEN the system SHALL `reflectActive` を `false` にクリアし、`enemyReflectEvents` も空にする
4. WHEN 実行中にプレイヤー HP が 0 に達して Fail フェーズへ遷移する（既存 `applyPlayerDamage` 内の中断処理） THEN the system SHALL `reflectActive` を `false` にクリアする

### 要件6: guard + reflect の同時発動時の上書き挙動

**ユーザーストーリー：** 開発者として、防御カードの直後にカウンターカードが来た場合（例: `[guard] → [reflect] → [monster]`）に状態が一貫した形になることを保証したい。なぜなら、現在のマップ 1 のステージでは発生しないが、将来のステージで複数バフが連続するパターンが追加される可能性があるから。

#### 受け入れ基準

1. IF `guardShield > 0` WHEN カウンターカードに到達する THEN the system SHALL `guardShield` を 0 にクリアし、`reflectActive` を `true` にセットする（最後のバフが優先、両立しない）
2. IF `reflectActive === true` WHEN 防御カードに到達する THEN the system SHALL `reflectActive` を `false` にクリアし、`guardShield` を `card.power` にセットする（最後のバフが優先）
3. 注釈：要件 6-1 と 6-2 は将来のステージのための明示的な仕様。マップ 1 では guard と reflect が連続するステージは存在しないため、現状の動作確認では発火しない。

### 要件7: ReflectDamageFloater の表示

**ユーザーストーリー：** プレイヤーとして、反射で与えたダメージが既存の通常攻撃ダメージとは別の色（オレンジ）で表示されることで、「これは反射ダメージである」ことを一目で識別したい。なぜなら、通常の attack カードによる被弾と区別がつかないと、「カウンターが効いたのか、たまたま敵に attack が当たったのか」が分からなくなるから。

#### 受け入れ基準

1. WHEN 反射が成立する THEN the system SHALL `battleStore.enemyReflectEvents` 配列に `{ id, amount }` 形式の新規イベントを push する
2. WHEN `enemyReflectEvents` に新規イベントが追加される THEN the system SHALL 敵エリアにマウントされた `ReflectDamageFloater` がそのイベントを購読し、`-amount` の数値をオレンジ色でフロート演出として表示する
3. WHEN `ReflectDamageFloater` のフロート演出が完了する THEN the system SHALL `dismissEnemyReflectEvent(id)` を呼び出して当該イベントを `enemyReflectEvents` から取り除く（既存 `DamageFloater` の自走 unmount パターンと整合）
4. WHILE `ReflectDamageFloater` のイベントを描画している the system SHALL 既存の `DamageFloater`（赤系）とは別レイヤーで独立して描画し、両者が同時に発火することはない（反射成立時は `applyEnemyDamage` を呼ばないため、`enemyDamageEvents` には push されない）

### 要件8: 既存システムとの整合

**ユーザーストーリー：** 開発者として、本機能の追加が既存の HP バー演出・攻撃カード処理・モンスターカード処理・回復カード処理・防御カード処理・勝利演出・失敗演出のいずれも壊さないことを保証したい。なぜなら、これらは既にユーザーが触れる機能であり、回帰させると体験が損なわれるから。

#### 受け入れ基準

1. WHEN 攻撃カード（`id === 'attack'`）が通過する THEN the system SHALL 従来通り `applyEnemyDamage(card.power)` を発火する（リフレクト状態にかかわらず既存挙動を維持）
2. WHEN 回復カード（`id === 'heal'`）が通過する THEN the system SHALL 従来通り `applyPlayerHeal(card.power)` を発火し、`reflectActive` は変動させない
3. WHEN 防御カード（`id === 'guard'`）が通過する AND `reflectActive === true` でない THEN the system SHALL 従来通り `applyGuard(card.power)` を発火する
4. WHEN `reflectActive === true` AND 次のノードが空きスロット（プレイヤー配置の attack / heal カード等） THEN the system SHALL そのカード本来の効果を従来通り発火しつつ、ノード通過後に `reflectActive` を `false` にクリアする
5. WHEN 実行シーケンスが正常完了する THEN the system SHALL 従来通り「敵 HP === 0 AND プレイヤー HP > 0」で勝利演出を起動する（`reflectActive` の値は勝利判定に影響しない）
6. IF プレイヤー HP=0 になって即 Fail へ遷移する THEN the system SHALL 既存の `battle-fail-retry` の中断機構と `executionTimers` 破棄を維持する（リフレクト状態も同時にクリア）
