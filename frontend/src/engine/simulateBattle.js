/**
 * バトル実行を「数値だけ」でシミュレートする UI 非依存の純関数群。
 *
 * `battleStore.startExecution` が Play 押下時にアニメーションを始める前に呼び出し、
 * フローチャートを最後まで（または周回上限まで）辿って `'win'` / `'lose'` /
 * `'runaway'`（無限ループ）のいずれになるかを即座に判定する。runaway なら
 * アニメせずに即負けにすることで、無限ループのプレイヤー待ち時間をなくす。
 *
 * live 実行（`battleStore`）の効果ロジックを **エフェクト・遅延・演出抜きで** 写した
 * もので、最終的な数値（敵HP / 自HP / シールド / 反射）だけを追う。条件分岐は
 * live と同じ純関数 `evaluateCondition` を共有する。両者は別実装のため、開発時は
 * `battleStore` 側で live 結果と本シミュレーション結果を突き合わせてドリフトを検知する。
 */

import evaluateCondition from './evaluateCondition';

/**
 * 1 ノードのカード効果を数値状態に適用した新しい状態を返す（純関数）。
 *
 * live の `scheduleNodePhase` の効果分岐を写したもの：attack / finisher / heal /
 * guard は `multiplier` を掛け、monster は掛けない（敵攻撃のため）。finisher
 * （ひっさつカード。最終ボス第二形態の専用カード）は attack と同じ「敵に
 * ダメージ」の効果。monster は `reflectActive`
 * なら敵HPへ反射、`guardShield` があれば吸収して残りを自HPへ、無ければ自HPへ。
 * クランプは live と同じ（敵HP・自HP は 0 下限、heal は `maxPlayerHp` 上限）。
 * カードが無いノード（start / goal / merge / condition）は状態を変えずに返す。
 *
 * Args:
 *     state (object): `{enemyHp, playerHp, guardShield, reflectActive, maxPlayerHp, maxEnemyHp}`。
 *     card (object | null | undefined): ノードに割り当てられたカード（`{id, power}`）。
 *     multiplier (number | undefined): 倍率スロットの倍率。未指定は 1。
 *
 * Returns:
 *     object: 効果適用後の新しい状態（入力は破壊しない）。
 */
export function applyNodeEffect(state, card, multiplier) {
  if (!card) return state;
  let { enemyHp, playerHp, guardShield, reflectActive, enemyGuardShield = 0, enemyReflectActive = false } = state;
  const { maxPlayerHp, maxEnemyHp } = state;
  const mult = multiplier ?? 1;
  if ((card.id === 'attack' || card.id === 'finisher') && card.power > 0) {
    // プレイヤーの攻撃解決（敵の reflect / guard を monster の鏡写しで処理）。
    const dmg = card.power * mult;
    if (enemyReflectActive) {
      playerHp = Math.max(0, playerHp - dmg); // 敵が反射 → 自分が受ける
    } else if (enemyGuardShield > 0) {
      const absorbed = Math.min(enemyGuardShield, dmg); // 敵シールドで吸収
      enemyGuardShield -= absorbed;
      enemyHp = Math.max(0, enemyHp - (dmg - absorbed));
    } else {
      enemyHp = Math.max(0, enemyHp - dmg);
    }
  } else if (card.id === 'monster' && card.power > 0) {
    // 敵攻撃。倍率（`{counterRef}` 連動を含む）を尊重する（★＝パワーアップ用）。
    const mdmg = card.power * mult;
    if (reflectActive) {
      enemyHp = Math.max(0, enemyHp - mdmg);
    } else if (guardShield > 0) {
      const absorbed = Math.min(guardShield, mdmg);
      guardShield -= absorbed;
      playerHp = Math.max(0, playerHp - (mdmg - absorbed));
    } else {
      playerHp = Math.max(0, playerHp - mdmg);
    }
  } else if (card.id === 'monster_guard' && card.power > 0) {
    enemyGuardShield = card.power; // 敵シールドをセット（上書き）。guard と reflect は排他
    enemyReflectActive = false;
  } else if (card.id === 'monster_reflect') {
    enemyReflectActive = true;
    enemyGuardShield = 0;
  } else if (card.id === 'monster_heal' && card.power > 0) {
    enemyHp = Math.min(maxEnemyHp, enemyHp + card.power); // 敵回復（倍率なし）
  } else if (card.id === 'heal' && card.power > 0) {
    playerHp = Math.min(maxPlayerHp, playerHp + card.power * mult);
  } else if (card.id === 'guard' && card.power > 0) {
    guardShield = card.power * mult;
    reflectActive = false;
  } else if (card.id === 'reflect') {
    reflectActive = true;
    guardShield = 0;
  }
  return { ...state, enemyHp, playerHp, guardShield, reflectActive, enemyGuardShield, enemyReflectActive };
}

