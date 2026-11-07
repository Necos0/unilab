# 設計書: 陣取り合戦 演出強化（攻撃エフェクト・本陣キャラ）

## 概要

陣取り合戦の既存アーキテクチャ（**純シム(JS) → rAFループ → 命令的DOM描画**）を踏襲し、2つの演出を足す。鍵は「シムは DOM に触れず**イベントを state のキューに積むだけ**、描画層（`createRenderer`）がそれを読んで既存ユニットと同じ座標系（`x/virtualWidth*100%`）で命令的にエフェクトDOMを自走生成する」こと。React 再描画を増やさない既存思想（多数ユニット対策）に完全に沿う。

- **攻撃エフェクト**：攻撃解決時に `state.hits` へ `{攻撃元, 攻撃先, 種別}` を1件 push。描画層が毎フレーム消費し、遠隔＝飛翔体が元→先へ飛ぶ／近接＝被弾点に斬撃フラッシュ、を自走remove で出す。
- **本陣キャラ**：味方本陣に主人公（hero）、敵本陣に真のドラゴン（dragon_final）を、描画層が**固定位置の idle アニメスプライト**として立たせる（HPバーの柱 `.lbf-base` とは別レイヤー、動かないので移動ロジック不要）。

主要な設計判断：
1. エフェクトの発火は `dealDamage`（攻撃者不明・pierce/splash で多重呼び出し）ではなく、**攻撃アクションの発生点（`stepUnits` の攻撃分岐・`stepBaseDefense`）**で「攻撃者→主対象」を1件だけ push する。1攻撃＝1エフェクトで、範囲攻撃でも画面が氾濫しない。
2. エフェクトと本陣キャラは**描画層（命令的DOM）側**に置き、純シム・React層は触らない。
3. 本陣キャラの idle アニメは、React（HUD 66ms 間引き再描画）ではなく**描画層の実フレーム dt** で回す（ユニットと同じ滑らかさ・同じ思想）。

## アーキテクチャ

### コンポーネント

| コンポーネント | 変更/新規 | 責務 |
|--------------|---------|------|
| `engine/battleState.js` | 変更 | `state.hits: []`（攻撃イベントキュー）を初期状態に追加 |
| `engine/stepSim.js` | 変更 | 攻撃解決時に `state.hits.push(hit)`。発火点＝`stepUnits`（ユニット→ユニット／ユニット→本陣）・`stepBaseDefense`（本陣→ユニット）。DOM非依存は維持 |
| `engine/laneEffect.js` | 新規 | 攻撃エフェクト1個分のDOMを生成し、CSSアニメ終了で自走removeする `createAttackEffect(fxEl, hit)` |
| `engine/baseSprite.js` | 新規 | 本陣キャラ1体分のDOM（idleアニメ・固定位置・向き・大きめ）を生成する `createBaseSprite(fieldEl, opt)` |
| `engine/createRenderer.js` | 変更 | ①`.lbf-fx` エフェクト層を追加し `state.hits` を毎フレーム消費→`createAttackEffect`→キューをクリア。②本陣キャラ2体を生成し `sync` で idle コマ送り。`destroy` で後片付け |
| `engine/heroOrEnemyFramePath`（流用） | 流用 | hero は `features/map/heroSpritePath.js`、`dragon_final` は `features/battle/enemy/enemySpritePath.js` の `getEnemyFramePath` を利用 |
| `lanebattle.css` | 変更 | `.lbf-fx` 層、飛翔体 `.lbf-proj`、斬撃 `.lbf-slash`、本陣キャラ `.lbf-basechar` のスタイル＋keyframes（ピクセルアート調） |

### データモデル

**攻撃イベント（`state.hits` の要素）**
```
hit = {
  fromX: number,   // 攻撃元の仮想x（0..virtualWidth）
  fromLane: number,// 攻撃元のレーン（0/1/2）
  toX: number,     // 攻撃先の仮想x
  toLane: number,  // 攻撃先のレーン
  side: 'you' | 'cpu', // 攻撃した側（色分け・向きに使う）
  ranged: boolean, // 遠隔か（def.ranged＝range>=rangedRange(100)）。true=飛翔体 / false=近接斬撃
};
```
- 本陣が攻撃元/先の場合は、その本陣の `x = field.youBaseX | field.cpuBaseX`、`lane` は対象ユニットのレーン（本陣は全レーン守るため、対象側のレーンを使う）。
- `state.hits` は**毎フレーム描画層が読み切ってクリア**する揮発キュー（HPイベントのような id/dismiss 管理は不要。1回表示したら消えるため）。

**本陣キャラ定義（`createBaseSprite` のオプション）**
```
{ side, baseX, framePath(frameIndex)->url, frames, frameMs, facing: 'right'|'left', scale }
```

### インターフェース（主要シグネチャ）

