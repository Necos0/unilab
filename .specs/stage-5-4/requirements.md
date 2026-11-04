# 要件定義: ステージ 5-4（最終ボス・集大成）

## はじめに

本編ワールド5の最終ステージ（ラスボス `dark_hero`）。これまでの全要素（条件分岐・while/for ループ・倍率・種類指定・敵カード効果・プレイヤー/敵の両カウンタ）を一枚に凝縮した「集大成」。核は **「while ループで味方カウンタ `cP` と敵カウンタ `cE` を同時に育て、敵の大技をカウンター（reflect）で反射して返し、最後に ★[10] の特大一撃で削り切る」**。普通に殴ると火力が全く足りず、倍率で何倍にもする以外に勝ち筋がない設計。原案は手書き `5-4.png` ＋作者解説＋構成を source of truth とする。

`×(1+count)`（＝カウンタ値 + 1）の倍率を、ループ前の種まきノードを足さずに手書き構成どおり実装するため、**`multiplier: {counterRef, offset}` の `offset` を新設**する（offset 省略時は 0 ＝従来どおり）。

### 定数・手札・解答（確定）
- 自HP=100 / 敵HP=**415**
- 手札（15枚）：攻40・30・20・20・20・5 ／ 防35・35・30・20 ／ 回40・35・20 ／ カウンター（reflect）×2
- 解答：[1]攻20・[2]防20・[3]攻30・[4]回35・[5]reflect・[6]攻5・[7]回40・[8]reflect・[9]攻20・[10]攻40
- ダミー：攻20・防35・防35・防30・回20
- 倍率：[6]×2・[9]×2・★[10]×(1+cP)、ループ内/ループ後の敵攻撃は ×(1+cE)。指定：攻撃=[6][10]。改行は [5] の敵攻撃の後に1つ。

## 要件

### 要件1: 倍率オフセット `offset`（`×(カウンタ値 + N)` の表現）
**ユーザーストーリー：** ステージ作者として、ループ回数に 1 を足した倍率（`×(1+count)`）を、ループ前に種まきノードを置かずに表現したい。なぜなら手書きの構成を忠実に再現でき、味方・敵それぞれのカウンタをそのまま使えるから。

#### 受け入れ基準
1. WHEN `multiplier` が `{counterRef, offset}` 形式（offset は非負整数）THEN the system SHALL 倍率を `counterValues[counterRef] + offset` で解決する
2. IF `offset` を省略した `{counterRef}` THEN the system SHALL 従来どおり `counterValues[counterRef]`（＝ offset 0）として解決する（完全後方互換）
3. IF `offset` が非負整数でない THEN the system SHALL その `multiplier` を無効として破棄する（`isValidMultiplier`）
4. WHEN sim（`applyNodeEffect` 経路）と live（`scheduleNodePhase`）THEN the system SHALL 同一式 `counterValues[ref] + (offset ?? 0)` で倍率を解決する

### 要件2: プレイヤーカウンタと敵カウンタの併存
**ユーザーストーリー：** ステージ作者として、同じループ内で味方の力（★用）と敵の力（敵攻撃用）を別々に育てたい。なぜなら「自分も敵も強くなる」緊張感を出し、両者を取り違えずに演出したいから。

#### 受け入れ基準
1. WHEN while ループ本体を通過する THEN the system SHALL 味方カウンタ `cP`（`counter` カード）と敵カウンタ `cE`（`monster_counter` カード）をそれぞれ +1 する
2. WHEN ★[10]（攻撃指定）を解決する THEN the system SHALL 倍率を `cP + 1` で計算する（味方カウンタ連動）
3. WHEN 倍率付き敵攻撃（ループ内 m(5)・[5]後 m(15)・[6]後 m(10)・for 内 m(5)・[8]後 m(10)・[9]false m(20)・[9]後 m(10)）を解決する THEN the system SHALL 倍率を `cE + 1` で計算する（敵カウンタ連動）
4. WHEN ヘルプのマス種別を収集する THEN the system SHALL 味方 `counter` と敵 `monster_counter` の両方を `slotTypeIds` に含める（両方のパワーアップマスが解禁される）

### 要件3: ステージ対戦パラメータ
#### 受け入れ基準
1. WHEN `5-4` を開始する THEN the system SHALL 敵HP=415・自HP=100・手札15枚で初期化する
2. WHEN 読み込む THEN the system SHALL 10 スロット（明示 id p1〜p10）・指定マス（攻撃[6][10]）・倍率（[6]×2・[9]×2・★[10] counterRef cP・敵攻撃 counterRef cE）を用意する

### 要件4: フロー構造の忠実な再現
（m=敵攻撃 / r=monster_reflect / g=monster_guard / h=monster_heal / cP=味方カウンタ加算 / cE=敵カウンタ加算 / ★=攻撃×(1+cP)）
#### 受け入れ基準
1. WHEN 構築する THEN the system SHALL `START→「[1]が攻撃?」(true→g(15) / false→m(45))→[1]→m(35)→「[2]が回復?」(true→h(10) / false→m(45))→r→[2]→m(25)` を置く
2. WHEN 構築する THEN the system SHALL **while「自HP≥80で脱出」**：ボディ `cP→cE→[3]→m(5)×(1+cE)→[4]→h(5)` を置く
3. WHEN ループを抜ける THEN the system SHALL `[5]→m(15)×(1+cE)→改行→「自HP≤10?」(true→merge / false→r→merge)→[6](攻指定×2)→m(10)×(1+cE)` を置く
4. WHEN 構築する THEN the system SHALL **for(2回)**：ボディ `「[7]が攻撃?」(true→g(10) / false→h(20))→[7]→m(5)×(1+cE)` を置く
5. WHEN 構築する THEN the system SHALL `[8]→m(10)×(1+cE)→「[9]が攻撃?」(true→g(15) / false→m(20)×(1+cE))→[9]×2→m(10)×(1+cE)→★[10](攻指定×(1+cP))→goal` を置く

### 要件5: 解答の成立とパズル意図
#### 受け入れ基準
1. WHEN 解答どおり配置して実行する THEN the system SHALL 敵HPをちょうど 0 にし自HP≥1 でクリアする（検算：5+120−20+75+50+25+200−40＝415）
2. IF [4] に回35 以外 THEN the system SHALL ループ周回数がズレ（4周に乗らず）クリアできない
3. IF [2] に回復 THEN the system SHALL `m(45)` が来ずループに高HPで入り、周回不足でクリアできない
4. IF [3] に攻40・★[10] に攻30（倍率の大きい枠へ大攻撃を置く取り違え）THEN the system SHALL 火力が 10 足りずクリアできない
5. IF [5]/[8] に reflect 以外 THEN the system SHALL 敵の大技を返せずクリアできない
6. IF [7] に攻撃・防御（回40 以外）THEN the system SHALL for ループ中の被弾に耐えられず敗北する
7. IF [1]/[9] に攻撃以外 THEN the system SHALL 防げない `m(45)`／倍率付き `m(20)` が先に飛び敗北する

### 要件6: 非回帰・ビルド
#### 受け入れ基準
1. WHEN `offset` を追加する THEN the system SHALL 既存の `{counterRef}`（offset 無し）ステージ（4-3 等）の挙動を変えない（offset 既定 0）
2. WHEN `5-4` を追加する THEN the system SHALL 他ステージ（1-1〜5-3）の定義・展開・結末を変更しない
3. WHEN build/lint を実行する THEN the system SHALL エラーなく通過する
