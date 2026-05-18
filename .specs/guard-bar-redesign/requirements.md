# 要件定義: ガードバーの再設計（guard-bar-redesign）

## はじめに

guard カードによるシールド（防御値）の視覚表現と内部仕様を、Fortnite のシールドシステムに倣う形に変更する。現在は HP バーの **右側に連結する青い延長部分** として表示されているが、これを **HP バーの真上に同じ長さで並ぶ独立した青いバー** に変更する。両バーには左側にアイコン（HP は十字、guard は盾）を付けて種別を明示する。ダメージはこれまで通り guard を優先消費し、guard が尽きてから HP に届く。max クランプ仕様により、ガードは `maxPlayerHp` を超えて蓄積されない。

## 要件

### 要件 1: ガードバーの独立表示

**ユーザーストーリー：** プレイヤーとして、自分のガード残量を HP とは別の独立したバーで一目で把握したい。なぜなら、Fortnite のような「シールド優先消費」の防御感覚を直感的に理解できるから。

#### 受け入れ基準

1. WHEN プレイヤー HUD が描画される THEN the system SHALL HP バーの真上にガードバーを表示する
2. WHEN ガードバーが描画される THEN the system SHALL HP バーと同じ横幅・同じ高さで表示する
3. WHEN ガードバーが描画される THEN the system SHALL バー左側に盾の SVG アイコンを表示する
4. WHEN HP バーが描画される THEN the system SHALL バー左側に十字の SVG アイコンを表示する
5. IF `guardShield === 0` WHEN ガードバーが描画される THEN the system SHALL バーを空（青の塗りなし、外枠のみ）として常に表示する
6. WHEN HP バーが描画される THEN the system SHALL 従来 HP バー右側に青く伸びていたガード表示部分を撤去する

### 要件 2: ガードバーの最大値

**ユーザーストーリー：** プレイヤーとして、ガードの最大値が自分の HP の最大値と同じ長さで揃っていることで、相対的なガード量を視覚で把握したい。

#### 受け入れ基準

1. WHEN ガードバーの最大値が必要 THEN the system SHALL `state.maxPlayerHp` をそのままガードバーの最大値として用いる
2. WHEN `maxPlayerHp` が変更される THEN the system SHALL ガードバーの最大値も連動して変化する
3. WHILE ガードバーが描画されている WHERE `guardShield > 0` the system SHALL `guardShield / maxPlayerHp` の比率で青の塗り幅を計算する

### 要件 3: Guard カード通過時のシールドセットと上限クランプ

**ユーザーストーリー：** プレイヤーとして、guard カードを通すとガードバーがカードの power に応じた長さで青く塗られ、最大 HP を超える power が来てもバーの範囲を超えない挙動を見たい。

#### 受け入れ基準

1. WHEN guard カードが配置されたスロットを実行が通過する THEN the system SHALL `guardShield` を `card.power` で **上書き** する（既存実装 `applyGuard` の上書き仕様を維持）
2. IF `card.power > maxPlayerHp` WHEN guard カードを通過する THEN the system SHALL `guardShield` を `maxPlayerHp` でクランプする（`Math.min(card.power, maxPlayerHp)`）
3. WHEN `guardShield` が変化する THEN the system SHALL ガードバーの青い塗り幅を新しい値にトランジションで追従させる（既存 HpBar と同じアニメーション様式）
4. WHEN guard カードを連続で通過する THEN the system SHALL 上書き式に従い、最後の guard カードの power（max クランプ後）のみが残る

### 要件 4: ダメージ吸収の優先順位

**ユーザーストーリー：** プレイヤーとして、敵の攻撃を受けたときガードが残っていれば先にガードから減り、ガードを使い切ってから HP に届く挙動を見たい。

#### 受け入れ基準

1. IF `guardShield >= damage` WHEN 敵のダメージが `damage` 量で発生する THEN the system SHALL `guardShield -= damage` のみ実行し HP は変化させない
2. IF `0 < guardShield < damage` WHEN 敵のダメージが発生する THEN the system SHALL `guardShield` を `0` にし、`damage - 元のguardShield` 分を HP から減算する
3. IF `guardShield === 0` WHEN 敵のダメージが発生する THEN the system SHALL ダメージ量をそのまま HP から減算する（従来通り）
4. WHEN ガード吸収によりダメージが減衰する THEN the system SHALL ガードバーの減少を即座に視覚反映する
5. IF `0 < guardShield < damage` WHEN ダメージが guard / HP 両方を消費する THEN the system SHALL ガードバー減少アニメーションが視認できるだけの短い遅延を挟んでから HP バー減少を発火させる（「ガードが防いだ」印象を強調するため）
6. WHEN HP バー減少の発火タイミングを決める THEN the system SHALL ガードバー減少と同じ視認窓のなかで連続して見えるよう、長すぎる間（既存ノードフェーズ時間相当の長さなど）は取らない

### 要件 5: アイコンアセット

**ユーザーストーリー：** プレイヤーとして、HP バーとガードバーを左側のアイコンで一目で見分けたい。

#### 受け入れ基準

