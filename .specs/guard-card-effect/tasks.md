# タスク一覧: 防御カード効果（guard-card-effect）

## 概要

実装は (1) `battleStore` の状態・アクション拡張 → (2) `startExecution` のフェーズ処理拡張 → (3) `HpBar` の `shield` プロパティ対応 → (4) `BattleScreen` の数値表示・フラッシュ演出統合、の 4 ステージで進める。クリティカルパスはタスク 1〜4 のストア層変更で、ここが完了すれば後続の UI 系タスク（5〜8）は並列に検証可能。HpBar の拡張（タスク 5）はストアの状態と独立しているため、開発を並行できる。

合計タスク数：8 件 ｜ 想定工数：約 2.5〜3 時間

## タスク

- [x] **1. `battleStore` に `guardShield` フィールドを追加し、4 箇所で初期化する**  ✓ 完了
  - 内容：`useBattleStore` の初期状態に `guardShield: 0` を追加する。さらに `initializeBattle`、`retryFromFail`、`startExecution.beginSequence` の各 `set` ブロック、および `applyPlayerDamage` の死亡検知ブロック（`nextHp === 0 && state.isExecuting` の分岐）に `guardShield: 0` のクリアを追加する。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：なし
  - 完了条件：React DevTools で `useBattleStore` の状態に `guardShield` フィールドが存在し、ステージ進入時・リセットボタン押下時・実行開始時・Fail 遷移時の各タイミングで `0` になることを確認できる。
  - 対応要件：要件 4-1, 4-2, 4-3, 4-4

- [x] **2. `battleStore` に 3 つの新規アクション（`applyGuard` / `consumeShieldOnDamage` / `clearGuard`）を追加する**  ✓ 完了
  - 内容：以下の 3 アクションを `useBattleStore` 内に追加する。
    - `applyGuard(amount)`：`set({ guardShield: amount })` で上書き（累積しない）。
    - `consumeShieldOnDamage(amount)`：`guardShield` が 0 のとき `applyPlayerDamage(amount)` を呼ぶだけ。シールドが正のとき `absorbed = Math.min(shield, amount)`、`remaining = amount - absorbed` を計算、`set({ guardShield: shield - absorbed })` で減算、`remaining > 0` なら `applyPlayerDamage(remaining)` を呼ぶ。
    - `clearGuard()`：`set({ guardShield: 0 })`。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク 1
  - 完了条件：DevTools コンソールから `useBattleStore.getState().applyGuard(30)` を呼ぶと `guardShield === 30` になり、続けて `useBattleStore.getState().consumeShieldOnDamage(20)` を呼ぶと `guardShield === 10` になり HP は変化しない。`consumeShieldOnDamage(50)` を呼ぶと `guardShield === 0`、HP が 20 減ることを確認できる。`clearGuard()` で `guardShield === 0` に戻る。
  - 対応要件：要件 1-1, 2-1, 2-2, 2-3, 2-4, 5-1

- [x] **3. `startExecution` のノードフェーズに `guard` / `monster` 分岐を組み込む**  ✓ 完了
  - 内容：`startExecution` 内の `phases.forEach` の `setTimeout` コールバック内、既存のノード判定ブロック（`if (phase.type === 'node')`）で以下の 2 箇所を変更する。
    1. 既存の `if (card && card.id === 'monster' && card.power > 0) { applyPlayerDamage(card.power); }` を `consumeShieldOnDamage(card.power)` 呼び出しに差し替える。
    2. 新規に `if (card && card.id === 'guard' && card.power > 0) { applyGuard(card.power); }` を追加する。`attack` / `heal` 分岐は変更しない。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク 2
  - 完了条件：ステージ 1-2 で防御カード（`guard 10`）を slot-5 に配置し、その後の monster（`power: 20`）を通過したときに、プレイヤー HP の減少が `20 - 10 = 10` になることを確認できる。slot に攻撃カードや回復カードを置いた場合は従来通り敵 HP 減少／自 HP 回復が発火することを確認できる。
  - 対応要件：要件 1-1, 1-2, 2-1, 7-1, 7-2

