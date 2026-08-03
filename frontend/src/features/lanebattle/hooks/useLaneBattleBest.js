import { useCallback, useState } from 'react';

/* 本編セーブと衝突しない専用キー（要件2・12）。 */
const STORAGE_KEY = 'lanebattle.bestScore';

function readBest() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

/**
 * ミニゲームの自己ベスト（ハイスコア）を localStorage で読み書きするフック。
 *
 * 本編のセーブとは別キー（`lanebattle.bestScore`）で永続化するため、本編の
 * 進捗には一切干渉しない（要件2・12）。
 *
 * Returns:
 *     object:
 *         best (number): 現在の自己ベスト。
 *         submit (function): スコアを提出し、自己ベストを上回れば保存して
 *             `true`（更新）を、そうでなければ `false` を返す。
 */
export default function useLaneBattleBest() {
  const [best, setBest] = useState(readBest);

  const submit = useCallback((score) => {
    const current = readBest();
    if (score > current) {
      try {
        localStorage.setItem(STORAGE_KEY, String(score));
      } catch {
        /* localStorage 不可時はメモリ上のみ更新 */
      }
      setBest(score);
      return true;
    }
    setBest(current);
    return false;
  }, []);

  return { best, submit };
}
