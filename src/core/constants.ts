/** 盤面サイズ。行は下から数える（row 0 が最下段）。 */
export const COLS = 6;
export const ROWS = 12;
/** 可視領域より上に確保する行数。おじゃまパネルの投下に使う。 */
export const EXTRA_ROWS = 14;
export const TOTAL_ROWS = ROWS + EXTRA_ROWS;

/** 種類数。5種が既定、高難度で6種目（逆さんかく）が混ざる。 */
export const DEFAULT_KINDS = 5;
export const MAX_KINDS = 6;

/** フレーム数ベースのタイミング（60fps想定）。 */
export const TIMING = {
  /** 入れ替えにかかるフレーム数。原作の4フレームに合わせる。 */
  swap: 4,
  /** 入れ替えで空中に出たパネルが落ち始めるまでの猶予。 */
  hoverSwap: 8,
  /** 消去でできた空間に落ちるパネルの猶予（即落下）。 */
  hoverClear: 0,
  /** おじゃまパネルが落ち始めるまでの猶予。 */
  hoverGarbage: 6,
  /** 1段落ちるのにかかるフレーム数。 */
  fallPerRow: 2,
  /** 消去時の点滅時間。 */
  flash: 24,
  /** 点滅後、1枚ずつ消えていく間隔。 */
  popInterval: 8,
  /** 最後の1枚が消えてから上のパネルが落ち始めるまで。 */
  popTail: 6,
  /** おじゃま変身の点滅時間。 */
  transformFlash: 24,
  /** 変身で1マスずつパネル柄が現れる間隔。 */
  transformInterval: 6,
  /** 変身完了後、落ちてくるまでの間隔（難易度で変わる）。 */
  transformHover: 16,
  /** 手動せり上げで1段上がるのにかかるフレーム数。 */
  manualRisePerRow: 4,
  /** 天井に触れてからゲームオーバーになるまでの猶予。 */
  deathGrace: 60,
  /** おじゃま着地時の揺れ。厚さ1段あたりのフレーム数。 */
  shakePerRow: 8,
  /** 同時消しによるせり上がり停止。4個で base、以降 1個ごとに perExtra。 */
  stopComboBase: 60,
  stopComboPerExtra: 20,
  /** 連鎖によるせり上がり停止。2連鎖で base、以降 1連鎖ごとに perExtra。 */
  stopChainBase: 120,
  stopChainPerExtra: 60,
  stopMax: 720,
  /** 危険状態（天井接触）で消したときの停止時間の倍率。 */
  stopDangerMultiplier: 2,
} as const;

/** 危険状態（BGM切り替え）とみなす高さ。この行以上にパネルがあると危険。 */
export const DANGER_ROW = ROWS - 2;

/** 得点の上限（SFC版）。 */
export const SCORE_CAP = 99_999;

/** せり上がり速度。スピードレベルから「1段上がるのに要するフレーム数」を返す。 */
export function riseFramesPerRow(level: number): number {
  const lv = Math.min(99, Math.max(1, level));
  return Math.max(12, Math.round(600 * Math.pow(0.955, lv - 1)));
}

/** エンドレスでスピードレベルが1上がるのに必要な消去枚数。 */
export const PANELS_PER_LEVEL = 20;