- [x] **4. `startExecution` のエッジフェーズに「直前ノード判定 → シールドクリア」を追加する**  ✓ 完了
  - 内容：`startExecution` 内の `phases.forEach` の `setTimeout` コールバック内、`executionStep` セット後のロジックに以下を追加する。
    ```js
    if (phase.type === 'edge') {
      const prevPhase = phases[i - 1];
      if (prevPhase && prevPhase.type === 'node') {
        const prevCard = get().slotAssignments[prevPhase.id];
        const isPrevGuard = prevCard && prevCard.id === 'guard';
        if (!isPrevGuard && get().guardShield > 0) {
          get().clearGuard();
        }
      }
    }
    ```
    既存の通過軌跡蓄積（`traversedEdgeIds`）は触らない。
  - ファイル：`frontend/src/stores/battleStore.js`
  - 依存：タスク 3
  - 完了条件：(a) 防御カードの直後のエッジでは `guardShield` が維持される。(b) その次のノードがモンスターなら `consumeShieldOnDamage` で消費、空きスロットや別カードなら何も起きない。(c) その次のエッジで `guardShield === 0` になる。(d) シールドが残ったまま実行終了することがない。
  - 対応要件：要件 3-1, 3-2

- [x] **5. `HpBar` コンポーネントに `shield` プロパティと内部 fill 構造を追加する**  ✓ 完了
  - 内容：`HpBar.jsx` のシグネチャを `function HpBar({ currentHp, maxHp, shield = 0 })` に変更し、以下を実装する。
    1. `total = maxHp + Math.max(0, shield)` を計算、`hpRatio = clampedHp / total`、`shieldRatio = Math.max(0, shield) / total`、`scale = total / maxHp` を算出。
    2. `<div className={styles.frame} style={{ '--shield-scale': scale }}>` に変更し、内部に `<div className={styles.fill} style={{ width: `${hpRatio * 100}%` }} />` と、`shield > 0` のとき `<div className={styles.shield} style={{ width: `${shieldRatio * 100}%` }} />` を併記する。
    3. `HpBar.module.css` で `.frame` の `width` を `calc(180px * var(--shield-scale, 1))` に変更し、`position: relative` を追加。`.fill` を `position: absolute; left: 0` に変更。`.shield` クラスを新規追加（`position: absolute; right: 0; top: 0; height: 100%; background: #4a8ef0; box-shadow: 0 0 6px rgba(120, 180, 255, 0.7); transition: width 0.25s ease-out;`）。
    4. `.frame` に `transition: width 0.25s ease-out` を追加して、シールド付与・消滅時に幅変化が滑らかになるようにする。
  - ファイル：`frontend/src/components/HpBar.jsx`、`frontend/src/components/HpBar.module.css`
  - 依存：なし（タスク 1〜4 と並列可能）
  - 完了条件：React DevTools の Props 編集で HpBar の `shield` を 30 にすると、box 幅が `1.3` 倍になり右端に青い領域が表示される。`shield` を 0 に戻すと幅が元に戻る。敵側の HpBar（`shield` を渡していない呼び出し）は従来挙動を維持する。
  - 対応要件：要件 1-3, 3-3, 6-1, 6-2, 6-3, 6-4

- [x] **6. `BattleScreen` のプレイヤー HP 数値表示を「分子 / 分母」の 2 分割描画に変更する**  ✓ 完了
  - 内容：`BattleScreen.jsx` でプレイヤー HP 数値表示（318-320 行目あたり）を以下に変更する。
    ```jsx
    const guardShield = useBattleStore((s) => s.guardShield);
    // ...
    <span className={styles.hpText}>
      <span
        className={guardShield > 0 ? styles.hpNumeratorShielded : undefined}
      >
        {currentPlayerHp + guardShield}
      </span>
      /{maxPlayerHp}
    </span>
    ```
    `BattleScreen.module.css` に以下を追加する。
    ```css
    .hpNumeratorShielded {
      color: #6aaaff;
      text-shadow: 0 0 4px rgba(120, 180, 255, 0.6);
      transition: color 0.25s ease-out;
    }
    ```
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`、`frontend/src/features/battle/BattleScreen.module.css`
  - 依存：タスク 2
  - 完了条件：(a) `guardShield === 0` のときは従来通り `100/100` の白色表示。(b) `guardShield > 0` のときは `130/100` のような表示になり、`130` の部分のみが青色（`#6aaaff`）で表示される。`/100` 部分は通常色。(c) シールドが消えた瞬間に分子色が `transition: color` で通常色に戻る。
  - 対応要件：要件 1-4, 1-5, 1-6

