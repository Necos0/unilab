import stagesData from '../../data/stagesLoader.js';
import enemiesData from '../../data/enemies.json';
import { getEnemyFramePath } from './enemy/enemySpritePath';

/**
 * バトル画面で使用する画像 URL を Image オブジェクトで事前読み込みする。
 *
 * `<img>` の load イベントに依存せず、`new Image()` でブラウザのリソース
 * キャッシュに乗せておくことで、本マウント時に既にデコード済みの状態から
 * 描画を始められる（チラつきや初回フレーム抜けの防止）。
 *
 * Args:
 *     src (string): 画像の公開 URL。
 *
 * Returns:
 *     Promise<void>: ロード完了またはエラーで resolve する。エラー時にも
 *         resolve することで、欠損画像 1 枚が画面遷移全体をブロックしない
 *         ようにする（本来は別のエラー監視で検出すべき領域）。
 */
function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

/**
 * 指定ステージのバトル画面で必要な画像 URL 一覧を組み立てる。
 *
 * 対象は以下：
 *   - 敵スプライト（`enemies.json` で定義された全アニメーション状態の全フレーム）
 *   - 手札カード画像（`stages.json` の `cards[].id` を deduplicate したもの）
 *   - スロットにロック配置されたカード画像（`slots[].lockedCard.id`）
 *   - フローチャート用アイコン（start / goal / play / reset）
 *
 * **カード画像の拡張子解決**（`loop-counter` 暫定対応）：原則すべてのカードで
 * `/cards/<id>.png` を読むが、`counter` カードのみ `Card.jsx` の拡張子分岐と
 * 整合させるため `/cards/counter.svg` を読む。デザイン班から本番 `counter.png`
 * が届いた段階で、両 for ループの三項演算を削除して `.png` 直接結合に戻し、
 * `public/cards/counter.svg` を削除する（剥がし箇所は `Card.jsx` の 1 箇所 +
 * 本ファイルの 2 箇所、合計 3 箇所）。
 *
 * Args:
 *     stage (object): `stages.json` の 1 ステージ分定義。
 *
 * Returns:
 *     string[]: 重複を除いた画像 URL 配列。
 */
function collectBattleAssetUrls(stage) {
  const urls = new Set();

  const enemy = enemiesData.enemies.find((e) => e.id === stage.enemyId);
  if (enemy?.animations) {
    for (const [stateName, anim] of Object.entries(enemy.animations)) {
      for (let i = 0; i < anim.frameCount; i += 1) {
        urls.add(getEnemyFramePath(enemy.id, stateName, i));
      }
    }
  }

  for (const card of stage.cards ?? []) {
    const ext = card.id === 'counter' ? 'svg' : 'png';
    urls.add(`/cards/${card.id}.${ext}`);
  }

  for (const slot of stage.slots ?? []) {
    if (slot.lockedCard?.id) {
      const ext = slot.lockedCard.id === 'counter' ? 'svg' : 'png';
      urls.add(`/cards/${slot.lockedCard.id}.${ext}`);
    }
  }

  urls.add('/icons/flowchart/start.svg');
  urls.add('/icons/flowchart/goal.svg');
  urls.add('/icons/flowchart/play.svg');
  urls.add('/icons/flowchart/reset.svg');

  return [...urls];
}

/**
 * 指定ステージのバトル画面アセットを並列に事前読み込みする。
 *
 * `BattleTransition` のフェード演出と並走させて、画面切替の見かけ時間内に
 * 画像のネットワーク取得とデコードを完了させる目的で使う。ステージ ID が
 * 不明な場合は即時 resolve する（演出だけ走らせて画面切替に進める）。
 *
 * Args:
 *     stageId (string): `stages.json` のステージキー。
 *
 * Returns:
 *     Promise<void>: 全画像のロード完了で resolve する。
 */
export default function preloadBattleAssets(stageId) {
  const stage = stagesData.stages[stageId];
  if (!stage) {
    return Promise.resolve();
  }
  const urls = collectBattleAssetUrls(stage);
  return Promise.all(urls.map(preloadImage)).then(() => undefined);
}