| 関数 | シグネチャ | 役割 |
|------|-----------|------|
| `pushHit` (stepSim内ヘルパ) | `pushHit(state, u, target)` / `pushHitToBase(state, u, baseSide)` / `pushHitFromBase(state, baseSide, target)` | 攻撃元・先・種別を正規化して `state.hits` に1件積む |
| `createAttackEffect` | `createAttackEffect(fxEl, hit) -> void` | hit から飛翔体 or 斬撃DOMを生成、座標%変換して配置、`animationend` で自走remove |
| `createBaseSprite` | `createBaseSprite(fieldEl, opt) -> { setFrame, remove }` | 本陣キャラDOM生成。idleコマ送りは `setFrame` を描画層が叩く |
| `createRenderer`（拡張） | 既存 `sync(state, dt)` 内で hits 消費＋本陣キャラ idle、`destroy` で両方片付け | 結線点（`MatchView` からは変更不要） |

## データフロー

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 220" font-family="monospace" font-size="12">
  <style>.b{fill:#eef;stroke:#557;rx:5}.s{fill:#dfd;stroke:#484}.r{fill:#fdd;stroke:#a44}.t{fill:#222}.e{stroke:#889;fill:none;marker-end:url(#a)}</style>
  <defs><marker id="a" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#889"/></marker></defs>
  <rect class="s" x="10" y="20" width="150" height="48"/><text class="t" x="85" y="40" text-anchor="middle">stepSim</text><text class="t" x="85" y="56" text-anchor="middle">(攻撃解決)</text>
  <rect class="b" x="10" y="150" width="150" height="40"/><text class="t" x="85" y="175" text-anchor="middle">state.hits[]</text>
  <rect class="b" x="350" y="20" width="160" height="48"/><text class="t" x="430" y="40" text-anchor="middle">createRuntime</text><text class="t" x="430" y="56" text-anchor="middle">rAF: step→onFrame</text>
  <rect class="s" x="350" y="140" width="160" height="60"/><text class="t" x="430" y="165" text-anchor="middle">createRenderer.sync</text><text class="t" x="430" y="181" text-anchor="middle">hits消費+本陣idle</text>
  <rect class="r" x="640" y="130" width="200" height="36"/><text class="t" x="740" y="153" text-anchor="middle">.lbf-fx 飛翔体/斬撃DOM</text>
  <rect class="r" x="640" y="176" width="200" height="34"/><text class="t" x="740" y="197" text-anchor="middle">本陣キャラ(hero/dragon)</text>
  <path class="e" d="M85,68 L85,148"/><text class="t" x="95" y="110">push</text>
  <path class="e" d="M160,170 L348,168"/><text class="t" x="210" y="160">read&clear</text>
  <path class="e" d="M430,68 L430,138"/>
  <path class="e" d="M510,158 L638,150"/><text class="t" x="545" y="140">自走remove</text>
  <path class="e" d="M510,180 L638,192"/>
  <text class="t" x="430" y="214" text-anchor="middle" fill="#a44">※ React層（BattleField/HUD）は不変。エフェクト・本陣キャラは全て命令的DOM</text>
</svg>

## 実装方針

### 1. シムの攻撃イベント（要件1・2・3・4-1・6）
- `createBattleState` に `hits: []` を追加。`stepSim` の各フレーム冒頭ではクリアしない（描画層が消費後にクリアするため）。保険として `createRuntime` のリセット時に空配列化。
- 発火3点（いずれも「攻撃が実際に起きた瞬間」）：
  - `stepUnits` ユニット→ユニット（`resolveAttack` を呼ぶ直前/直後, stepSim.js:95-98）：`pushHit(state, u, target)`。
  - `stepUnits` ユニット→本陣直撃（`state.base[enemyBase].hp -= u.atk`, stepSim.js:106-108）：`pushHitToBase(state, u, enemyBase)`。
  - `stepBaseDefense` 本陣→ユニット（`dealDamage(..., def.atk)`, stepSim.js:228-230）：`pushHitFromBase(state, side, target)`。
- `ranged` は `u.ranged`（無ければ `u.range >= config.cpu.attr.rangedRange`）で判定。pierce/splash（範囲）でも**主対象への1件**のみ push（要件3-4 の範囲表現は着弾を広げる等で任意対応、本スコープでは1件表示を基本とする）。
- 純関数性：push は state 配列への追加のみ。DOM・乱数・時刻に依存しない（イベントは座標と種別の純データ）。

### 2. エフェクト描画（要件1・2・5・6）
- `createRenderer` が初期化時に `.lbf-fx`（`position:absolute; inset:0; pointer-events:none; overflow:hidden`）を `fieldEl` 直下に1枚作る（レーン横断の飛翔体・本陣エフェクトも同一座標系で置けるよう全面）。
- `sync(state, dt)` の末尾で `for (const h of state.hits) createAttackEffect(fxEl, h); state.hits.length = 0;`。
- `createAttackEffect`：
  - 座標変換は既存と同一：`left = x/virtualWidth*100 %`、`top` はレーン帯中央（`createRenderer` の `laneYs` と同式）。
  - **遠隔**：小さな飛翔体 `.lbf-proj`（side 色）を from に置き、CSS 変数 `--dx/--dy`（to-from の%差）を与えて `@keyframes projFly`（translate 0→dx,dy＋フェード, 約180–220ms）で飛ばす。左右の向きは dx 符号で自然に決まる。
  - **近接**：被弾点 to に斬撃 `.lbf-slash`（side 色）を置き、`@keyframes slashPop`（拡大→フェード, 約140ms）。
  - いずれも `el.addEventListener('animationend', () => el.remove())` で自走remove（要件1-4・4-3）。
- 色分け（要件2-2）：`you`＝寒色（例 シアン/青）、`cpu`＝暖色（例 赤/橙）。クラス `.you/.cpu` で切替。
- ピクセルアート調（要件5-1）：小さめ・`image-rendering: pixelated`・ドット的な矩形/星形。連射でも短時間で消えるので氾濫しない（要件5-3）。

### 3. 本陣キャラ（要件7）
- `createRenderer` が初期化時に `createBaseSprite` で2体生成：
  - 味方（`you`）：hero。フレームURL＝`heroSpritePath` の `/sprites/hero/idle/hero_idle_NN.png`、`idleFrames=4`。`baseX=field.youBaseX`、facing=right（敵方向）、scale=大きめ。
  - 敵（`cpu`）：dragon_final。フレームURL＝`getEnemyFramePath('dragon_final','idle',n)`、`idleFrames=3`、`baseX=field.cpuBaseX`、facing=left、scale=大きめ。
- 配置：`.lbf-basechar`（`position:absolute; left: baseX/virtualWidth*100%`、盤面下寄せ、`z-index` は HPバー柱 `.lbf-base` と干渉しない層）。HPバーは引き続き見える（要件7-4）。facing は CSS `transform: scaleX(±1)`。
- idle アニメ：`sync(state, dt)` で各本陣キャラの `animT += dt`、`frameMs` ごとに `setFrame(next)`（ユニットと同じ実フレーム dt 駆動、React非経由。要件7-3）。
- 本陣キャラは移動も撃破もしない（HP0 の最終演出は任意・本スコープ外、要件7-7）。`destroy` で remove（要件4-4）。
- 攻撃エフェクトとの連携（要件3-2/3-3・7-6）：本陣絡みの hit は `fromX/toX` に `youBaseX/cpuBaseX` を使うので、エフェクトは本陣キャラの立ち位置付近から出入りする。

### 4. 結線（MatchView）
- `MatchView.jsx` は `createRenderer(fieldEl)` を使い `onFrame:(s,dt)=>renderer.sync(s,dt)` 済み。**追加配線は不要**（hits 消費も本陣キャラも `sync`/`destroy` 内に閉じる）。リセット時の `state.hits` 空化だけ `createRuntime` のリセット経路で担保。

## 依存関係

| パッケージ/モジュール | 用途 | 導入済み？ |
|----------------------|------|----------|
| （新規パッケージ無し） | 既存の素JS＋DOM＋CSSのみ | — |
| `features/map/heroSpritePath.js` | hero のフレームURL生成 | はい（流用） |
| `features/battle/enemy/enemySpritePath.js` | dragon_final のフレームURL生成 | はい（流用） |

## トレードオフと検討した代替案

- **決定**：エフェクト発火を `dealDamage` ではなく攻撃アクション発生点（`stepUnits`/`stepBaseDefense`）に置く。
  **理由**：`dealDamage` は攻撃者を知らず、pierce/splash で1攻撃中に複数回呼ばれる。発生点なら「攻撃者→主対象」を1件で表現でき、画面が氾濫しない。
  **代替案**：`dealDamage` のシグネチャに攻撃者を足して被弾ごとに push。被弾側全員にエフェクトが出て賑やかになり、要件5-3（控えめ）に反する。却下。

- **決定**：エフェクト・本陣キャラを命令的DOM（描画層）に置く。
  **理由**：既存の「多数ユニットは React 再描画せず命令的DOM」思想に一致。idle/飛翔のアニメを実フレーム dt で滑らかに回せる。
  **代替案**：本編 battle の `DamageFloater` のように React state＋コンポーネントで出す。数字フロート程度なら可だが、毎フレーム多発する攻撃モーションでは React 再描画が増えるため却下（本編の keyframes 自走removeの発想だけ流用）。

- **決定**：ダメージ数字は出さない（モーションのみ）。
  **理由**：多数ユニットで数字が氾濫して騒がしくなる（ユーザー確定）。将来、任意拡張として `state.hits` に `amount` を足せば数字版も同じ仕組みで追加できる（拡張容易性は確保）。

- **決定**：本陣キャラの idle アニメを描画層で回す。
  **理由**：BattleField（React）は HUD 66ms 間引き再描画で、本陣キャラのために毎フレーム再描画したくない。描画層なら dt 駆動で軽い。
  **代替案**：BattleField 内で rAF ＋ `useState` でコマ送り。React 再描画が増え、既存思想に反するため却下。
