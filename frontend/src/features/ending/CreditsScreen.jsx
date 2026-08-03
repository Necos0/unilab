import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styles from './CreditsScreen.module.css';
import tokenizeFurigana from '../cutscene/tokenizeFurigana';
import buildCreditLines from './buildCreditLines.js';
import CREDITS_DATA from '../../data/ending_credits.json';
import useProgressStore from '../../stores/progressStore.js';
import usePlayerStore from '../../stores/playerStore.js';

/* 行と行の縦の間隔（px）。ジャンプで届く距離を基準に決めている。 */
const LINE_STEP_PX = 96;

/* クレジットが上へ流れる速さ（px/秒）。1 行ぶんを約 2 秒で流す。 */
const SCROLL_SPEED_PX_S = 48;

/* 重力加速度（px/秒^2）と、ジャンプの初速（px/秒。上向きが負）。 */
const GRAVITY_PX_S2 = 2300;
const JUMP_VELOCITY_PX_S = -840;

/* 左右移動の速さ（px/秒）。 */
const MOVE_SPEED_PX_S = 280;

/* 主人公の当たり判定の幅と、表示の高さ（px）。 */
const PLAYER_WIDTH_PX = 30;
const PLAYER_HEIGHT_PX = 48;

/*
 * 行の上辺から「足場の面」までの下がり幅（px）。行ボックスにはルビの
 * ぶんの余白が上に付くので、少し下げて文字の頭に立っているように見せる。
 */
const PLATFORM_INSET_PX = 12;

/*
 * 画面上端の立入禁止マージン（px）。ここより上へ流れた行は足場でなくなり、
 * 乗ったままの主人公は押し下げられて落ちる（上に乗り続けて画面外へ
 * 消えてしまわないための仕組み）。
 */
const TOP_MARGIN_PX = 56;

/* 画面下端からこの距離（px）だけ落ちたら「見るだけモード」へ切り替える。 */
const FALL_MARGIN_PX = 80;

/* スクロールが始まるまでの導入時間（ms）。操作説明を読む猶予。 */
const INTRO_MS = 2600;

/* Esc 長押しでスキップが発動するまでの時間（ms）。 */
const SKIP_HOLD_MS = 1000;

/* 「Thank You」表示からリザルトパネルを出すまでの待ち時間（ms）。 */
const RESULT_DELAY_MS = 1200;

/* 歩き・立ちアニメのコマ送り間隔（ms）。 */
const WALK_FRAME_MS = 110;
const IDLE_FRAME_MS = 240;

/* 行の `x` が万一欠けていたときの左余白（px）。 */
const FALLBACK_LINE_X_PX = 48;

/* コインを取れる距離（主人公の中心とコインの中心の距離、px）。 */
const COIN_PICKUP_RADIUS_PX = 38;

/* 主人公スプライトの連番コマ数（`public/sprites/hero/` 配下と一致させる）。 */
const HERO_RIGHT_FRAMES = 6;
const HERO_LEFT_FRAMES = 7;
const HERO_IDLE_FRAMES = 4;

/**
 * 主人公スプライトの画像パスを組み立てる。
 *
 * Args:
 *     direction (string): `'right'` / `'left'` / `'idle'` のいずれか。
 *     frame (number): 0 始まりのコマ番号。
 *
 * Returns:
 *     string: `public/` 配下の画像への絶対パス。
 */
function heroFramePath(direction, frame) {
  const padded = String(frame).padStart(2, '0');
  return `/sprites/hero/${direction}/hero_${direction}_${padded}.png`;
}

/**
 * 行テキストを、ふりがな付きの React ノード列に変換する。
 *
 * `漢字《ふりがな》` 記法を含む行は `tokenizeFurigana` で `<ruby>` に
 * 変換し、含まない行（タグ行など）はそのまま文字列で返す。
 *
 * Args:
 *     text (string): 行の表示テキスト。
 *
 * Returns:
 *     React.ReactNode: 描画用ノード。
 */
function renderLineText(text) {
  if (!text.includes('《')) {
    return text;
  }
  return tokenizeFurigana(text).map((token, index) =>
    token.type === 'ruby' ? (
      <ruby key={index}>
        {token.base}
        <rt>{token.ruby}</rt>
      </ruby>
    ) : (
      <span key={index}>{token.value}</span>
    ),
  );
}

