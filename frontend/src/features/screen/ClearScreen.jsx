import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import useDebugCommands from '../../hooks/useDebugCommands.js';
import useTodayClears from '../../hooks/useTodayClears.js';
import { isClearRecordEnabled } from '../../services/clearRecordApi.js';
import FullscreenToggleButton from '../map/FullscreenToggleButton.jsx';
import ClearCelebration from './ClearCelebration.jsx';
import formatClearTime from './formatClearTime.js';
import RankBadge from './RankBadge.jsx';
import FlyingDragon from './FlyingDragon.jsx';
import ShootingStar from './ShootingStar.jsx';
import WalkingHero from './WalkingHero.jsx';
import useClearCelebrationQueue from './useClearCelebrationQueue.js';
import WanderingEnemy from './WanderingEnemy.jsx';
import styles from './ClearScreen.module.css';

/*
 * 草原を歩き回る敵。大きさ（vh）はバトルでの大きさの比率を目安に、
 * 最初の位置（vw）は勇者と重ならないよう横にばらけさせる。
 */
const WANDERING_ENEMIES = [
  { enemyId: 'slime', heightVh: 5, initialX: 34, speedVwPerSec: 3 },
  { enemyId: 'wolf', heightVh: 8, initialX: 56, speedVwPerSec: 4.5 },
  { enemyId: 'knight', heightVh: 11, initialX: 84, speedVwPerSec: 3 },
];

/*
 * マウスやタッチの操作が止まってから、大画面ボタンとマウスカーソルを
 * 隠すまでの時間（ミリ秒）。会場モニターに映しっぱなしにしても、
 * ボタンやカーソルが表示の邪魔をしないようにする。
 */
const CONTROLS_HIDE_DELAY_MS = 3000;

/* 1〜3 位の行に重ねる色（金・銀・銅）。添字は順位 - 1。 */
const TOP_ROW_CLASSES = [styles.rowGold, styles.rowSilver, styles.rowBronze];

/* 1 行ぶんがスクロールで流れるのにかける秒数。 */
const SECONDS_PER_ROW = 1.6;

/* テスト表示（`wqclear`）で使うクリアタイム（ミリ秒）。12 分 34 秒。 */
const DEBUG_CLEAR_TIME_MS = (12 * 60 + 34) * 1000;

/**
 * 会場モニター用の集計スクリーン（`/screen` で開く）。
 *
 * 上部に今日クリアした人数、下部に今日クリアした人を「順位・ニックネーム・
 * クリアタイム」の 1 行ずつ、クリアタイムが短い順に表示する。1〜3 位は
 * 王冠つきの順位マーク（`RankBadge`）と色つきの行で目立たせる。クリアタイムは
 * ニックネーム入力（開始）からクリアまでの経過時間。一覧が表示枠に
 * 収まりきらないときだけ、一覧を 2 つ並べて
 * 縦方向に途切れなくループスクロールさせる。データは `useTodayClears`
 * が Realtime で更新するので、クリアされると即座に反映される。
 * 画面の下の草原では、勇者とビット（`WalkingHero`）と敵たち
 * （`WanderingEnemy`）がちょこちょこ歩き回り、夜空にはときどき
 * ドラゴン（`FlyingDragon`）が飛んでくる。15 分に 1 回は流れ星
 * （`ShootingStar`）も流れる。
 * 右上の大画面ボタン（`FullscreenToggleButton`）でブラウザの全画面表示に
 * 切り替えられる。ボタンとマウスカーソルは、操作が止まって
 * `CONTROLS_HIDE_DELAY_MS` たつと隠れ、マウスを動かすとまた出る。
 * 画面を開いたあとに新しくクリアした人が出ると、「クリア おめでとう！」
 * の演出（`ClearCelebration`）を 1 人ずつ順番に出す。キーボードで
 * `wqclear` とタイプすると、この演出をテスト表示できる。
 *
 * Returns:
 *     JSX.Element: 集計スクリーン。
 */
