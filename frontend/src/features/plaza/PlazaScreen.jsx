import { useState } from 'react';
import styles from './PlazaScreen.module.css';
import CardMatchScreen from './cardmatch/CardMatchScreen';

/*
 * ひろばのロボ（ビット）のアイコン画像。RoboBubble と同じアセットを使う。
 */
const ROBO_ICON_SRC = '/sprites/robo/robo.png';

/**
 * ミニゲームのハブ画面「あそびのひろば」。
 *
 * 本編に飽きた・休憩したいプレイヤー向けの息抜きスペース。将来は
 * 「ステージ 2（ワールド 2 のボス）クリア」で解放される想定で、現在は
 * マップ画面のテスト用ボタン（`PlazaEntryButton`）から遷移する。
 *
 * 画面内の表示切替（ハブ ⇄ 各ミニゲーム）は本コンポーネントのローカル
 * state `view` で完結させ、`App` には「ひろば」1 画面としてぶら下がる
 * （ミニゲームが増えても App 側の画面管理が太らないようにする）。
 *   - `view === 'hub'`      : ミニゲームの選択カードを並べたハブ
 *   - `view === 'cardmatch'`: カードあわせ（`CardMatchScreen`）
 *
 * ハブには遊べるミニゲーム（カードあわせ）と、今後の追加をほのめかす
 * 「じゅんびちゅう」の空き枠を並べる。ゲーム内テキストは低学年でも
 * 読めるよう、すべてひらがな・カタカナで書く（漢字を使わないことで
 * ふりがな規則を満たす）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onExitToMap (function): 「マップへもどる」押下時に呼ぶハンドラ。
 *             引数なし。`App` 側でマップ画面へ切り替える。
 *
 * Returns:
 *     JSX.Element: ひろば画面（またはプレイ中のミニゲーム画面）。
 */
function PlazaScreen({ onExitToMap }) {
  const [view, setView] = useState('hub');

  if (view === 'cardmatch') {
    return <CardMatchScreen onExit={() => setView('hub')} />;
  }

  return (
    <section className={styles.root}>
      <button type="button" className={styles.exitButton} onClick={onExitToMap}>
        ← マップへもどる
      </button>
      <header className={styles.header}>
        <img
          className={styles.roboIcon}
          src={ROBO_ICON_SRC}
          alt="ビット"
          draggable={false}
        />
        <h1 className={styles.title}>あそびのひろば</h1>
        <p className={styles.subtitle}>ここで ひとやすみ していこう!</p>
      </header>
      <div className={styles.gameList}>
        <div className={styles.gameCard}>
          <p className={styles.gameName}>カードあわせ</p>
          <p className={styles.gameDescription}>
            おなじ えを 2まい みつけよう!
          </p>
          <button
            type="button"
            className={styles.playButton}
            onClick={() => setView('cardmatch')}
          >
            あそぶ
          </button>
        </div>
        <div className={`${styles.gameCard} ${styles.comingSoon}`}>
          <p className={styles.gameName}>???</p>
          <p className={styles.gameDescription}>じゅんびちゅう…</p>
        </div>
      </div>
    </section>
  );
}

export default PlazaScreen;