/**
 * エンディングロール画面（クレジットの上を歩く足場ゲーム付き）。
 *
 * エンディング紙芝居のあとに表示する。HTML 風に組んだクレジットの行が
 * 下から上へゆっくり流れ、プレイヤーは主人公を操作して行の上に乗り続ける。
 * 行はコードのインデント・空行・長さの違いがそのまま足場配置になっており、
 * 行の種類（`buildCreditLines` の `kind`）で乗れるかどうかが変わる：
 * タグ行（金色）と日本語行（白）は乗れる足場、コメント行（グレー）は
 * すり抜ける。相棒のフロチャロボは当たり判定なしで主人公に浮遊追従する。
 *
 * 遊びの目的はコイン集め。行のあいだに配置されたコイン（`{}` 型）に
 * 触れると取得でき、HUD とリザルトパネルに「あつめた コイン n / 全数」が
 * 出る。行の横位置（`x`）とコインの座標は `data/ending_credits.json` が
 * 持ち、配置エディタ（`CreditsEditorScreen`、隠しコマンド `wqedit`）で
 * ドラッグして調整する。
 *
 * 画面の下へ落ちても負けにはならず「見るだけモード」へ切り替わり、
 * クレジットは通常のエンディングロールとして最後まで流れる。成績は
 * コイン数と「のれてた わりあい」（ロール全体の時間のうち足場へ乗れて
 * いた時間の割合。0% から積み上がる加点方式）で表示する。Esc 長押しで
 * いつでもスキップできる。
 *
 * 実装メモ：スクロール・重力・当たり判定は `requestAnimationFrame` の
 * 1 ループで回し、毎フレームの位置更新は React の再レンダーではなく
 * ref 経由の style 直接更新で行う（`RoboSprite` と同じ方針）。React の
 * state はフェーズ切り替え（intro / playing / finished）と落下フラグ
 * だけに使う。
 *
 * 配置エディタ（`CreditsEditorScreen`）からはテストプレイとして呼ばれる。
 * `testLines` / `testCoins` に編集中の下書きを渡すと、JSON ファイルを
 * 書き出さなくてもそのレイアウトで遊べる。`onExitTest` が渡されている
 * あいだはテストモード扱いになり、画面右上に「← エディタへ」の即時退出
 * ボタンを出し、リザルトの退出ボタンも「エディタへ もどる」1 つに変わる。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onExitToTitle (function): リザルトの「タイトルへ」で呼ぶ（引数なし）。
 *             エンディングの締めなので、マップへ戻る道は作らずタイトルだけに
 *             している。
 *         testLines (Array, optional): テストプレイ用の行データ（プレース
 *             ホルダ未置換のまま渡してよい）。省略時は `ending_credits.json`。
 *         testCoins (Array, optional): テストプレイ用のコイン配置。
 *         onExitTest (function, optional): テストモードでエディタへ戻るとき
 *             に呼ぶ（引数なし）。渡すとテストモードになる。
 *
 * Returns:
 *     JSX.Element: エンディングロール画面全体の要素。
 */
