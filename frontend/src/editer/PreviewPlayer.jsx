import { useEffect, useState } from 'react';
import styles from './PreviewPlayer.module.css';

/*
 * プレビューで選べる FPS（1 秒あたりのコマ数）の候補。アニメの確認に使う
 * 一般的な値を低速〜高速まで並べる。
 */
const FPS_OPTIONS = [1, 2, 4, 6, 8, 10, 12, 15, 20, 24, 30];

/**
 * 切り取ったコマを順番に再生して動きを確認するプレビュー。FPS を選べる。
 *
 * リストの並び順どおりにコマを送り、`fps` から算出した間隔でループ再生する。
 * 再生／一時停止を切り替えられ、FPS を変えると間隔が即座に反映される。
 * コマが削除・並べ替えされて枚数が変わっても、剰余でインデックスを丸めて
 * 範囲外参照を避ける。`fps` は親が保持する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         frames (Array<{id: number, dataUrl: string}>): 再生するコマ一覧。
 *         fps (number): 再生 FPS。
 *         onFpsChange (function): FPS 変更時に新しい数値を渡して呼ぶ関数。
 *
 * Returns:
 *     JSX.Element: プレビュー領域を表す要素。
 */
function PreviewPlayer({ frames, fps, onFpsChange }) {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
      return undefined;
    }
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(timer);
  }, [isPlaying, fps, frames.length]);

  const safeIndex = frames.length > 0 ? index % frames.length : 0;
  const currentFrame = frames[safeIndex];

  return (
    <div className={styles.panel}>
      <div className={styles.title}>プレビュー</div>
      <div className={styles.screen}>
        {currentFrame ? (
          <img
            src={currentFrame.dataUrl}
            alt=""
            className={styles.image}
          />
        ) : (
          <span className={styles.empty}>コマがありません</span>
        )}
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.playButton}
          onClick={() => setIsPlaying((playing) => !playing)}
          disabled={frames.length === 0}
        >
          {isPlaying ? '一時停止' : '再生'}
        </button>
        <label className={styles.fpsLabel}>
          FPS
          <select
            className={styles.fpsSelect}
            value={fps}
            onChange={(event) => onFpsChange(Number(event.target.value))}
          >
            {FPS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <span className={styles.counter}>
          {frames.length > 0 ? `${safeIndex + 1} / ${frames.length}` : '0 / 0'}
        </span>
      </div>
    </div>
  );
}

export default PreviewPlayer;
