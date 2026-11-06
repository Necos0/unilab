import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import useTodayClears from '../../hooks/useTodayClears.js';
import { isClearRecordEnabled } from '../../services/clearRecordApi.js';
import formatClearTime from './formatClearTime.js';
import FlyingDragon from './FlyingDragon.jsx';
import ShootingStar from './ShootingStar.jsx';
import WalkingHero from './WalkingHero.jsx';
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

/* 1 行ぶんがスクロールで流れるのにかける秒数。 */
const SECONDS_PER_ROW = 1.6;

/**
 * 会場モニター用の集計スクリーン（`/screen` で開く）。
 *
 * 上部に今日クリアした人数、下部に今日クリアした人を「ニックネーム・
 * クリアタイム」の 1 行ずつ、クリアタイムが短い順に表示する。クリアタイムは
 * ニックネーム入力（開始）からクリアまでの経過時間。一覧が表示枠に
 * 収まりきらないときだけ、一覧を 2 つ並べて
 * 縦方向に途切れなくループスクロールさせる。データは `useTodayClears`
 * が Realtime で更新するので、クリアされると即座に反映される。
 * 画面の下の草原では、勇者とビット（`WalkingHero`）と敵たち
 * （`WanderingEnemy`）がちょこちょこ歩き回り、夜空にはときどき
 * ドラゴン（`FlyingDragon`）が飛んでくる。15 分に 1 回は流れ星
 * （`ShootingStar`）も流れる。
 *
 * Returns:
 *     JSX.Element: 集計スクリーン。
 */
function ClearScreen() {
  const { clears, hasError } = useTodayClears();

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
      {rankedClears.map((clear) => (
        <li key={clear.id} className={styles.row}>
          <span className={styles.name}>{clear.nickname}</span>
          <span className={styles.time}>
            {formatClearTime(clear.started_at, clear.cleared_at)}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={styles.screen}>
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

      {hasError && <p className={styles.error}>つながりを たしかめています…</p>}
    </div>
  );
}

export default ClearScreen;
