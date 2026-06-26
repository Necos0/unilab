import { useEffect, useState } from 'react';
import styles from './FullscreenToggleButton.module.css';

/**
 * ブラウザの Fullscreen API でフルスクリーン表示を ON/OFF 切り替えする
 * トグルボタン。マップ画面の左下にオーバーレイ表示する想定。
 *
 * `document.fullscreenchange` を購読して現在のフルスクリーン状態を
 * 自分の `useState` に同期させ、それに応じてラベルを「大画面」⇔
 * 「通常画面」と切り替える。`requestFullscreen` / `exitFullscreen` は
 * Promise を返すブラウザがあるため、失敗時の rejection を握り潰して
 * UI ががた付かないようにする（例: フルスクリーン許可がブラウザ側で
 * 拒否された場合）。
 *
 * 既定の配置・配色は CSS の `position: absolute` でマップ画面の左下に重ねる
 * デバッグ／視聴用トーン。`className` を渡すとその場限りの見た目に差し替え
 * られるため、タイトル画面など別画面で見栄えのするボタンとして再利用できる
 * （トグルのロジックとラベルは共通のまま）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         className (string, optional): ボタンに適用するクラス名。省略時は
 *             既定のデバッグ風スタイル（`styles.button`、左下配置）。
 *
 * Returns:
 *     JSX.Element: トグルボタン要素。
 */
function FullscreenToggleButton({ className }) {
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenElement),
  );

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const handleClick = () => {
    if (document.fullscreenElement) {
      const result = document.exitFullscreen();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
      return;
    }
    const result = document.documentElement.requestFullscreen();
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  };

  return (
    <button
      type="button"
      className={className ?? styles.button}
      onClick={handleClick}
    >
      {isFullscreen ? '⛶ 通常画面' : '⛶ 大画面'}
    </button>
  );
}

export default FullscreenToggleButton;
