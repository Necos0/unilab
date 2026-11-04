# 要件定義: ステージ 5-3（カウンター・パワーアップ）

## はじめに

ワールド5の3番目。テーマは **カウンター（反射）と「パワーアップ」**。敵カウンター（`monster_reflect`、本ステージが実質メイン活躍）に加え、**ループ回数で威力が増える敵攻撃★を、プレイヤーの [5]=カウンターで反射して大ダメージを返す**のが核。原案は手書き `5-3.png`＋作者解説を source of truth とする。

★（パワーアップ）実装には **`monster`（敵攻撃）に倍率（`multiplier`、ループカウンタ連動 `{counterRef}`）を効かせるエンジン拡張**が必要（現状 `monster` は倍率無視のため）。これを本ステージで追加する（4-3 の loop-counter 機構を `monster` にも適用）。

### 定数・手札・解答（確定）
- 自HP=100 / 敵HP=**345**
- 手札（12枚）：攻35・30・20・15・10 ／ 防40・20・10・5 ／ 回30 ／ カウンター（reflect）×2
- 解答：[1]防20・[2]攻15・[3]防5・[4]回30・[5]reflect・[6]攻10・[7]防10・[8]攻30・[9]攻20・[10]攻35、ダミー=防40・reflect
- 倍率：[6]×3・[8]×2・[10]×4、★=×(ループ回数+1)。指定：防御=[1][3]／攻撃=[6][9][10]。改行は [6] と [7] の間に1つ。

## 要件

### 要件1: 新カード `monster_counter`（倍率を尊重する敵攻撃＝★の土台・再利用可）
**ユーザーストーリー：** ステージ作者として、ループ回数で増える敵攻撃（パワーアップ）を作りたい。なぜなら「強くなった大技をカウンターで返す」読み合いを表現したいから。

#### 受け入れ基準
1. WHEN `monster_counter`（power N）のノードを倍率 k（スロットの `multiplier` / `{counterRef}` 連動）付きで通過する THEN the system SHALL `monster` と同じ解決（反射→敵へ / シールド吸収 / 無しならプレイヤーへ）を、ただし **ダメージ `N×k`** で行う
2. WHEN sim（`applyNodeEffect`）と live（`battleStore`）の両方 THEN the system SHALL 同一に `monster_counter` を `N×k` で適用する
3. WHEN 既存 `monster`（倍率無視）THEN the system SHALL 変更しない（`monster_counter` は別カード id なので完全非破壊）
4. WHEN `card_help.json` THEN the system SHALL `monster_counter` の説明（ふりがな付き）を追加する。画像は `public/cards/monster_counter.png`（命名規則どおり id 一致）

### 要件2: ステージ対戦パラメータ
#### 受け入れ基準
1. WHEN `5-3` を開始する THEN the system SHALL 敵HP=345・自HP=100・手札12枚で初期化する
2. WHEN 読み込む THEN the system SHALL 10スロット（明示id）・[6]×3・[8]×2・[10]×4・指定マス（防御[1][3]/攻撃[6][9][10]）・3周は不要（ループは自HP条件で可変）を用意する

### 要件3: フロー構造の忠実な再現
（m=monster攻撃 / r=monster_reflect / cUp=カウンタ加算 / ★=monster×cUp連動）
#### 受け入れ基準
1. WHEN 構築する THEN the system SHALL `START→[1](防指定)→m(45)→r→[2]→m(40)` から始める
2. WHEN 構築する THEN the system SHALL **while ループ「自HP≥70で脱出」**：ボディ `cUp(カウンタ+1)→[3](防指定)→m(20)→[4]` を置く
3. WHEN ループを抜ける THEN the system SHALL `[5]→★(=m(25)×cUp)` を置く（[5]=reflect で★を敵へ反射）
4. WHEN 構築する THEN the system SHALL 条件「自HP≤20?」(true→merge / false→r→merge)→[6](攻指定)×3→ **改行** →[7] を置く（改行は [6] と [7] の間に1つ）
5. WHEN 構築する THEN the system SHALL `[7]→m(15)→[8]×2→m(15)→[9](攻指定)→m(5)` を置く
6. WHEN 構築する THEN the system SHALL 条件「自HP≤25?」(true→merge / false→r→merge)→[10]×4→goal を置く

### 要件4: 解答の成立とパズル意図
#### 受け入れ基準
1. WHEN 解答どおり配置して実行する THEN the system SHALL 敵HPを0にし自HP≥1でクリアする（攻撃220＋★反射125＝ちょうど345）
2. IF [4] に回30以外 THEN the system SHALL ループを抜けられず（自HP≥70 に届かず）クリアできない
3. IF [3] に防5以外 THEN the system SHALL 周回数がズレ、★の威力が125にならずクリアできない
4. IF [5] に reflect 以外 THEN the system SHALL ★(125)を受けて敗北する
5. IF [2] に攻撃以外 THEN the system SHALL ループ突入HPがズレてクリアできない（[2]は敵カウンター直後で自分に跳ね返る前提）

### 要件5: 敵カード利用・非回帰
#### 受け入れ基準
1. WHEN 敵カードが現れる THEN the system SHALL `monster_reflect`（実装済み）と倍率付き `monster`（本要件1）を作用させる
2. WHEN `5-3` を追加する THEN the system SHALL 他ステージ（1-1〜5-2, 5-4）の定義・展開・結末を変更しない
3. WHEN build/lint を実行する THEN the system SHALL エラーなく通過する
