import styles from './ClearCelebration.module.css';

/* 紙ふぶきの数。 */
const CONFETTI_COUNT = 56;

/* 紙ふぶきの色。画面の金色・白に、明るい色をまぜる。 */
const CONFETTI_COLORS = ['#fde68a', '#f0c040', '#ffffff', '#f472b6', '#60a5fa', '#4ade80', '#fb923c'];

/* 黄金比。ばらけた並びを、乱数を使わずに作るのに使う。 */
const GOLDEN_RATIO = 0.6180339887;

/**
 * 紙ふぶき 1 枚ずつの位置・色・速さを決める。
 *
 * 毎回の描画で同じ並びになるよう、乱数ではなく黄金比の端数で
 * 横位置や遅れをばらけさせる。
 *
 * Returns:
 *     Array<{left: number, delay: number, duration: number, size: number,
 *         color: string, drift: number}>: 紙ふぶきの一覧。
 */
function buildConfetti() {
  return Array.from({ length: CONFETTI_COUNT }, (_, index) => {
    const spread = (index * GOLDEN_RATIO) % 1;
    const wobble = (index * GOLDEN_RATIO * GOLDEN_RATIO) % 1;
    return {
      left: spread * 100,
      delay: wobble * 1.6,
      duration: 3 + ((index * 7) % 5) * 0.35,
      size: 1 + ((index * 3) % 4) * 0.25,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      drift: (wobble - 0.5) * 16,
    };
  });
}

const CONFETTI = buildConfetti();

/**
 * 集計スクリーンで、新しくクリアした人をお祝いする演出。
 *
 * 画面を少し暗くして、まん中に「クリア おめでとう！」とニックネームを
 * 大きく出し、上から紙ふぶきを降らせる。全体のフェード
 * アウトのアニメーションが終わったら `onFinish` を呼ぶ。人が変わるたびに
 * 最初から再生できるよう、呼び出し側で `key` に人の id を渡すこと。
 *
 * Args:
 *     clear ({nickname: string}): お祝いする人。
 *     onFinish (function): 演出が終わったときに呼ぶ（引数なし）。
 *
 * Returns:
 *     JSX.Element: お祝いの演出。
 */
function ClearCelebration({ clear, onFinish }) {
  /* 子（紙ふぶき）のアニメーション終了も伝わってくるので、自分のぶんだけ見る。 */
  const handleAnimationEnd = (event) => {
    if (event.target === event.currentTarget) onFinish();
  };

  return (
    <div className={styles.overlay} onAnimationEnd={handleAnimationEnd} role="status">
      <div className={styles.confettiLayer} aria-hidden="true">
        {CONFETTI.map((piece, index) => (
          <span
            key={index}
            className={styles.confetti}
            style={{
              left: `${piece.left}vw`,
              width: `${piece.size}vh`,
              height: `${piece.size * 0.6}vh`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              '--drift': `${piece.drift}vw`,
            }}
          />
        ))}
      </div>

      <div className={styles.banner}>
        <p className={styles.title}>クリア おめでとう！</p>
        <p className={styles.name}>
          {clear.nickname}
          <span className={styles.honorific}>さん</span>
        </p>
      </div>
    </div>
  );
}

export default ClearCelebration;