/**
 * エッジ通過時に一時バフ（シールド・反射）を解除した新しい状態を返す（純関数）。
 *
 * live のエッジフェーズと同じく、直前に通過したノードのカードが guard なら
 * シールドを、reflect なら反射を維持し、そうでなければ 0 / false に戻す。これにより
 * 「バフは直後の 1 ノードのみ有効」という live の挙動を再現する。
 *
 * Args:
 *     state (object): 現在の数値状態。
 *     prevCard (object | null | undefined): 直前に通過したノードのカード。
 *
 * Returns:
 *     object: バフ解除後の新しい状態。
 */
export function clearTransientBuffs(state, prevCard, prevNodeType) {
  // merge（合流）・condition（条件分岐）はカードを持たない純粋な構造ノードで
  // 「1 マス」に数えないため，通過してもバフ（シールド・反射）を消費せずそのまま
  // 次へ通す。これにより「各経路の末尾でシールドを張り合流後の攻撃に効かせる」
  // （merge）や「カウンターを張った直後に分岐があり，分岐先の敵攻撃を反射する」
  // （condition）といった構成が成立する。
  if (prevNodeType === 'merge' || prevNodeType === 'condition') {
    return state;
  }
  const isPrevGuard = prevCard?.id === 'guard';
  const isPrevReflect = prevCard?.id === 'reflect';
  const isPrevEnemyGuard = prevCard?.id === 'monster_guard';
  const isPrevEnemyReflect = prevCard?.id === 'monster_reflect';
  return {
    ...state,
    guardShield: isPrevGuard ? state.guardShield : 0,
    reflectActive: isPrevReflect ? state.reflectActive : false,
    enemyGuardShield: isPrevEnemyGuard ? (state.enemyGuardShield ?? 0) : 0,
    enemyReflectActive: isPrevEnemyReflect ? (state.enemyReflectActive ?? false) : false,
  };
}

/**
 * `evaluateCondition` に渡す評価コンテキストを数値状態から組み立てる。
 *
 * live の `startExecution` 内 `buildEvalContext` と同じ形（`variables` に HP 等、
 * `slot(slotId)` で配置カードの id）を返し、条件式の評価結果が live と一致するように
 * する。
 *
 * Args:
 *     state (object): 現在の数値状態。
 *     slotAssignments (object): スロット id → カード（または null）のマップ。
 *
 * Returns:
 *     object: `{variables, slot}` 形式の評価コンテキスト。
 */
function buildEvalContext(state, slotAssignments, forLoopCounters) {
  return {
    variables: {
      playerHp: state.playerHp,
      enemyHp: state.enemyHp,
      maxPlayerHp: state.maxPlayerHp,
      maxEnemyHp: state.maxEnemyHp,
      guardShield: state.guardShield,
      reflectActive: state.reflectActive,
      enemyGuardShield: state.enemyGuardShield ?? 0,
      enemyReflectActive: state.enemyReflectActive ?? false,
    },
    slot: (slotId) => slotAssignments[slotId]?.id ?? null,
    forCounter: (forLoopId) => forLoopCounters?.[forLoopId] ?? 0,
  };
}