function CreditsScreen({
  onExitToTitle,
  testLines = null,
  testCoins = null,
  onExitTest = null,
}) {
  const isTestMode = onExitTest !== null;
  /* 'intro'（操作説明・スクロール前）→ 'playing' → 'finished' */
  const [phase, setPhase] = useState('intro');
  const [isFallen, setIsFallen] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [finalRate, setFinalRate] = useState(0);
  const [finalCoins, setFinalCoins] = useState(0);

  const rootRef = useRef(null);
  const worldRef = useRef(null);
  const playerRef = useRef(null);
  const roboRef = useRef(null);
  const hudRateRef = useRef(null);
  const hudCoinsRef = useRef(null);
  /* Esc 長押しの進捗を示す円メーター。塗りはループ内で conic-gradient 更新。 */
  const skipMeterRef = useRef(null);
  const lineElsRef = useRef([]);
  const coinElsRef = useRef([]);
  /* 乗れる行の矩形リスト。マウント直後に実測して埋める。 */
  const platformsRef = useRef([]);

  /*
   * コインの配置。エディタ（`CreditsEditorScreen`）で決めた座標をそのまま
   * 使う。テストプレイ中は編集中の下書きを優先する。
   */
  const coins = testCoins ?? CREDITS_DATA.coins;

  /*
   * クレジットの全行。進捗はマウント時のスナップショットで固定する
   * （ロール中に進捗が変わることはない）。
   */
  const lines = useMemo(() => {
    const progress = useProgressStore.getState();
    return buildCreditLines(
      {
        playerName: usePlayerStore.getState().playerName,
        clearedStageIds: progress.clearedStageIds,
        seenCardIds: progress.seenCardIds,
      },
      testLines ?? undefined,
    );
  }, [testLines]);

  /* 使う画像（主人公の全コマ・ロボ・キャストの敵）をまとめて先読みする。 */
  useEffect(() => {
    const sources = [
      ...Array.from({ length: HERO_RIGHT_FRAMES }, (_, i) => heroFramePath('right', i)),
      ...Array.from({ length: HERO_LEFT_FRAMES }, (_, i) => heroFramePath('left', i)),
      ...Array.from({ length: HERO_IDLE_FRAMES }, (_, i) => heroFramePath('idle', i)),
      ...lines.filter((line) => line.sprite).map((line) => line.sprite),
    ];
    sources.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [lines]);

  /*
   * 乗れる行（タグ行・日本語行）の矩形を実測して足場リストを作る。
   * 幅は文字数や font-size に依存するため、レイアウト確定後の
   * `offsetWidth` で測る（キャストのスプライトは absolute 配置なので
   * 幅に影響しない）。
   */
  useLayoutEffect(() => {
    platformsRef.current = lines
      .map((line, index) => {
        const el = lineElsRef.current[index];
        if (!el || (line.kind !== 'tag' && line.kind !== 'text')) {
          return null;
        }
        return {
          x: el.offsetLeft,
          top: index * LINE_STEP_PX + PLATFORM_INSET_PX,
          width: el.offsetWidth,
        };
      })
      .filter(Boolean);
  }, [lines]);

  /*
   * ゲームループ本体。キー入力・スクロール・物理・スプライトの
   * コマ送り・落下と終了の判定までを 1 つの rAF ループで行う。
   * 依存配列は空にし、マウント中はループを張りっぱなしにする
   * （フェーズは ref 経由で参照する）。
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return undefined;
    }
    const viewportW = () => root.clientWidth;
    const viewportH = () => root.clientHeight;

    /* ゲームの可変状態。React を介さずループ内だけで書き換える。 */
    const firstPlatform = platformsRef.current[0] ?? {
      x: FALLBACK_LINE_X_PX,
      top: 0,
      width: 200,
    };
    /*
     * ロール全体の再生時間（ms）。スクロールの開始位置から終了位置までを
     * 速度で割って出す。「のれてた わりあい」の分母で、乗れている時間が
     * 積み上がるほど 0% から 100% へ増えていく。
     */
    const lastLineY = (lines.length - 1) * LINE_STEP_PX;
    const totalPlayMs =
      ((lastLineY - viewportH() * 0.45 + viewportH() * 0.62) /
        SCROLL_SPEED_PX_S) *
      1000;
    const game = {
      phase: 'intro',
      scrollY: -viewportH() * 0.62,
      player: {
        x: firstPlatform.x + Math.min(80, firstPlatform.width * 0.4),
        y: firstPlatform.top,
        vy: 0,
        facing: 'right',
        onGround: true,
      },
      robo: { x: 0, y: 0, initialized: false },
      keys: { left: false, right: false },
      escDownAtMs: null,
      elapsedMs: 0,
      survivedMs: 0,
      isFallen: false,
      lastRatePct: 0,
      animMs: 0,
      lastFrameSrc: '',
      coinTaken: coins.map(() => false),
      coinCount: 0,
    };

    /** ロールを終了し、リザルト表示のフェーズへ移る。 */
    const finishRoll = () => {
      if (game.phase === 'finished') {
        return;
      }
      game.phase = 'finished';
      setFinalRate(game.lastRatePct);
      setFinalCoins(game.coinCount);
      setPhase('finished');
    };

    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'a') {
        game.keys.left = true;
        event.preventDefault();
      } else if (event.key === 'ArrowRight' || event.key === 'd') {
        game.keys.right = true;
        event.preventDefault();
      } else if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'w') {
        if (!event.repeat && game.player.onGround && !game.isFallen) {
          game.player.vy = JUMP_VELOCITY_PX_S;
          game.player.onGround = false;
        }
        event.preventDefault();
      } else if (event.key === 'Escape' && !event.repeat) {
        game.escDownAtMs = performance.now();
      }
    };
    const handleKeyUp = (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'a') {
        game.keys.left = false;
      } else if (event.key === 'ArrowRight' || event.key === 'd') {
        game.keys.right = false;
      } else if (event.key === 'Escape') {
        game.escDownAtMs = null;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let rafId = null;
    let lastTimeMs = null;

    const tick = (nowMs) => {
      if (game.phase === 'finished') {
        return;
      }
      if (lastTimeMs === null) {
        lastTimeMs = nowMs;
      }
      /* タブ復帰などの巨大 dt で物理が吹き飛ばないよう上限を設ける。 */
      const dt = Math.min((nowMs - lastTimeMs) / 1000, 0.032);
      lastTimeMs = nowMs;
      game.elapsedMs += dt * 1000;

      /*
       * Esc 長押しスキップ。押している間は円メーターを時計回りに満たし、
       * 一周（SKIP_HOLD_MS）でロールを終了する。離すとメーターは消える。
       */
      if (skipMeterRef.current) {
        if (game.escDownAtMs !== null) {
          const progress = Math.min(
            1,
            (nowMs - game.escDownAtMs) / SKIP_HOLD_MS,
          );
          skipMeterRef.current.style.opacity = '1';
          skipMeterRef.current.style.background = `conic-gradient(#f0c040 ${
            progress * 360
          }deg, rgba(245, 240, 224, 0.18) 0deg)`;
        } else {
          skipMeterRef.current.style.opacity = '0';
        }
      }
      if (game.escDownAtMs !== null && nowMs - game.escDownAtMs >= SKIP_HOLD_MS) {
        finishRoll();
        return;
      }

      /* 導入が終わったらスクロールを始める。 */
      if (game.phase === 'intro' && game.elapsedMs >= INTRO_MS) {
        game.phase = 'playing';
        setPhase('playing');
      }
      if (game.phase === 'playing') {
        game.scrollY += SCROLL_SPEED_PX_S * dt;
      }

      const player = game.player;
      if (!game.isFallen) {
        /* 左右移動。画面の端では止まる。 */
        const move =
          (game.keys.right ? 1 : 0) - (game.keys.left ? 1 : 0);
        if (move !== 0) {
          player.x += move * MOVE_SPEED_PX_S * dt;
          player.facing = move > 0 ? 'right' : 'left';
          const half = PLAYER_WIDTH_PX / 2;
          player.x = Math.max(half, Math.min(viewportW() - half, player.x));
        }

        /* 上端マージンより上の行は足場から外す（乗ったままの脱出防止）。 */
        const minPlatformTop = game.scrollY + TOP_MARGIN_PX + PLAYER_HEIGHT_PX;

        if (player.onGround) {
          /* 足元の行がまだ有効か（歩いて端から出ていないか）を確かめる。 */
          const half = PLAYER_WIDTH_PX / 2;
          const support = platformsRef.current.some(
            (p) =>
              Math.abs(p.top - player.y) < 2 &&
              p.top >= minPlatformTop &&
              player.x + half > p.x &&
              player.x - half < p.x + p.width,
          );
          if (!support) {
            player.onGround = false;
            player.vy = 0;
          }
        }
        if (!player.onGround) {
          /* 重力で落としつつ、下向きのときだけ行の上辺への着地を探す。 */
          const prevY = player.y;
          player.vy += GRAVITY_PX_S2 * dt;
          player.y += player.vy * dt;
          if (player.vy > 0) {
            const half = PLAYER_WIDTH_PX / 2;
            for (const p of platformsRef.current) {
              if (
                p.top >= minPlatformTop &&
                prevY <= p.top &&
                player.y >= p.top &&
                player.x + half > p.x &&
                player.x - half < p.x + p.width
              ) {
                player.y = p.top;
                player.vy = 0;
                player.onGround = true;
                break;
              }
            }
          }
        }

        /* 上端より上には行けない。押し下げられて足場から外れる。 */
        const minFeetY = game.scrollY + TOP_MARGIN_PX + PLAYER_HEIGHT_PX;
        if (player.y < minFeetY) {
          player.y = minFeetY;
          player.onGround = false;
          player.vy = Math.max(player.vy, 0);
        }

        /* コインの取得判定。主人公の中心との距離で判定する。 */
        const centerX = player.x;
        const centerY = player.y - PLAYER_HEIGHT_PX / 2;
        coins.forEach((coin, index) => {
          if (game.coinTaken[index]) {
            return;
          }
          const dx = coin.x - centerX;
          const dy = coin.y - centerY;
          if (dx * dx + dy * dy <= COIN_PICKUP_RADIUS_PX ** 2) {
            game.coinTaken[index] = true;
            game.coinCount += 1;
            const el = coinElsRef.current[index];
            if (el) {
              el.classList.add(styles.coinTaken);
            }
          }
        });

        /* 画面下へ落ちたら「見るだけモード」へ。 */
        if (player.y - game.scrollY > viewportH() + FALL_MARGIN_PX) {
          game.isFallen = true;
          setIsFallen(true);
        } else if (game.phase === 'playing') {
          game.survivedMs += dt * 1000;
        }
      }

      /*
       * のれてた わりあい（%）。ロール全体の時間を分母に、乗れている時間の
       * ぶんだけ 0% から増えていく（減点方式にしない）。落ちたあとは値が
       * 凍結される。
       */
      game.lastRatePct = Math.min(
        100,
        Math.round((game.survivedMs / totalPlayMs) * 100),
      );
      if (hudRateRef.current) {
        hudRateRef.current.textContent = `${game.lastRatePct}%`;
      }
      if (hudCoinsRef.current) {
        hudCoinsRef.current.textContent = `${game.coinCount} / ${coins.length}`;
      }

      /* ロボの浮遊追従（ゆっくり寄る＋ふわふわ上下）。 */
      const roboTargetX = player.x + (player.facing === 'right' ? -46 : 46);
      const roboTargetY =
        player.y - PLAYER_HEIGHT_PX - 26 + Math.sin(nowMs / 450) * 6;
      if (!game.robo.initialized) {
        game.robo = { x: roboTargetX, y: roboTargetY, initialized: true };
      } else {
        const ease = Math.min(1, dt * 4);
        game.robo.x += (roboTargetX - game.robo.x) * ease;
        game.robo.y += (roboTargetY - game.robo.y) * ease;
      }

      /* 主人公のコマ送り。空中は歩きコマの 1 枚を固定で使う。 */
      game.animMs += dt * 1000;
      let frameSrc;
      if (!player.onGround) {
        frameSrc = heroFramePath(player.facing, 2);
      } else if (game.keys.left !== game.keys.right) {
        const frames =
          player.facing === 'right' ? HERO_RIGHT_FRAMES : HERO_LEFT_FRAMES;
        frameSrc = heroFramePath(
          player.facing,
          Math.floor(game.animMs / WALK_FRAME_MS) % frames,
        );
      } else {
        frameSrc = heroFramePath(
          'idle',
          Math.floor(game.animMs / IDLE_FRAME_MS) % HERO_IDLE_FRAMES,
        );
      }

      /* 画面へ反映（React を介さず style を直接更新する）。 */
      if (worldRef.current) {
        worldRef.current.style.transform = `translateY(${-game.scrollY}px)`;
      }
      if (playerRef.current) {
        playerRef.current.style.transform = `translate(${
          player.x - PLAYER_WIDTH_PX / 2 - 9
        }px, ${player.y - PLAYER_HEIGHT_PX}px)`;
        if (frameSrc !== game.lastFrameSrc) {
          playerRef.current.src = frameSrc;
          game.lastFrameSrc = frameSrc;
        }
      }
      if (roboRef.current) {
        roboRef.current.style.transform = `translate(${game.robo.x - 20}px, ${
          game.robo.y - 20
        }px)`;
      }

      /* 最後の行が画面の中ほどまで来たらロール終了。 */
      const lastLineY = (lines.length - 1) * LINE_STEP_PX;
      if (game.scrollY >= lastLineY - viewportH() * 0.45) {
        finishRoll();
        return;
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ロール終了から少し待ってリザルトパネルを出す。 */
  useEffect(() => {
    if (phase !== 'finished') {
      return undefined;
    }
    const timerId = setTimeout(() => setShowResult(true), RESULT_DELAY_MS);
    return () => clearTimeout(timerId);
  }, [phase]);

  /** リザルトの成績に応じたひとことを返す。 */
  const resultMessage =
    finalRate >= 90
      ? 'すごい! ほとんど のりこなした!'
      : finalRate >= 50
        ? 'いいかんじ! つぎは もっと のれるかも'
        : 'おつかれさま! また あそんでね';

  const lineClassByKind = {
    tag: styles.tagLine,
    text: styles.textLine,
    comment: styles.commentLine,
  };

  return (
    <section className={styles.root} ref={rootRef}>
      <div className={styles.world} ref={worldRef}>
        {lines.map((line, index) =>
          line.kind === 'blank' ? null : (
            <div
              key={index}
              ref={(el) => {
                lineElsRef.current[index] = el;
              }}
              className={lineClassByKind[line.kind]}
              style={{
                top: index * LINE_STEP_PX,
                left: line.x ?? FALLBACK_LINE_X_PX,
              }}
            >
              {line.sprite && (
                <img
                  className={styles.castSprite}
                  src={line.sprite}
                  alt=""
                  draggable={false}
                />
              )}
              {renderLineText(line.text)}
            </div>
          ),
        )}
        {coins.map((coin, index) => (
          <div
            key={index}
            ref={(el) => {
              coinElsRef.current[index] = el;
            }}
            className={styles.coin}
            style={{ left: coin.x, top: coin.y }}
          >
            {'{}'}
          </div>
        ))}
        {!isFallen && (
          <>
            <img
              className={styles.robo}
              ref={roboRef}
              src="/sprites/robo/robo.png"
              alt=""
              draggable={false}
            />
            <img
              className={styles.player}
              ref={playerRef}
              src={heroFramePath('idle', 0)}
              alt="ゆうしゃ"
              draggable={false}
            />
          </>
        )}
      </div>

      <div className={styles.hud}>
        <span className={styles.hudCoinIcon}>{'{}'}</span> コイン{' '}
        <span ref={hudCoinsRef}>0 / {coins.length}</span>
        <span className={styles.hudDivider}> / </span>
        のれてた わりあい <span ref={hudRateRef}>0%</span>
      </div>

      {phase === 'intro' && (
        <div className={styles.introHint}>
          ← → で うごく / スペースで ジャンプ! コインを あつめよう!
        </div>
      )}

      {isFallen && phase !== 'finished' && (
        <div className={styles.fallenHint}>
          おっこちちゃった! そのまま ゆっくり みていってね
        </div>
      )}

      {phase !== 'finished' && (
        <>
          <div className={styles.skipMeter} ref={skipMeterRef} aria-hidden="true" />
          <div className={styles.skipHint}>Esc ながおしで とばす</div>
        </>
      )}

      {isTestMode && (
        <button
          type="button"
          className={styles.testExitButton}
          onClick={onExitTest}
        >
          ← エディタへ
        </button>
      )}

      {phase === 'finished' && (
        <div className={styles.finishOverlay}>
          <p className={styles.thankYou}>Thank You For Playing!</p>
          {showResult && (
            <div className={styles.resultPanel}>
              <p className={styles.resultRate}>
                あつめた コイン {finalCoins} / {coins.length}
              </p>
              <p className={styles.resultRate}>
                のれてた わりあい {finalRate}%
              </p>
              <p className={styles.resultMessage}>{resultMessage}</p>
              <div className={styles.resultButtons}>
                {isTestMode ? (
                  <button
                    type="button"
                    className={styles.resultButton}
                    onClick={onExitTest}
                  >
                    エディタへ もどる
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.resultButton}
                    onClick={onExitToTitle}
                  >
                    タイトルへ
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default CreditsScreen;
