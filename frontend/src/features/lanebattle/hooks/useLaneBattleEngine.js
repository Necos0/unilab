import { useEffect, useRef, useState } from 'react';
import { createLaneBattleEngine } from '../engine/createLaneBattleEngine';

/**
 * `createLaneBattleEngine` を React コンポーネントの寿命に橋渡しするフック。
 *
 * レーン DOM の ref を受け取り、マウント時にエンジンを生成して開始、
 * アンマウント時に確実に破棄する（rAF ループとエフェクトの解放）。エンジン
 * からの HUD 通知（間引き済み）を React state に反映し、UI が購読できる
 * ようにする。決着時は `onEnd` を呼ぶ。デッキは対戦ごとに固定なので、
 * 再戦は BattleView 側の再マウント（key 変更）で `start` をやり直す設計。
 *
 * Args:
 *     opts (object):
 *         deckIds (string[]): プレイヤーの6枚デッキ。
 *         onEnd (function): 決着時に `{ win, score, kills }` を受け取る。
 *
 * Returns:
 *     object:
 *         laneRef (ref): レーンコンテナ要素に付ける ref。
 *         hud (object|null): 最新の HUD 値（エネルギー・スコア・城HP・手札等）。
 *         deploy (function): プレイヤーの手札 index を出撃させる。
 *         setDiffMode (function): 敵味方の見分けモードを切り替える。
 */
export default function useLaneBattleEngine({ deckIds, onEnd }) {
  const laneRef = useRef(null);
  const engineRef = useRef(null);
  const onEndRef = useRef(onEnd);
  const [hud, setHud] = useState(null);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    const laneEl = laneRef.current;
    if (!laneEl) return undefined;
    const engine = createLaneBattleEngine({
      laneEl,
      playerDeckIds: deckIds,
      onHud: setHud,
      onEnd: (result) => onEndRef.current?.(result),
    });
    engineRef.current = engine;
    engine.setDiffMode('both');
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // デッキは対戦ごとに固定。再戦は key 変更による再マウントで行うため
    // 依存配列は空にして「マウント時に1回生成」する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    laneRef,
    hud,
    deploy: (index) => engineRef.current?.deployCard(index),
    setDiffMode: (mode) => engineRef.current?.setDiffMode(mode),
  };
}
