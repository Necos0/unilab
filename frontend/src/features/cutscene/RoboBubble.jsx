import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './RoboBubble.module.css';
import useCutsceneStore from '../../stores/cutsceneStore';
import CutscenePointer from './CutscenePointer';
import CutsceneDragDemo from './CutsceneDragDemo';
import tokenizeFurigana from './tokenizeFurigana';
import playerData from '../../data/player.json';

/*
 * `{playerName}` が解決できないときに使う仮のプレイヤー名。
 * 名前入力・保存の仕組みが入るまでの暫定値（要件で「のあ」と指定）。
 */
const FALLBACK_PLAYER_NAME = 'のあ';

/*
 * ロボのアイコン画像。public 配下を絶対パスで参照する（他スプライトと同様）。
 */
const ROBO_ICON_SRC = '/sprites/robo/robo.png';

/*
 * 読み上げアニメーションで1トークン（1文字 or ルビ1組）を表示する間隔（ms）。
 */
const REVEAL_INTERVAL_MS = 45;

/**
 * 自動ガイドのロボ吹き出しを描画するコンポーネント（フェーズ1）。
 *
 * `cutsceneStore` の再生状態を購読し、再生中（`activeId` 非 null）のときだけ
 * 画面全体を覆うクリック受けレイヤーと、ロボのアイコン＋吹き出しを表示する。
 *
 * 吹き出しの文言は一度に出さず、**読み上げ（タイプライター）アニメーション**で
 * 1トークンずつ表示する。クリック／タップまたは Enter で操作でき、表示が
 * 途中なら全文を即座に表示（早送り）、表示が完了していれば次の吹き出しへ進む
 * （末尾まで進むと自動で閉じる）。
 *
 * 再生中は「クリック／タップ」と「Enter」だけを受け付け、それ以外の操作を
 * 禁止する。全面レイヤーが下の画面のポインタ操作を物理的にブロックし、加えて
 * window の keydown を capture フェーズで監視して Enter 以外のキー（R/T/Space
 * などのショートカット）を `stopImmediatePropagation` で遮断する。ブラウザ標準の
 * 修飾キー操作（Ctrl/Cmd/Alt 併用、リロード等）は妨げない。
 *
 * 吹き出し内の `{playerName}` は実際のプレイヤー名へ置換し（暫定値は「のあ」）、
 * `漢字《ふりがな》` 記法は `tokenizeFurigana` でトークン化してルビ付き表示に
 * 変換する。
 *
 * 現在の吹き出しが `point`（指差し誘導の対象 ID）を持つ場合は、`CutscenePointer`
 * を重ねて対応する画面要素（例: HP バー）をリング＋矢印で指し示す。対象 ID は
 * `cutsceneStore` の現在 step（`steps[stepIndex].point`）から取得し、吹き出しを
 * 送るたびに指す相手が切り替わる。
 *
 * 吹き出しを持たない step（`openCardHelp` のカード説明モーダル誘導）の上では
 * 何も描画せず（`null`）、キー入力の横取りもしない。モーダルの表示・閉じは
 * `BattleScreen` が `cutsceneStore.pendingCardHelpId` を見て担い、閉じると
 * カットシーンが次の step へ進む。
 *
 * 例外として、`waitForCardInSlot` を持つ「操作待ち」step では、吹き出し（ヒント）
 * は出しつつ全面レイヤーを素通し（`pointer-events: none`）にし、キー横取りも止める。
 * これによりプレイヤーが実際にカードをスロットへドラッグでき、次の step へ進める
 * のは `BattleScreen` の監視（カードがスロットに入ったら `advance`）だけになる。
 *
 * 見た目は共通で、ロボのアイコンを吹き出しの左外に置き、その右側に
 * しっぽ付きのスピーチバブルで文言を出す。`variant` では画面内の縦位置
 * だけを切り替える:
 *   - `"map"`   : 画面上側の左に置く。
 *   - `"battle"`: 画面上側（敵エリア）の左に、やや小さい幅で置く。
 *
 * Args:
 *     props (object): React プロパティ。
 *         variant ("map" | "battle"): 表示位置のバリアント。既定は "map"。
 *
 * Returns:
 *     JSX.Element | null: 再生中は吹き出しレイヤー、非再生中は null。
 */
