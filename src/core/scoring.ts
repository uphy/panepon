import { SCORE_CAP } from "./constants";

/** パネル1枚あたりの得点。 */
export const POINTS_PER_PANEL = 10;

/**
 * 同時消しボーナス（SFC版、ファンサイトの実測値）。
 * 表にない個数は前後から補間している。31個は実機のバグで0点。
 */
const COMBO_BONUS: Record<number, number> = {
  4: 20, 5: 30, 6: 50, 7: 60, 8: 70, 9: 80, 10: 100, 11: 140, 12: 170,
  13: 210, 14: 250, 15: 290, 16: 340, 17: 390, 18: 440, 19: 490, 20: 550,
  21: 620, 22: 690, 23: 760, 24: 830, 25: 900,
  26: 990, 27: 1080, 28: 1160, 29: 1250, 30: 1330,
  31: 0,
};

export function comboBonus(panels: number): number {
  if (panels < 4) return 0;
  if (panels >= 32) return 33_300;
  return COMBO_BONUS[panels] ?? 0;
}

/** 連鎖ボーナス。14連鎖以降は容量の都合で0点（実機仕様）。 */
const CHAIN_BONUS: Record<number, number> = {
  2: 50, 3: 80, 4: 150, 5: 300, 6: 400, 7: 500, 8: 700, 9: 900,
  10: 1100, 11: 1300, 12: 1500, 13: 1800,
};

export function chainBonus(chain: number): number {
  if (chain < 2) return 0;
  return CHAIN_BONUS[chain] ?? 0;
}

/** 1回の消去で入る得点。 */
export function matchScore(panels: number, chain: number): number {
  return panels * POINTS_PER_PANEL + comboBonus(panels) + chainBonus(chain);
}

export function capScore(score: number): number {
  return Math.min(SCORE_CAP, score);
}
