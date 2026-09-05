/** 描画で共有する寸法と色。 */
export const CELL = 32;
export const BOARD_W = 6 * CELL;
export const BOARD_H = 12 * CELL;

/** 柄ごとの色。原作の柄と色に合わせる。kind 5 は6種目の逆さんかく。 */
export const KIND_COLORS = [0xe0405a, 0x7ad33a, 0x4cc3e8, 0xf2d13b, 0xa25ad6, 0x3b62e0];
export const KIND_NAMES = ["heart", "circle", "triangle", "star", "diamond", "invtriangle"];
export const GARBAGE_COLOR = 0x8a8a96;
export const GARBAGE_DARK = 0x5c5c68;
export const BG_COLOR = 0x14141c;
export const BOARD_BG = 0x1e1e2a;
export const TEXT_COLOR = "#f4f4f8";
export const FONT = '"Menlo", "Consolas", monospace';

export interface Layout {
  width: number;
  height: number;
  portrait: boolean;
  /** タッチ操作用のせり上げボタンを出すか。 */
  touch: boolean;
}

/** タッチ主体の端末か。マウスがあっても touch イベントがあれば true。 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window;
}

/**
 * 画面の向きとモードから論理サイズを決める。Phaser の Scale.FIT がこれを実画面に収める。
 * 縦持ちのスマホでは盤面が画面幅いっぱいになるよう、論理幅を小さくする。
 */
export function layoutFor(mode: "menu" | "endless" | "versus" | "cpu"): Layout {
  const portrait = typeof window !== "undefined" && window.innerHeight > window.innerWidth;
  const touch = isTouchDevice();
  if (portrait) {
    // 対戦は2盤面を並べる。Android の戻るジェスチャ（画面端からの横スワイプ）を盤面のドラッグが踏まないよう、
    // 左右に 33 論理px（実画面で約 29dp）の余白を取る。
    if (mode === "versus" || mode === "cpu") return { width: 470, height: 640, portrait, touch };
    return { width: 300, height: 600, portrait, touch };
  }
  return { width: 800, height: 520, portrait, touch };
}
