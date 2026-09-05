/** 描画で共有する寸法と色。 */
export const CELL = 32;
export const BOARD_W = 6 * CELL;
export const BOARD_H = 12 * CELL;
export const GAME_W = 800;
export const GAME_H = 520;

/** 柄ごとの色。ノートの「柄と色」に合わせる。kind 5 は6種目の逆さんかく。 */
export const KIND_COLORS = [0xe0405a, 0x7ad33a, 0x4cc3e8, 0xf2d13b, 0xa25ad6, 0x3b62e0];
export const KIND_NAMES = ["heart", "circle", "triangle", "star", "diamond", "invtriangle"];
export const GARBAGE_COLOR = 0x8a8a96;
export const GARBAGE_DARK = 0x5c5c68;
export const BG_COLOR = 0x14141c;
export const BOARD_BG = 0x1e1e2a;
export const TEXT_COLOR = "#f4f4f8";
export const FONT = '"Menlo", "Consolas", monospace';
