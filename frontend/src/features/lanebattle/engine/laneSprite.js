import { getEnemyFramePath } from '../../battle/enemy/enemySpritePath';

/*
 * 使用キャラのスプライトフレームを先読みして、フレーム切替時のチラつきを
 * 防ぐ。同じキャラを何度出しても 1 回で済むよう、済み ID を記録する。
 */
const preloaded = new Set();
function preload(def) {
  if (preloaded.has(def.id)) return;
  preloaded.add(def.id);
  for (let i = 0; i < def.idleFrames; i += 1) {
    const img = new Image();
    img.src = getEnemyFramePath(def.id, 'idle', i);
  }
  for (let i = 0; i < def.deadFrames; i += 1) {
    const img = new Image();
    img.src = getEnemyFramePath(def.id, 'dead', i);
  }
}

/**
 * レーン上の 1 ユニットを表す DOM を生成し、命令的に更新する操作を返す。
 *
 * React の再レンダリングを介さず、エンジンのループから直接位置・フレーム・
 * HP バーを書き換えるための軽量スプライト。敵味方の見分け（要件8）は、
 * 生成する `.unit` に `you` / `cpu` クラスを付けるだけで、実際の色オーラ・
 * 向き（左右反転）・見分けモード切替は親レーン（`.lb-lane[data-diff]`）側の
 * CSS が担う。スプライト URL は命名規則の唯一の実装 `getEnemyFramePath`
 * を再利用して生成する。
 *
 * Args:
 *     laneEl (HTMLElement): ユニットを追加するレーンのコンテナ要素。
 *     def (object): `deriveUnitDef` が返すユニット定義。
 *     side (string): `"you"` または `"cpu"`。
 *
 * Returns:
 *     object: 以下の操作を持つハンドル。
 *         node (HTMLElement): 生成したユニット要素。
 *         setPos (function): x を割合（0〜100）で左位置に反映する。
 *         setHp (function): HP 比率（0〜1）を HP バー幅に反映する。
 *         setFrame (function): (state, frameIndex) で表示フレームを切り替える。
 *         hideHp (function): 撃破時に HP バーを隠す。
 *         remove (function): DOM から取り除く。
 */
export function createLaneSprite(laneEl, def, side) {
  preload(def);

  const node = document.createElement('div');
  node.className = `unit ${side}`;

  const aura = document.createElement('span');
  aura.className = 'aura';
  node.appendChild(aura);

  const stage = document.createElement('span');
  stage.className = 'stage';
  const img = document.createElement('img');
  img.draggable = false;
  img.alt = '';
  img.src = getEnemyFramePath(def.id, 'idle', 0);
  stage.appendChild(img);
  node.appendChild(stage);

  const hp = document.createElement('span');
  hp.className = 'hpbar';
  const hpFill = document.createElement('i');
  hp.appendChild(hpFill);
  node.appendChild(hp);

  laneEl.appendChild(node);

  let curState = 'idle';
  let curFrame = 0;

  return {
    node,
    setPos: (xPct) => {
      node.style.left = `${xPct}%`;
    },
    setHp: (ratio) => {
      hpFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    },
    setFrame: (state, frameIndex) => {
      if (state === curState && frameIndex === curFrame) return;
      curState = state;
      curFrame = frameIndex;
      img.src = getEnemyFramePath(def.id, state, frameIndex);
    },
    hideHp: () => {
      hp.style.display = 'none';
    },
    remove: () => {
      node.remove();
    },
  };
}
