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

/* 画面下端からこの距離（px）だけ落ちたら「おちた」扱いにする。 */
const FALL_MARGIN_PX = 80;

/* 落ちてから復活するまでの待ち時間（ms）。 */
const RESPAWN_DELAY_MS = 3000;

/* スクロールが始まるまでの導入時間（ms）。操作説明を読む猶予。 */
const INTRO_MS = 2600;

/* Q 長押しでスキップが発動するまでの時間（ms）。 */
const SKIP_HOLD_MS = 1000;

/* 「Thank You」表示からリザルトパネルを出すまでの待ち時間（ms）。 */
const RESULT_DELAY_MS = 1200;

/* リザルトの数値が 0 から最終値までカウントアップする時間（ms）。 */
const RESULT_COUNT_UP_MS = 1400;

/*
 * 達成度の色グラデーションの節目。0 = グレー → 0.5 = 白 → 1 = 金と、
 * 集めた割合が高いほど華やかな色に近づく（RGB 線形補間）。
 */
const ACHIEVEMENT_COLOR_STOPS = [
  [0, [138, 138, 149]],
  [0.5, [245, 240, 224]],
  [1, [240, 192, 64]],
];

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
 * 達成度（0〜1）に応じた色を返す。
 *
 * リザルトのカウントアップ表示で使い、数値が増えるにつれて
 * グレー → 白 → 金（`ACHIEVEMENT_COLOR_STOPS`）へなめらかに色が
 * 変わっていく。範囲外の値は 0〜1 に丸める。
 *
 * Args:
 *     fraction (number): 達成度。0（最低）〜 1（満点）。
 *
 * Returns:
 *     string: CSS の `rgb(...)` 文字列。
 */