- [x] **7. `BattleScreen` の `HpBar` 呼び出しに `shield` プロパティを渡す**  ✓ 完了
  - 内容：プレイヤー側の `<HpBar currentHp={currentPlayerHp} maxHp={maxPlayerHp} />` を `<HpBar currentHp={currentPlayerHp} maxHp={maxPlayerHp} shield={guardShield} />` に変更する。敵側の HpBar は変更しない（敵にシールドの概念はない）。タスク 6 で既に購読している `guardShield` 変数をそのまま渡す。
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`
  - 依存：タスク 5、タスク 6
  - 完了条件：シールド付与時にプレイヤー側の HP バーが右側に青く拡張表示される。敵側の HP バーは従来通り表示される。
  - 対応要件：要件 1-3, 6-1, 6-2, 6-3, 6-4

- [x] **8. `BattleScreen` のプレイヤー HP バーラッパーに青フラッシュ演出を追加する**  ✓ 完了
  - 内容：以下を `BattleScreen.jsx` および `BattleScreen.module.css` に追加する。
    1. `BattleScreen.jsx` で `useRef` を import 済みでなければ追加し、以下を実装：
       ```jsx
       const [isShielded, setIsShielded] = useState(false);
       const prevGuardShieldRef = useRef(0);
       useEffect(() => {
         if (guardShield > prevGuardShieldRef.current && guardShield > 0) {
           setIsShielded(true);
           const timer = setTimeout(() => setIsShielded(false), 500);
           prevGuardShieldRef.current = guardShield;
           return () => clearTimeout(timer);
         }
         prevGuardShieldRef.current = guardShield;
         return undefined;
       }, [guardShield]);
       ```
    2. `playerHpBox` の className 配列に `isShielded && styles.shielded` を追加する。
    3. `BattleScreen.module.css` に以下を追加：
       ```css
       .playerHpBox.shielded {
         animation: hpBoxShielded 500ms ease-out;
       }
       @keyframes hpBoxShielded {
         0%   { box-shadow: 0 0 0 0 rgba(120, 180, 255, 0); }
         30%  { box-shadow: 0 0 12px 4px rgba(120, 180, 255, 0.8); }
         100% { box-shadow: 0 0 0 0 rgba(120, 180, 255, 0); }
       }
       ```
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`、`frontend/src/features/battle/BattleScreen.module.css`
  - 依存：タスク 2
  - 完了条件：(a) 防御カード通過時に `playerHpBox` が約 500ms 青く発光する。(b) シールド消費（減少）時には発火しない。(c) シールドクリア（0 へ）時にも発火しない。(d) 連続防御カード（要件 5）で値が増加した場合は再度フラッシュする。
  - 対応要件：要件 6-5

## トレーサビリティ確認

| 要件 | 対応タスク |
|---|---|
| 1-1（applyGuard で power をセット） | タスク 2、タスク 3 |
| 1-2（power <= 0 で付与しない） | タスク 3（`card.power > 0` ガード） |
| 1-3（青い拡張領域表示） | タスク 5、タスク 7 |
| 1-4（数値表示 `(hp + shield) / max`） | タスク 6 |
| 1-5（分子のみ青色） | タスク 6 |
| 1-6（シールド消滅時に色を戻す） | タスク 6（CSS transition + 条件クラス） |
| 2-1（ダメージ = `Math.max(0, power - shield)`） | タスク 2、タスク 3 |
| 2-2（シールド減算、残量表示） | タスク 2、タスク 5 |
| 2-3（damage 0 で被弾演出なし） | タスク 2（`remaining > 0` ガード） |
| 2-4（damage > 0 で applyPlayerDamage 発火） | タスク 2 |
| 3-1（次のエッジで shield クリア） | タスク 4 |
| 3-2（モンスター以外なら失効） | タスク 4 |
| 3-3（HP バー元に戻る） | タスク 5（CSS transition） |
| 4-1〜4-4（初期化・リセット時のクリア） | タスク 1 |
| 5-1（連続防御で上書き） | タスク 2（`set({ guardShield: amount })` で上書き） |
| 6-1〜6-4（青い拡張領域の表示仕様） | タスク 5 |
| 6-5（青フラッシュ演出） | タスク 8 |
| 7-1（attack カードの挙動維持） | タスク 3（`attack` 分岐は変更なし） |
| 7-2（heal カードの挙動維持） | タスク 3（`heal` 分岐は変更なし） |
| 7-3（次が空きスロットの場合の挙動） | タスク 4（`monster` 以外のときも clearGuard） |
| 7-4（勝利判定への非影響） | タスク 1（`guardShield` は HP 判定に使わない） |
| 7-5（Fail 中断機構の維持） | タスク 1（中断ブロックに `guardShield: 0` のみ追加） |
