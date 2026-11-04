# 要件定義: ステージ 5-2（防御・回復を身につける）

## はじめに

ワールド5の2番目のステージ `5-2`。テーマは **防御・回復の習得**と、**敵が防御/回復/攻撃を「プレイヤーの置いたカード種類」に反応して使い分けてくる読み合い**。敵アクションカード（`monster_guard` / `monster_heal`、本ステージが初登場）＋敵攻撃（`monster`）がフロー上に `lockedCard` として埋め込まれ、**条件分岐がプレイヤースロットの型（attack/guard/heal）を参照**して敵の行動が変わる。原案は手書き `5-2.png`＋作者解説を source of truth とする。

実装には、`flow` スロットに**明示 id** を付ける小さなローダー拡張が必要（条件が途中スロットを型参照するため。詳細は要件2）。

### 定数・手札・解答（確定値）
- 自分HP=100 / 敵HP=285 / 敵=（placeholder は `lagiacrus`。原案に敵指定が無ければ既存踏襲）
- 手札（12枚）：攻40×2・攻10・攻5 ／ 防30・防15・防5×2 ／ 回30・回20 ／ カウンター（reflect）×2
- 解答：[1]reflect・[2]防15・[3]防30・[4]攻40・[5]攻5・[6]回30・[7]reflect・[8]回20・[9]攻10・[10]攻40、**ダミー=防5×2**
- 倍率：[6]×2・[9]×2・[10]×3（[10] は `acceptOnly:"attack"`）。[4] は3周 for ループ内。

## 要件

### 要件1: `flow` スロットの明示 id 対応（ローダー拡張・再利用可）
**ユーザーストーリー：** ステージ作者として、`flow` のスロットに安定した id を付け、条件式から型参照したい。なぜなら、途中スロットの自動採番 id は間に挟まる locked カードでズレて壊れやすいから。

#### 受け入れ基準
1. WHEN `flow` のスロット要素に `"id"` が指定されている THEN the system SHALL その id をスロット id として使う（`buildBodySlot`。採番カウンタは従来どおり加算）
2. WHEN `"id"` が未指定 THEN the system SHALL 従来どおり `slot-${採番}` を使う
3. WHEN 既存ステージ（`id` を使わない 1-1〜5-1）を展開する THEN the system SHALL 変更前と同一の出力にする（線形 `expandSlots` は既に `raw.id` 尊重済みで一貫）

### 要件2: ステージ対戦パラメータの提供
#### 受け入れ基準
1. WHEN `5-2` を開始する THEN the system SHALL 敵HP=285・自HP=100 で初期化し、手札12枚を提供する
2. WHEN `5-2` を読み込む THEN the system SHALL 10スロット（明示 id 付き）を用意し、[10] を `acceptOnly:"attack"`、[6]×2・[9]×2・[10]×3 の倍率、[4] を3周ループ内に置く

### 要件3: フロー構造の忠実な再現
**ユーザーストーリー：** 作者として、手書き原案のフローをそのまま再現したい。

#### 受け入れ基準（確定した構造。m=monster攻撃 / g=monster_guard / h=monster_heal）
1. WHEN フローを構築する THEN the system SHALL `START→[1]→m(50)` から始める
2. WHEN 構築する THEN the system SHALL 条件A「[2]は攻撃?」(true→g20 / false→h25)→merge→[2]→m(15) を置く
3. WHEN 構築する THEN the system SHALL 条件B「[3]は回復?」(true→m35 / false→g15)→merge→[3]→m(25) を置く
4. WHEN 構築する THEN the system SHALL **for×3**：条件「[4]は攻撃?」(true→g10 / false→h20)→merge→[4]→m(15) をボディにする
5. WHEN for を抜ける THEN the system SHALL **1回だけ改行（newline）**し、以降を左端から続ける
6. WHEN 構築する THEN the system SHALL 条件C「[5]は攻撃?」(true→g15 / false→m30)→merge→[5]→m(40)→[6]×2→m(20) を置く
7. WHEN 構築する THEN the system SHALL 条件D「[7]は回復?」(true→m15 / false→g20)→merge→[7]→m(40)→[8] を置く
8. WHEN 構築する THEN the system SHALL 条件E「[9]は攻撃?」(true→g10 / false→h10)→merge→[9]×2→m(25)→[10](攻撃のみ)×3→goal を置く

### 要件4: 解答の成立とパズル意図
**ユーザーストーリー：** プレイヤーとして、解答で確実にクリアでき、置き間違い（型を間違える／火力配分を誤る）では敵の嫌な行動でクリアできないようにしたい。

#### 受け入れ基準
1. WHEN 解答どおりに配置して実行する THEN the system SHALL 敵HPを0にし自HP≥1でクリアする
2. IF 型を決めるスロット（[2][3][5][7][9]）に想定外の型を置く THEN the system SHALL 敵の防御/回復/攻撃が不利に働き、クリアできない方向にする（型選定の学習）
3. IF [6] に回復以外を置く THEN the system SHALL 自HP不足でクリアできない（回復必須の学習）
4. IF [4] に攻撃以外、または小さい攻撃を置く THEN the system SHALL 敵ガード/回復で火力不足になりクリアできない

### 要件5: 敵アクションカードの利用と非回帰
#### 受け入れ基準
1. WHEN 敵カードがフロー上に現れる THEN the system SHALL `monster_guard` / `monster_heal`（実装済み）と `monster` を `lockedCard` で表示・作用させる
2. WHEN `5-2` を追加する THEN the system SHALL 他ステージ（1-1〜5-1, 5-3, 5-4）の定義・展開を変更しない
3. WHEN 変更後に build/lint を実行する THEN the system SHALL エラーなく通過する
