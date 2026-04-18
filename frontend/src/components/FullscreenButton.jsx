import { useEffect, useState } from 'react';

/**
 * 全画面表示の切り替えボタン。
 *
 * ブラウザの Fullscreen API を用いてドキュメント全体を全画面モードに
 * 切り替える。requestFullscreen はユーザー操作(クリック)コンテキスト内
 * でのみ許可されるため、必ず本ボタンの押下経由で呼び出す。
 * fullscreenchange イベントを購読し、Esc キーでの解除にも追従する。
 *
 * Returns:
 *     JSX.Element: 全画面切り替え用の button 要素。
 */
function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
    };
  }, []);

  /**
   * 全画面モードをトグルする。
   *
   * 現在全画面中であれば解除し、そうでなければルート要素に対して
   * requestFullscreen を呼ぶ。失敗時はコンソールに警告を出すのみで
   * UI は変更しない。
   */
  const toggle = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  return (
    <button type="button" onClick={toggle}>
      {isFullscreen ? '全画面を解除' : '全画面で遊ぶ'}
    </button>
  );
}

export default FullscreenButton;