/**
 * 現在ノードから次に進むエッジを選ぶ（純関数）。
 *
 * 条件ノードでは `evaluateCondition` の結果で `sourceHandle: 'true' | 'false'` の
 * エッジを選び、それ以外のノードでは最初の outgoing エッジを返す。live の
 * `selectNextEdge` と同じロジック。
 *
 * Args:
 *     nodeId (string): 現在のノード id。
 *     edgesBySource (object): source ノード id → エッジ配列のマップ。
 *     nodeMap (object): ノード id → `{type, expression?}` のマップ。
 *     state (object): 現在の数値状態（条件評価に使う）。
 *     slotAssignments (object): スロット id → カードのマップ（条件の `slot()` 用）。
 *
 * Returns:
 *     object | undefined: 次のエッジ。行き止まりなら undefined。
 */
function selectNextEdge(nodeId, edgesBySource, nodeMap, state, slotAssignments, forLoopCounters) {
  const edges = edgesBySource[nodeId] ?? [];
  const node = nodeMap[nodeId];
  if (node?.type === 'condition') {
    const result = evaluateCondition(node.expression, buildEvalContext(state, slotAssignments, forLoopCounters));
    const target = result ? 'true' : 'false';
    return edges.find((e) => e.sourceHandle === target);
  }
  if (node?.type === 'for-end') {
    const remaining = forLoopCounters?.[node.forLoopId] ?? 0;
    const target = remaining > 0 ? 'loop-back' : 'exit';
    return edges.find((e) => e.sourceHandle === target);
  }
  return edges[0];
}

/**
 * `'start'` から動的にエッジを辿り、バトルの結末を数値だけで判定する（純関数）。
 *
 * 各ノードでカード効果を適用し、自HP が 0 以下なら `'lose'`、`'goal'` 到達 / 行き
 * 止まりでは敵HP 0 以下かつ自HP>0 なら `'win'` それ以外 `'lose'` を返す。いずれかの
 * ノードの訪問回数が `maxVisits` を超えたら、終了しない無限ループとみなして
 * `'runaway'` を返す。`evaluateCondition` を到達のつど最新の数値状態で評価するため、
 * 条件分岐やループ（閉路）も live と同じ経路で辿れる。アニメ遅延・演出は持たないので
 * 一瞬で完了する。
 *
 * **カウンタ管理**（`loop-counter` 仕様）：`initialState.counterValues` をローカル
 * コピー（`{ ...(initialState.counterValues ?? {}) }`）して内部で持ち、ノード走査中に
 * 不変更新で書き換える。元の `initialState` および呼び出し元の zustand store は
 * 一切汚染しないため、本関数は純関数性を保つ（要件 10 の sim/live 整合の前提）。
 * 各ノードでは効果適用の **前** に counter 処理を行う：`card.id === 'counter'` かつ
 * `counterId` を持ち、かつローカル `counterValues` に登録済みの場合のみ +1 する
 * （三重ガードで未登録 ID・縮退済み counter を防御）。これにより live 側の
 * `scheduleNodePhase` の counter 分岐と完全に同じタイミング・条件で値が変化する。
 *
 * **倍率の三分岐解決**（`multiplier-slot` / `loop-counter` 仕様）：
 *   1. `typeof meta?.multiplier === 'number'` → リテラル倍率
 *   2. `typeof meta?.counterRef === 'string'` → ローカル `counterValues[counterRef] ?? 0`
 *      で動的解決（未到達カウンタは 0 倍）
 *   3. それ以外 → 1 倍
 * live 側（`battleStore.scheduleNodePhase`）と **同じ判定式** を共有することで、
 * `scheduleComplete` の dev 整合チェック（`liveOutcome !== simOutcome` の warn）が
 * 効果ルールのドリフトを早期検出できる。
 *
 * Args:
 *     params (object):
 *         edgesBySource (object): source ノード id → エッジ配列。
 *         nodeMap (object): ノード id → `{type, expression?}`。
 *         slotAssignments (object): スロット id → カード（または null）。counter スロット
 *             のカードは `{id: 'counter', counterId, locked: true}` の形を持つ。
 *         slotMetadata (object): スロット id → `{multiplier?: number, counterRef?: string,
 *             acceptOnly?}`。`multiplier` と `counterRef` は排他キー。
 *         initialState (object): 開始時の数値状態（満タンHP・シールド0・反射false）。
 *             `counterValues: { [counterId]: 0 }` を任意で含む（未指定なら空オブジェクト
 *             として扱う）。`forLoopCounters: { [forLoopId]: iterations }` も任意で含む
 *             （未指定なら空オブジェクトとして扱う）。
 *         maxVisits (number): 1 ノードあたりの訪問回数上限（超過で runaway）。
 *
 * Returns:
 *     string: `'win'` / `'lose'` / `'runaway'`。
 */
