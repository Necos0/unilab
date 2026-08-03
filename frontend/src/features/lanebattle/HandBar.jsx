import LbSprite from './LbSprite';
import Furigana from './Furigana';

/**
 * 手札3枚＋「つぎ」プレビューを表示し、タップで出撃するバー（要件4・5）。
 *
 * Args:
 *     props (object):
 *         hand (Array<{id,name,cost,disabled}>): 現在の手札3枚。
 *         next (object|null): つぎに手札へ入るカード `{ id, name }`。
 *         onDeploy (function): 出撃する手札 index を渡すコールバック。
 *
 * Returns:
 *     JSX.Element: 手札バー。
 */
export default function HandBar({ hand, next, onDeploy }) {
  return (
    <div className="lb-hand-wrap">
      <div className="lb-hand">
        {hand.map((c, i) => (
          <button
            key={`${c.id}-${i}`}
            type="button"
            className="lb-hcard"
            disabled={c.disabled}
            onClick={() => onDeploy(i)}
          >
            <span className="lb-stage">
              <LbSprite id={c.id} flip />
            </span>
            <span className="lb-nm"><Furigana text={c.name} /></span>
            <span className="lb-c">⚡{c.cost}</span>
          </button>
        ))}
      </div>
      {next && (
        <span className="lb-nextcard">
          つぎ▶
          <span className="lb-stage">
            <LbSprite id={next.id} flip />
          </span>
        </span>
      )}
    </div>
  );
}
