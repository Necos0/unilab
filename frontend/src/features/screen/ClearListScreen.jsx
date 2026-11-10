import { useEffect, useMemo, useState } from 'react';
import {
  fetchAllClears,
  getTodayStart,
  isClearRecordEnabled,
} from '../../services/clearRecordApi.js';
import RankBadge from './RankBadge.jsx';
import formatClearTime from './formatClearTime.js';
import ShootingStar from './ShootingStar.jsx';
import FlyingDragon from './FlyingDragon.jsx';
import WanderingEnemy from './WanderingEnemy.jsx';
import WalkingHero from './WalkingHero.jsx';
import clearStyles from './ClearScreen.module.css';
import styles from './ClearListScreen.module.css';

/* 1〜3 位の行の色（金・銀・銅）。会場用と同じ見た目を流用する。 */
const TOP_ROW_CLASSES = [clearStyles.rowGold, clearStyles.rowSilver, clearStyles.rowBronze];
const MAX_ROWS = 1000;
/* 会場用 ClearScreen と同じ、草原を歩き回る敵（大きさ・初期位置・速さ）。 */
const WANDERING_ENEMIES = [
  { enemyId: 'slime', heightVh: 5, initialX: 34, speedVwPerSec: 3 },
  { enemyId: 'wolf', heightVh: 8, initialX: 56, speedVwPerSec: 4.5 },
  { enemyId: 'knight', heightVh: 11, initialX: 84, speedVwPerSec: 3 },
];

/**
 * タイトルから開く「クリア者一覧」画面（要件1〜6）。
 *
 * 会場用 `ClearScreen` と同じ見た目（`ClearScreen.module.css`・`RankBadge`・
 * `formatClearTime` を流用）で、過去を含む全クリア者を**手動スクロール**で
 * 見せる。既定は「ぜんぶ」、トグルで「きょうだけ」に絞れる。並びはクリアタイム
 * の速い順（同タイムはクリア時刻の早い順）。Supabase 未設定・0件・取得失敗は
 * それぞれ文言で表示して画面を壊さない。開いた時点の一覧（Realtime なし）。
 * 背景の装飾（流れ星・飛ぶドラゴン・草原を歩く敵・歩く勇者）も会場用と同じ
 * 部品を流用して表示する。会場用 `/screen`（自動スクロール）は変更しない。
 *
 * Args:
 *     props (object):
 *         onBack (function): 「もどる」でタイトルへ戻すコールバック。
 *
 * Returns:
 *     JSX.Element: クリア者一覧画面。
 */
function ClearListScreen({ onBack }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(isClearRecordEnabled() ? 'loading' : 'disabled');
  const [today, setToday] = useState(false);

  useEffect(() => {
    if (status === 'disabled') return undefined;
    let active = true;
    fetchAllClears(MAX_ROWS)
      .then((data) => {
        if (active) {
          setRows(data);
          setStatus('ready');
        }
      })
      .catch((error) => {
        console.error('[clearList] fetch failed', error);
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [status]);

  /* 表示集合（きょうだけ絞り）をクリアタイムの速い順に並べて順位付けする。 */
  const ranked = useMemo(() => {
    const start = getTodayStart();
    const shown = today ? rows.filter((r) => new Date(r.cleared_at) >= start) : rows;
    const elapsed = (r) => new Date(r.cleared_at) - new Date(r.started_at);
    return [...shown].sort(
      (a, b) => elapsed(a) - elapsed(b) || new Date(a.cleared_at) - new Date(b.cleared_at),
    );
  }, [rows, today]);

  return (
    <div className={clearStyles.screen}>
      <ShootingStar />
      <FlyingDragon />
      {WANDERING_ENEMIES.map((enemy) => (
        <WanderingEnemy key={enemy.enemyId} {...enemy} />
      ))}
      <WalkingHero />

      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ← もどる
        </button>
        <p className={styles.title}>クリアした なかま</p>
        <div className={styles.toggleGroup}>
          <button
            type="button"
            className={`${styles.toggleBtn}${today ? '' : ` ${styles.active}`}`}
            onClick={() => setToday(false)}
          >
            ぜんぶ
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn}${today ? ` ${styles.active}` : ''}`}
            onClick={() => setToday(true)}
          >
            きょうだけ
          </button>
        </div>
      </div>

      {status === 'disabled' && (
        <p className={clearStyles.notice}>じゅんびちゅう…（データが ありません）</p>
      )}
      {status === 'loading' && <p className={clearStyles.notice}>よみこみ中…</p>}
      {status === 'error' && <p className={clearStyles.notice}>よみこみに しっぱいしました</p>}
      {status === 'ready' && (
        <div className={styles.viewport}>
          {ranked.length === 0 ? (
            <p className={clearStyles.empty}>まだ クリアした人が いないよ</p>
          ) : (
            <ul className={clearStyles.nameList}>
              {ranked.map((r, i) => (
                <li
                  key={r.id}
                  className={
                    TOP_ROW_CLASSES[i] ? `${clearStyles.row} ${TOP_ROW_CLASSES[i]}` : clearStyles.row
                  }
                >
                  <RankBadge rank={i + 1} />
                  <span className={clearStyles.name}>{r.nickname}</span>
                  <span className={clearStyles.time}>
                    {formatClearTime(r.started_at, r.cleared_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default ClearListScreen;