export function simulateBattle({ edgesBySource, nodeMap, slotAssignments, slotMetadata, initialState, maxVisits }) {
  let state = initialState;
  let counterValues = { ...(initialState.counterValues ?? {}) };
  let forLoopCounters = { ...(initialState.forLoopCounters ?? {}) };
  const visits = {};
  let nodeId = 'start';
  while (true) {
    visits[nodeId] = (visits[nodeId] ?? 0) + 1;
    if (visits[nodeId] > maxVisits) {
      return 'runaway';
    }
    const card = slotAssignments[nodeId];
    if ((card?.id === 'counter' || card?.id === 'monster_counter') && card.counterId && counterValues[card.counterId] !== undefined) {
      counterValues = { ...counterValues, [card.counterId]: counterValues[card.counterId] + 1 };
    }
    const meta = slotMetadata[nodeId];
    const multiplier =
      typeof meta?.multiplier === 'number' ? meta.multiplier :
      typeof meta?.counterRef === 'string' ? (counterValues[meta.counterRef] ?? 0) + (meta.offset ?? 0) : 1;
    state = applyNodeEffect(state, card, multiplier);
    if (nodeMap[nodeId]?.type === 'for-end') {
      const forLoopId = nodeMap[nodeId].forLoopId;
      if (forLoopCounters[forLoopId] !== undefined) {
        forLoopCounters = {
          ...forLoopCounters,
          [forLoopId]: Math.max(0, forLoopCounters[forLoopId] - 1),
        };
      }
    }
    // for-start 入場時のカウンタ再初期化（live 実行と同じセマンティクス）。
    // 外側ループから再入場された場合に前回 exit で 0 になっていた counter を
    // iterations に戻し、次のイテレーション群が正しく iterations 回まわるよう
    // にする。ループバック入場では counter が 1..N-1 の途中値なのでリセットは
    // 起きない（無限ループ防止）。
    if (nodeMap[nodeId]?.type === 'for-start') {
      const iterations = nodeMap[nodeId].iterations;
      const current = forLoopCounters[nodeId] ?? 0;
      if (current <= 0 && typeof iterations === 'number') {
        forLoopCounters = {
          ...forLoopCounters,
          [nodeId]: iterations,
        };
      }
    }
    if (state.playerHp <= 0) {
      return 'lose';
    }
    if (nodeId === 'goal') {
      return state.enemyHp <= 0 && state.playerHp > 0 ? 'win' : 'lose';
    }
    const nextEdge = selectNextEdge(nodeId, edgesBySource, nodeMap, state, slotAssignments, forLoopCounters);
    if (!nextEdge) {
      return state.enemyHp <= 0 && state.playerHp > 0 ? 'win' : 'lose';
    }
    state = clearTransientBuffs(state, card, nodeMap[nodeId]?.type);
    nodeId = nextEdge.target;
  }
}