function RoboBubble({ variant = 'map' }) {
  const activeId = useCutsceneStore((s) => s.activeId);
  const steps = useCutsceneStore((s) => s.steps);
  const stepIndex = useCutsceneStore((s) => s.stepIndex);

  /*
   * 現在の step。`bubble` を持つ step だけロボの吹き出しを描画する。
   * `openCardHelp` step（カード説明モーダル誘導）は吹き出しを持たないため、
   * このコンポーネントは何も出さず、モーダル表示を `BattleScreen` に委ねる。
   */
  const currentStep = steps[stepIndex];
  const isBubbleStep = typeof currentStep?.bubble === 'string';
  const rawText = currentStep?.bubble ?? '';
  /*
   * 現在の吹き出しに紐づく指差し誘導の対象。`point` を持たない step では
   * null になり、`CutscenePointer` は何も描画しない。
   */
  const activePoint = currentStep?.point ?? null;
  /*
   * 現在の吹き出しに紐づくドラッグ説明アニメの指定。`demoDrag` を持つ step で
   * のみ `CutsceneDragDemo`（カード→スロットの操作デモ）を重ねる。
   */
  const demoDrag = currentStep?.demoDrag ?? null;
  /*
   * プレイヤーの操作待ち step。`waitForCardInSlot` を持つ step では、吹き出し
   * （ヒント）は出しつつ全面レイヤーを「素通し」にして、下のカードを実際に
   * ドラッグできるようにする。クリック／Enter での送りも止め、次へ進めるのは
   * `BattleScreen` 側の監視（カードがスロットに入ったら `advance`）だけにする。
   */
  const isWaitStep = currentStep?.waitForCardInSlot === true;
  /*
   * 吹き出しを持たず `point` だけを出す「到着待ち」step（`waitForArrival`）。
   * ロボ・吹き出しは出さず、指差しリングだけを素通しレイヤーに重ねて対象の
   * タップを促す。クリック／Enter では進めず、対象ランドマークへ到着したとき
   * （`MapScreen` が `advance`）にだけ次へ進む。
   */
  const isPointerOnlyStep = !isBubbleStep && activePoint !== null;
  const playerName = playerData.name || FALLBACK_PLAYER_NAME;
  const text = rawText.replaceAll('{playerName}', playerName);
  const tokens = useMemo(() => tokenizeFurigana(text), [text]);

  /*
   * 表示中の吹き出しを一意に表すキー。これが変わったら（＝別の吹き出しに
   * 進んだら）読み上げを先頭からやり直す。state のリセットは effect ではなく
   * レンダー中の条件付き setState（React 公式の「prop 変化で state を戻す」
   * パターン）で行い、`react-hooks/set-state-in-effect` を避ける。
   */
  const stepKey = `${activeId}-${stepIndex}`;
  const [animKey, setAnimKey] = useState(stepKey);
  const [visibleCount, setVisibleCount] = useState(0);
  if (stepKey !== animKey) {
    setAnimKey(stepKey);
    setVisibleCount(0);
  }

  /*
   * 早送り・スキップ判定で最新値を参照するための ref。レンダー中ではなく
   * effect で同期する（`react-hooks/refs` ＝レンダー中の ref 更新禁止に従う）。
   */
  const tokensRef = useRef(tokens);
  const visibleCountRef = useRef(visibleCount);
  const intervalRef = useRef(null);
  useEffect(() => {
    tokensRef.current = tokens;
    visibleCountRef.current = visibleCount;
  }, [tokens, visibleCount]);

  /*
   * 読み上げアニメーション本体。`stepKey` ごとに 0 から1トークンずつ増やす。
   * setState は setInterval コールバック内（非同期）でのみ行うため、
   * `set-state-in-effect` ルールには抵触しない。
   */
  useEffect(() => {
    if (tokens.length === 0) {
      return undefined;
    }
    let count = 0;
    const timerId = setInterval(() => {
      count += 1;
      setVisibleCount(count);
      if (count >= tokens.length) {
        clearInterval(timerId);
      }
    }, REVEAL_INTERVAL_MS);
    intervalRef.current = timerId;
    return () => clearInterval(timerId);
  }, [stepKey, tokens.length]);

  /*
   * クリック／タップ／Enter の共通ハンドラ。
   *   - 表示が途中: 読み上げを止めて全文を即表示（早送り）
   *   - 表示が完了: 次の吹き出しへ進める
   * ref 経由で最新値を読むため依存なしで安定。
   */
  const handleAdvance = useCallback(() => {
    if (visibleCountRef.current < tokensRef.current.length) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setVisibleCount(tokensRef.current.length);
    } else {
      useCutsceneStore.getState().advance();
    }
  }, []);

  /*
   * 会話中（`activeId` 非 null）はキー入力を Enter のみに制限する。
   * capture フェーズで window の keydown を捕まえ、Enter は送り扱い、それ
   * 以外のキーは `stopImmediatePropagation` で他リスナー（App の R/T、
   * MapScreen の Space など）に届く前に遮断する。修飾キー併用のブラウザ
   * 標準ショートカット（リロード等）は素通しする。
   */
  useEffect(() => {
    if (!activeId || !isBubbleStep || isWaitStep) {
      return undefined;
    }
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        handleAdvance();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeId, isBubbleStep, isWaitStep, handleAdvance]);

  if (!activeId || (!isBubbleStep && !isPointerOnlyStep)) {
    return null;
  }

  /*
   * point だけを出す「到着待ち」step。ロボ・吹き出しは描画せず、指差しリング
   * だけを素通しレイヤー（`passThrough`）に重ねる。クリック送り・キー横取りは
   * しないので、下の巻物を実際にタップして移動できる。
   */
  if (isPointerOnlyStep) {
    const pointerLayerClassName = [styles.layer, styles[variant], styles.passThrough]
      .filter(Boolean)
      .join(' ');
    return (
      <div className={pointerLayerClassName} aria-hidden="true">
        {activePoint && <CutscenePointer key={activePoint} targetId={activePoint} />}
      </div>
    );
  }

  const layerClassName = [styles.layer, styles[variant], isWaitStep && styles.passThrough]
    .filter(Boolean)
    .join(' ');
  /*
   * 全トークンを常に描画し、未表示分（index >= visibleCount）は `.hidden` で
   * 透明にする。こうすると吹き出しは最初から全文ぶんの大きさを確保するため、
   * 読み上げ中もバブルのサイズが変わらない。
   */
  const textNodes = tokens.map((token, index) => {
    const className = index >= visibleCount ? styles.hidden : undefined;
    return token.type === 'ruby' ? (
      <ruby key={index} className={className}>
        {token.base}
        <rt>{token.ruby}</rt>
      </ruby>
    ) : (
      <span key={index} className={className}>
        {token.value}
      </span>
    );
  });

  return (
    <div
      className={layerClassName}
      onClick={handleAdvance}
      role="button"
      tabIndex={0}
      aria-label="つぎへ"
    >
      {activePoint && <CutscenePointer key={activePoint} targetId={activePoint} />}
      {demoDrag && (
        <CutsceneDragDemo
          key={`${demoDrag.from}-${demoDrag.to}`}
          from={demoDrag.from}
          to={demoDrag.to}
          cardId={demoDrag.cardId}
        />
      )}
      <div className={styles.group}>
        <img
          className={styles.icon}
          src={ROBO_ICON_SRC}
          alt="ロボ"
          draggable={false}
        />
        <div className={styles.bubble}>
          <div className={styles.body}>
            <p className={styles.text}>{textNodes}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoboBubble;