function ClearScreen() {
  const { clears, hasError, isLoaded } = useTodayClears();
  const celebration = useClearCelebrationQueue(clears, isLoaded);
  const { enqueue: enqueueCelebration } = celebration;

  /* `wqclear` で、ダミーの人のお祝い演出をテスト表示する。 */
  const debugHandlers = useMemo(
    () => ({
      onClearCelebration: () => {
        const now = Date.now();
        enqueueCelebration({
          id: `debug-${now}`,
          nickname: 'てすと',
          started_at: new Date(now - DEBUG_CLEAR_TIME_MS).toISOString(),
          cleared_at: new Date(now).toISOString(),
        });
      },
    }),
    [enqueueCelebration],
  );
  useDebugCommands(debugHandlers);

  /*
   * クリアタイム（開始〜クリアの経過時間）が短い順に並べる。同タイムなら
   * 先にクリアした人を上にする。
   */
  const rankedClears = useMemo(() => {
    const elapsed = (clear) => new Date(clear.cleared_at) - new Date(clear.started_at);
    return [...clears].sort(
      (a, b) =>
        elapsed(a) - elapsed(b) || new Date(a.cleared_at) - new Date(b.cleared_at),
    );
  }, [clears]);
  const viewportRef = useRef(null);
  const listRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);

  /*
   * マウスを動かす・画面にふれると大画面ボタンとカーソルを出し、
   * `CONTROLS_HIDE_DELAY_MS` 操作がなければまた隠す。
   */
  useEffect(() => {
    let timerId = setTimeout(() => setIsControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
    const handleActivity = () => {
      setIsControlsVisible(true);
      clearTimeout(timerId);
      timerId = setTimeout(() => setIsControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
    };
    window.addEventListener('pointermove', handleActivity);
    window.addEventListener('pointerdown', handleActivity);
    return () => {
      clearTimeout(timerId);
      window.removeEventListener('pointermove', handleActivity);
      window.removeEventListener('pointerdown', handleActivity);
    };
  }, []);

  /*
   * 一覧（1 つぶん）が表示枠より高いかを測る。名前の増減と画面サイズの
   * 変化のたびに測り直す。
   */
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!viewport || !list) return undefined;
    const measure = () => {
      setIsOverflowing(list.scrollHeight > viewport.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(list);
    return () => observer.disconnect();
  }, [clears]);

  if (!isClearRecordEnabled()) {
    return (
      <div className={styles.screen}>
        <p className={styles.notice}>
          Supabase の接続情報（VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY）が未設定です。
        </p>
      </div>
    );
  }

  const renderNames = (isClone) => (
    <ul
      ref={isClone ? undefined : listRef}
      className={styles.nameList}
      aria-hidden={isClone || undefined}
    >
      {rankedClears.map((clear, index) => (
        <li
          key={clear.id}
          className={
            TOP_ROW_CLASSES[index] ? `${styles.row} ${TOP_ROW_CLASSES[index]}` : styles.row
          }
        >
          <RankBadge rank={index + 1} />
          <span className={styles.name}>{clear.nickname}</span>
          <span className={styles.time}>
            {formatClearTime(clear.started_at, clear.cleared_at)}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={
        isControlsVisible ? styles.screen : `${styles.screen} ${styles.cursorHidden}`
      }
    >
      <ShootingStar />
      <FlyingDragon />
      {WANDERING_ENEMIES.map((enemy) => (
        <WanderingEnemy key={enemy.enemyId} {...enemy} />
      ))}
      <WalkingHero />

      <header className={styles.header}>
        <p className={styles.label}>
          <ruby>
            今日<rt>きょう</rt>
          </ruby>
          クリアした
          <ruby>
            人<rt>ひと</rt>
          </ruby>
        </p>
        <p className={styles.count}>
          <span className={styles.countNumber}>{clears.length}</span>
          <ruby>
            人<rt>にん</rt>
          </ruby>
        </p>
      </header>

      <section
        ref={viewportRef}
        className={
          isOverflowing
            ? `${styles.viewport} ${styles.viewportScrolling}`
            : styles.viewport
        }
      >
        {clears.length === 0 ? (
          <p className={styles.empty}>まだ だれも クリアしていないよ</p>
        ) : (
          <div
            className={isOverflowing ? styles.scroller : undefined}
            style={
              isOverflowing
                ? { animationDuration: `${clears.length * SECONDS_PER_ROW}s` }
                : undefined
            }
          >
            {renderNames(false)}
            {isOverflowing && renderNames(true)}
          </div>
        )}
      </section>

      {celebration.current && (
        <ClearCelebration
          key={celebration.current.id}
          clear={celebration.current}
          onFinish={celebration.dequeue}
        />
      )}

      {hasError && <p className={styles.error}>つながりを たしかめています…</p>}

      <div
        className={
          isControlsVisible
            ? styles.fullscreenSlot
            : `${styles.fullscreenSlot} ${styles.fullscreenSlotHidden}`
        }
      >
        <FullscreenToggleButton className={styles.fullscreenButton} />
      </div>
    </div>
  );
}

export default ClearScreen;