1. WHEN HP バー用のアイコンを表示する THEN the system SHALL 簡素な十字形（緑系、HpBar の `.fill` 背景色 `#3ad430` と統一、heal カードを想起させるデザイン）の SVG を表示する
2. WHEN ガードバー用のアイコンを表示する THEN the system SHALL 簡素な盾形（青系、GuardBar の `.fill` 背景色 `#4a8ef0` と統一、guard カードを想起させるデザイン）の SVG を表示する
3. WHEN アイコンが描画される THEN the system SHALL バー高さに収まる大きさ（バー高さの 0.9〜1.1 倍程度）で表示する
4. WHEN アイコンの色を決める THEN the system SHALL 「緑 = HP 関連」「青 = ガード関連」のカラーグルーピングを成立させ、対応するバー塗り色と完全一致させる

### 要件 6: 既存挙動への影響範囲

**ユーザーストーリー：** 開発者として、ガードバー再設計が他のカード効果（heal / reflect / monster / attack）や既存ステージ（1-1〜1-4、2-1）に悪影響を与えないことを保証したい。

#### 受け入れ基準

1. WHEN heal カードが実行される THEN the system SHALL これまで通り HP のみ回復する（`guardShield` は変化させない）
2. WHEN reflect カードが実行される THEN the system SHALL これまで通り `reflectActive: true` のみ設定する（`guardShield` に影響しない）
3. WHEN 既存のマップ 1 ステージ（1-1〜1-4）を実行する THEN the system SHALL guard カードを含まない場合でも正常に動作する（ガードバーは常時 `guardShield === 0` 表示として描画されたまま）
4. WHEN ステージ 2-1 を実行する THEN the system SHALL 既存の戦闘挙動を保ちつつ、ガード表示のみ新仕様に切り替わる
5. WHEN 戦闘終了（勝利・失敗）後にやり直す THEN the system SHALL `guardShield` を `0` にリセットする（既存挙動を維持）

### 要件 7: ガードとリフレクトの排他制御（既存挙動の維持）

**ユーザーストーリー：** ステージデザイナーとして、ガードとリフレクトが意図せず同時有効になる状態を避けたい。なぜなら、両カードとも「次のモンスターカードに対する防御効果」という同じ役割を持ち、複数同時に有効だと挙動が曖昧になるから。

> **実装メモ**: 本要件は **既存実装 `applyGuard` / `applyReflect` に既に組み込まれている排他クリアと、エッジフェーズでの自動初期化** （`battleStore.js:1047`、`822-826`）の挙動をそのまま継続する。新仕様（ガードバー UI 変更）でも同じ排他クリアが維持されることを明示する目的の要件であり、新規ロジックは不要。

#### 受け入れ基準

1. IF `reflectActive === true` WHEN guard カードを通過する THEN the system SHALL `reflectActive` を `false` に設定したうえで `guardShield` を `card.power`（max クランプ後）で上書きする
2. IF `guardShield > 0` WHEN reflect カードを通過する THEN the system SHALL `guardShield` を `0` に設定したうえで `reflectActive` を `true` に設定する
3. WHEN モンスターカードが効果を発火する THEN the system SHALL 「直前に有効な防御効果」（guard 単独 / reflect 単独 / どちらもなし のいずれか 1 状態）に従って処理する
4. WHEN guard / reflect の状態が変化する THEN the system SHALL ガードバー描画と reflect インジケータの視覚要素が自動で更新される（state からの派生表示のため）
5. WHEN guard ノードや reflect ノードでないノードを通過した直後のエッジに到達する THEN the system SHALL `guardShield > 0` なら `clearGuard()` を、`reflectActive === true` なら `clearReflect()` を呼び、両状態を初期化する（既存挙動）

### 要件 8: HP 数値テキスト表示（合算値とアクティブ効果の色付け）

**ユーザーストーリー：** プレイヤーとして、ガードが乗っているときに「今の総体力（HP + ガード）」が数値で一目で読み取りたい。なぜなら、バーの塗り幅だけでは細かい数値が把握しにくく、Fortnite の HUD 同様に Shield + Health の合算が数字で見えると判断材料になるから。

#### 受け入れ基準

1. WHEN プレイヤー HP テキストを描画する THEN the system SHALL 分子に `currentPlayerHp + guardShield` を表示し、分母に `maxPlayerHp` を表示する（例: `120/100`）
2. IF `guardShield > 0` WHEN プレイヤー HP テキストを描画する THEN the system SHALL 分子部分を青色（GuardBar の `.fill` 背景色と同じ `#4a8ef0`）で表示する
3. IF `reflectActive === true` WHEN プレイヤー HP テキストを描画する THEN the system SHALL 分子部分をオレンジ色（HpBar の `.fill.reflect` 背景色と同じ `#ff8c42`）で表示する
4. IF `guardShield === 0` AND `reflectActive === false` WHEN プレイヤー HP テキストを描画する THEN the system SHALL 分子部分をデフォルト色（白系）で表示する
5. WHEN `guardShield > 0` AND `reflectActive === true` が同時成立する状態は発生しない（要件 7 の mutex により保証）