function colorForAchievement(fraction) {
  const f = Math.max(0, Math.min(1, fraction));
  for (let i = 1; i < ACHIEVEMENT_COLOR_STOPS.length; i += 1) {
    const [prevPos, prevRgb] = ACHIEVEMENT_COLOR_STOPS[i - 1];
    const [pos, rgb] = ACHIEVEMENT_COLOR_STOPS[i];
    if (f <= pos) {
      const t = (f - prevPos) / (pos - prevPos);
      const mixed = prevRgb.map((c, ch) => Math.round(c + (rgb[ch] - c) * t));
      return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
    }
  }
  const last = ACHIEVEMENT_COLOR_STOPS[ACHIEVEMENT_COLOR_STOPS.length - 1][1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
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
 * 行テキストを、足場になる「文字のかたまり」ごとに分割して描画する。
 *
 * 空白（半角・全角）の連続を区切りとして、文字のかたまりを
 * `data-platform-segment` 付きの `<span>` で包む。足場の当たり判定は
 * この span 単位で実測するため、テキストに空白を入れるとそこが
 * すり抜けられる隙間になる（空白そのものは足場にならない）。
 *
 * Args:
 *     text (string): 行の表示テキスト。
 *
 * Returns:
 *     Array<React.ReactNode>: 空白（生文字列）と足場 span が交互に
 *         並んだ描画用ノード列。
 */
function renderLineSegments(text) {
  return text.split(/([ \u3000]+)/).map((chunk, index) => {
    if (chunk === '') {
      return null;
    }
    if (/^[ \u3000]+$/.test(chunk)) {
      return chunk;
    }
    return (
      <span key={index} data-platform-segment="">
        {renderLineText(chunk)}
      </span>
    );
  });
}

/**
 * エンディングロール画面（クレジットの上を歩く足場ゲーム付き）。
 *
 * エンディング紙芝居のあとに表示する。HTML 風に組んだクレジットの行が
 * 下から上へゆっくり流れ、プレイヤーは主人公を操作して行の上に乗り続ける。
 * 行はコードのインデント・空行・長さの違いがそのまま足場配置になっており、
 * 行の種類（`buildCreditLines` の `kind`）で乗れるかどうかが変わる：
 * タグ行（金色）と日本語行（白）は乗れる足場、コメント行（グレー）は
 * すり抜ける。乗れる行でも、テキスト中の空白（半角・全角）の部分は
 * 足場が無く、空白を広く（プレイヤー幅の 30px より広く）あけると
 * そこをすり抜けて下へ降りられる。相棒のフロチャロボは当たり判定なしで
 * 主人公に浮遊追従する。
 *
 * 遊びの目的はコイン集め。行のあいだに配置されたコイン（`{}` 型）に
 * 触れると取得でき、HUD とリザルトパネルに「あつめた コイン n / 全数」が
 * 出る。行の横位置（`x`）とコインの座標は `data/ending_credits.json` が
 * 持ち、配置エディタ（`CreditsEditorScreen`、隠しコマンド `wqedit`）で
 * ドラッグして調整する。
 *
 * 画面の下へ落ちても負けにはならず、数秒（`RESPAWN_DELAY_MS`）の待ち時間の
 * あと、そのとき画面内に見えているいちばん上の足場へ復活する。落ちている
 * あいだもクレジットは流れ続け、落ちた回数は成績として数える。成績は
 * コイン数・「のれてた わりあい」（ロール全体の時間のうち足場へ乗れて
 * いた時間の割合。0% から積み上がる加点方式）・「おちた かず」で表示する。
 * Q 長押しでいつでもスキップできる。
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
 *         onFinish (function): リザルトの決定ボタンで呼ぶ（引数なし）。
 *             本編モード（`onReplay` なし）ではボタンは「つぎへ すすむ」で、
 *             親（`App`）がエピローグ会話（`EpilogueScreen`、次回作の予告）へ
 *             進める。再プレイモードでは「タイトルに もどる」になる。
 *             マップへ戻る道は作らない。
 *         onReplay (function, optional): 渡すと再プレイモードになり、
 *             リザルトが「もういちど あそぶ」（このハンドラ）と
 *             「タイトルに もどる」（`onFinish`）の 2 ボタンに変わる。
 *             タイトルの「エンディングゲームで あそぶ」から開いたときに
 *             使い、エピローグ会話へは進まない。
 *         testLines (Array, optional): テストプレイ用の行データ（プレース
 *             ホルダ未置換のまま渡してよい）。省略時は `ending_credits.json`。
 *         testCoins (Array, optional): テストプレイ用のコイン配置。
 *         testStartY (number, optional): テストプレイの開始位置（ワールド
 *             座標の px。エディタのキャンバスのスクロール位置をそのまま
 *             渡す）。0 以下なら通常どおり最初から始める。主人公は開始
 *             画面内で見えるいちばん上の乗れる行の上に出現する。
 *         onExitTest (function, optional): テストモードでエディタへ戻るとき
 *             に呼ぶ（引数なし）。渡すとテストモードになる。
 *
 * Returns:
 *     JSX.Element: エンディングロール画面全体の要素。
 */
function CreditsScreen({
  onFinish,
  onReplay = null,
  testLines = null,
  testCoins = null,
  testStartY = 0,
  onExitTest = null,
}) {
  const isTestMode = onExitTest !== null;
  /* 'intro'（操作説明・スクロール前）→ 'playing' → 'finished' */
  const [phase, setPhase] = useState('intro');
  const [isFallen, setIsFallen] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [finalRate, setFinalRate] = useState(0);
  const [finalCoins, setFinalCoins] = useState(0);
  const [finalDeaths, setFinalDeaths] = useState(0);

  const rootRef = useRef(null);
  const worldRef = useRef(null);
  const playerRef = useRef(null);
  const roboRef = useRef(null);
  const hudRateRef = useRef(null);
  const hudCoinsRef = useRef(null);
  const hudDeathsRef = useRef(null);
  /* 復活までの残り秒数の表示（落下中のヒント内。rAF で直接更新）。 */
  const respawnCountRef = useRef(null);
  /* Q 長押しの進捗を示す円メーター。塗りはループ内で conic-gradient 更新。 */
  const skipMeterRef = useRef(null);
  /* リザルトのカウントアップ表示（数値と達成度の色を rAF で直接更新）。 */
  const resultCoinsRef = useRef(null);
  const resultRateRef = useRef(null);
  const resultDeathsRef = useRef(null);
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
   * 行まるごとではなく、空白で区切られた文字のかたまり
   * （`data-platform-segment` の span）1 つが足場 1 枚。テキストに
   * 空白を入れるとそこは足場が無くなり、すり抜けて降りられる。
   * 幅は文字数や font-size に依存するため、レイアウト確定後の
   * `offsetLeft` / `offsetWidth` で測る（キャストのスプライトは
   * absolute 配置なので幅に影響しない）。
   */
  useLayoutEffect(() => {
    const platforms = [];
    lines.forEach((line, index) => {
      const el = lineElsRef.current[index];
      if (!el || (line.kind !== 'tag' && line.kind !== 'text')) {
        return;
      }
      el.querySelectorAll('[data-platform-segment]').forEach((segment) => {
        platforms.push({
          x: el.offsetLeft + segment.offsetLeft,
          top: index * LINE_STEP_PX + PLATFORM_INSET_PX,
          width: segment.offsetWidth,
        });
      });
    });
    platformsRef.current = platforms;
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

    /*
     * スクロールの開始位置。通常は最初の行が画面下寄りに来る位置から。
     * エディタのテストプレイ（`testStartY` > 0）では、エディタで見えていた
     * 場所（キャンバスのスクロール位置＝画面上端のワールド座標）から始める。
     */
    let startScrollY =
      isTestMode && testStartY > 0 ? testStartY : -viewportH() * 0.62;

    /*
     * 出現する足場。開始画面内（上端マージンより下〜画面の上から 3/4）に
     * 見えている、いちばん上の乗れる行を選ぶ。横位置が画面外の行は除く。
     * 画面内に無ければ、それより下で最初に現れる行まで探し、そこが画面の
     * 下すぎる場合はスクロール開始位置のほうを行が見える所まで調整する
     * （プレイヤーが必ず地面の上から始められることを最優先にする）。
     */
    const minSpawnTop = startScrollY + TOP_MARGIN_PX + PLAYER_HEIGHT_PX + 4;
    const reachable = platformsRef.current.filter(
      (p) => p.x < viewportW() - 60 && p.top >= minSpawnTop,
    );
    const spawnPlatform = reachable.find(
      (p) => p.top <= startScrollY + viewportH() * 0.75,
    ) ??
      reachable[0] ?? {
        x: FALLBACK_LINE_X_PX,
        top: startScrollY + viewportH() * 0.6,
        width: 200,
      };
    if (spawnPlatform.top > startScrollY + viewportH() * 0.8) {
      startScrollY = spawnPlatform.top - viewportH() * 0.6;
    }

    /*
     * ロール全体の再生時間（ms）。スクロールの開始位置から終了位置までを
     * 速度で割って出す。「のれてた わりあい」の分母で、乗れている時間が
     * 積み上がるほど 0% から 100% へ増えていく（途中スタートのテスト
     * プレイでは残り区間が分母になる）。
     */
    const lastLineY = (lines.length - 1) * LINE_STEP_PX;
    const totalPlayMs = Math.max(
      ((lastLineY - viewportH() * 0.45 - startScrollY) / SCROLL_SPEED_PX_S) *
        1000,
      1000,
    );
    const game = {
      phase: 'intro',
      scrollY: startScrollY,
      player: {
        x: Math.max(
          PLAYER_WIDTH_PX,
          Math.min(
            spawnPlatform.x + Math.min(80, spawnPlatform.width * 0.4),
            viewportW() - PLAYER_WIDTH_PX,
          ),
        ),
        y: spawnPlatform.top,
        vy: 0,
        facing: 'right',
        onGround: true,
      },
      robo: { x: 0, y: 0, initialized: false },
      keys: { left: false, right: false },
      skipDownAtMs: null,
      elapsedMs: 0,
      survivedMs: 0,
      isFallen: false,
      fallenAtMs: null,
      deathCount: 0,
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
      setFinalDeaths(game.deathCount);
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
      } else if ((event.key === 'q' || event.key === 'Q') && !event.repeat) {
        game.skipDownAtMs = performance.now();
      }
    };
    const handleKeyUp = (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'a') {
        game.keys.left = false;
      } else if (event.key === 'ArrowRight' || event.key === 'd') {
        game.keys.right = false;
      } else if (event.key === 'q' || event.key === 'Q') {
        game.skipDownAtMs = null;
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
       * Q 長押しスキップ。押している間は円メーターを時計回りに満たし、
       * 一周（SKIP_HOLD_MS）でロールを終了する。離すとメーターは消える。
       */
      if (skipMeterRef.current) {
        if (game.skipDownAtMs !== null) {
          const progress = Math.min(
            1,
            (nowMs - game.skipDownAtMs) / SKIP_HOLD_MS,
          );
          skipMeterRef.current.style.opacity = '1';
          skipMeterRef.current.style.background = `conic-gradient(#f0c040 ${
            progress * 360
          }deg, rgba(245, 240, 224, 0.18) 0deg)`;
        } else {
          skipMeterRef.current.style.opacity = '0';
        }
      }
      if (game.skipDownAtMs !== null && nowMs - game.skipDownAtMs >= SKIP_HOLD_MS) {
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

        /* 画面下へ落ちたら「おちた」扱いにして復活待ちへ。 */
        if (player.y - game.scrollY > viewportH() + FALL_MARGIN_PX) {
          game.isFallen = true;
          game.fallenAtMs = nowMs;
          game.deathCount += 1;
          setIsFallen(true);
        } else if (game.phase === 'playing') {
          game.survivedMs += dt * 1000;
        }
      } else {
        /*
         * 復活の処理。ヒントの残り秒数を更新しつつ、待ち時間が過ぎたら
         * そのとき画面内に見えているいちばん上の乗れる足場へ戻す。
         * 画面内に足場が無いあいだは、現れるまで待ち続ける。
         */
        if (respawnCountRef.current && game.fallenAtMs !== null) {
          const remainSec = Math.max(
            1,
            Math.ceil((RESPAWN_DELAY_MS - (nowMs - game.fallenAtMs)) / 1000),
          );
          respawnCountRef.current.textContent = String(remainSec);
        }
        if (
          game.fallenAtMs !== null &&
          nowMs - game.fallenAtMs >= RESPAWN_DELAY_MS
        ) {
          const minTop = game.scrollY + TOP_MARGIN_PX + PLAYER_HEIGHT_PX + 4;
          const maxTop = game.scrollY + viewportH() * 0.75;
          const target = platformsRef.current.find(
            (p) => p.top >= minTop && p.top <= maxTop && p.x < viewportW() - 60,
          );
          if (target) {
            const half = PLAYER_WIDTH_PX / 2;
            player.x = Math.max(
              half,
              Math.min(
                target.x + Math.min(80, target.width * 0.4),
                viewportW() - half,
              ),
            );
            player.y = target.top;
            player.vy = 0;
            player.onGround = true;
            /* ロボは復活地点へ瞬間移動させる（画面外から飛んでこないように）。 */
            game.robo.initialized = false;
            game.isFallen = false;
            game.fallenAtMs = null;
            setIsFallen(false);
          }
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
      if (hudDeathsRef.current) {
        hudDeathsRef.current.textContent = String(game.deathCount);
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

  /*
   * リザルトの数値演出。コイン数・「のれてた わりあい」・「おちた かず」を
   * 0 から最終値までイーズアウトでカウントアップし、その時点の達成度に
   * 応じて文字色をグレー → 白 → 金のグラデーションでなめらかに変えていく
   * （おちた かずは少ないほど金に近づく）。毎フレームの更新は ref の
   * textContent / style 直接更新で行う。
   */
  useEffect(() => {
    if (!showResult) {
      return undefined;
    }
    const startMs = performance.now();
    let rafId = null;
    const tick = (nowMs) => {
      const t = Math.min(1, (nowMs - startMs) / RESULT_COUNT_UP_MS);
      const eased = 1 - (1 - t) ** 3;
      const coinValue = Math.round(finalCoins * eased);
      const rateValue = Math.round(finalRate * eased);
      const deathValue = Math.round(finalDeaths * eased);
      if (resultCoinsRef.current) {
        resultCoinsRef.current.textContent = String(coinValue);
        resultCoinsRef.current.style.color = colorForAchievement(
          coins.length > 0 ? coinValue / coins.length : 0,
        );
      }
      if (resultRateRef.current) {
        resultRateRef.current.textContent = `${rateValue}%`;
        resultRateRef.current.style.color = colorForAchievement(rateValue / 100);
      }
      if (resultDeathsRef.current) {
        resultDeathsRef.current.textContent = String(deathValue);
        resultDeathsRef.current.style.color = colorForAchievement(
          Math.max(0, 1 - deathValue / 4),
        );
      }
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [showResult, finalCoins, finalRate, finalDeaths, coins.length]);

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
              {renderLineSegments(line.text)}
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
        <span className={styles.hudDivider}> / </span>
        おちた かず <span ref={hudDeathsRef}>0</span>
      </div>

      {phase === 'intro' && (
        <div className={styles.introHint}>
          ← → で うごく / スペースで ジャンプ! コインを あつめよう!
        </div>
      )}

      {isFallen && phase !== 'finished' && (
        <div className={styles.fallenHint}>
          おっこちちゃった! あと{' '}
          <span ref={respawnCountRef}>{Math.ceil(RESPAWN_DELAY_MS / 1000)}</span>{' '}
          びょうで ふっかつするよ
        </div>
      )}

      {phase !== 'finished' && (
        <>
          <div className={styles.skipMeter} ref={skipMeterRef} aria-hidden="true" />
          <div className={styles.skipHint}>Q ながおしで とばす</div>
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
                あつめた コイン{' '}
                <span className={styles.resultValue} ref={resultCoinsRef}>
                  0
                </span>{' '}
                / {coins.length}
              </p>
              <p className={styles.resultRate}>
                のれてた わりあい{' '}
                <span className={styles.resultValue} ref={resultRateRef}>
                  0%
                </span>
              </p>
              <p className={styles.resultRate}>
                おちた かず{' '}
                <span className={styles.resultValue} ref={resultDeathsRef}>
                  0
                </span>
              </p>
              <div className={styles.resultButtons}>
                {isTestMode ? (
                  <button
                    type="button"
                    className={styles.resultButton}
                    onClick={onExitTest}
                  >
                    エディタへ もどる
                  </button>
                ) : onReplay !== null ? (
                  <>
                    <button
                      type="button"
                      className={styles.resultButton}
                      onClick={onReplay}
                    >
                      もういちど あそぶ
                    </button>
                    <button
                      type="button"
                      className={styles.resultButton}
                      onClick={onFinish}
                    >
                      タイトルに もどる
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.resultButton}
                    onClick={onFinish}
                  >
                    つぎへ すすむ ▶
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
