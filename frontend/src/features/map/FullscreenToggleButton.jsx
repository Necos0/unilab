import { useEffect, useState } from 'react';
import styles from './FullscreenToggleButton.module.css';

/**
 * ブラウザの Fullscreen API でフルスクリーン表示を ON/OFF 切り替えする
 * トグルボタン。マップ画面の左上にオーバーレイ表示する想定。
 *
 * `document.fullscreenchange` を購読して現在のフルスクリーン状態を
 * 自分の `useState` に同期させ、それに応じてラベルを「大画面」⇔
 * 「通常画面」と切り替える。`requestFullscreen` / `exitFullscreen` は
 * Promise を返すブラウザがあるため、失敗時の rejection を握り潰して
 * UI ががた付かないようにする（例: フルスクリーン許可がブラウザ側で
 * 拒否された場合）。
 *
 * 配置は CSS の `position: absolute` でマップ画面の左上に重ねる。
 * BattleDemoButton（右上）と同じトーンで配色を揃え、デバッグ／視聴用
 * UI として控えめに表示する。
 *
 * Returns:
 *     JSX.Element: トグルボタン要素。
 */
function FullscreenToggleButton() {
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
    <button type="button" className={styles.button} onClick={handleClick}>
      {isFullscreen ? '⛶ 通常画面' : '⛶ 大画面'}
    </button>
  );
}

export default FullscreenToggleButton;
