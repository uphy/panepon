import Phaser from "phaser";
import { CELL, GARBAGE_COLOR, GARBAGE_DARK, KIND_COLORS, KIND_NAMES } from "./theme";
import { DPR } from "./hidpi";

function shade(color: number, factor: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const r = Math.min(255, Math.round(c.red * factor));
  const g = Math.min(255, Math.round(c.green * factor));
  const b = Math.min(255, Math.round(c.blue * factor));
  return Phaser.Display.Color.GetColor(r, g, b);
}

function drawSymbol(g: Phaser.GameObjects.Graphics, name: string, cx: number, cy: number, r: number): void {
  g.fillStyle(0xffffff, 1);
  switch (name) {
    case "heart": {
      g.fillCircle(cx - r * 0.45, cy - r * 0.3, r * 0.5);
      g.fillCircle(cx + r * 0.45, cy - r * 0.3, r * 0.5);
      g.fillTriangle(cx - r * 0.92, cy - r * 0.1, cx + r * 0.92, cy - r * 0.1, cx, cy + r * 0.95);
      break;
    }
    case "circle":
      g.fillCircle(cx, cy, r * 0.8);
      break;
    case "triangle":
      g.fillTriangle(cx, cy - r * 0.9, cx - r * 0.9, cy + r * 0.7, cx + r * 0.9, cy + r * 0.7);
      break;
    case "invtriangle":
      g.fillTriangle(cx, cy + r * 0.9, cx - r * 0.9, cy - r * 0.7, cx + r * 0.9, cy - r * 0.7);
      break;
    case "star": {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r * 0.95 : r * 0.42;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad));
      }
      g.fillPoints(pts, true);
      break;
    }
    case "diamond":
      g.fillPoints(
        [
          new Phaser.Math.Vector2(cx, cy - r * 0.95),
          new Phaser.Math.Vector2(cx + r * 0.7, cy),
          new Phaser.Math.Vector2(cx, cy + r * 0.95),
          new Phaser.Math.Vector2(cx - r * 0.7, cy),
        ],
        true,
      );
      break;
  }
}

/**
 * パネル・おじゃま・カーソルのテクスチャを Graphics から生成する。画像ファイルは使わない。
 * 高解像度端末でぼやけないよう DPR 倍の大きさで生成する。使う側は Image を 1/DPR に縮める。
 */
export function createTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false).setScale(DPR);
  const tex = (key: string, w: number, h: number): void => {
    g.generateTexture(key, Math.ceil(w * DPR), Math.ceil(h * DPR));
  };
  const pad = 1;
  const size = CELL - pad * 2;

  KIND_COLORS.forEach((color, kind) => {
    for (const variant of ["", "-dark", "-bright"] as const) {
      g.clear();
      const base = variant === "-dark" ? shade(color, 0.45) : variant === "-bright" ? shade(color, 1.6) : color;
      g.fillStyle(shade(base, 0.7), 1);
      g.fillRoundedRect(pad, pad, size, size, 5);
      g.fillStyle(base, 1);
      g.fillRoundedRect(pad + 1, pad + 1, size - 2, size - 4, 5);
      g.fillStyle(shade(base, 1.25), 1);
      g.fillRoundedRect(pad + 3, pad + 3, size - 6, 5, 3);
      if (variant !== "-dark") drawSymbol(g, KIND_NAMES[kind], CELL / 2, CELL / 2 + 1, CELL * 0.3);
      tex(`panel-${kind}${variant}`, CELL, CELL);
    }
  });

  // ビックリパネル。灰色の地に「！」。通常の柄とは揃わない対戦専用のパネル。
  for (const variant of ["", "-dark", "-bright"] as const) {
    g.clear();
    const base = variant === "-dark" ? 0x46464f : variant === "-bright" ? 0xd0d0dc : 0x9a9aa8;
    g.fillStyle(shade(base, 0.7), 1);
    g.fillRoundedRect(pad, pad, size, size, 5);
    g.fillStyle(base, 1);
    g.fillRoundedRect(pad + 1, pad + 1, size - 2, size - 4, 5);
    g.fillStyle(shade(base, 1.25), 1);
    g.fillRoundedRect(pad + 3, pad + 3, size - 6, 5, 3);
    if (variant !== "-dark") {
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(CELL / 2 - 3, 7, 6, 13, 2);
      g.fillCircle(CELL / 2, 25, 3.2);
    }
    tex(`panel-6${variant}`, CELL, CELL);
  }

  // ビックリパネルで送る灰色のおじゃま。石模様で通常のおじゃまと区別する。
  g.clear();
  g.fillStyle(0x4a4a52, 1);
  g.fillRect(0, 0, CELL, CELL);
  g.fillStyle(0x767680, 1);
  g.fillRect(1, 1, CELL - 2, CELL - 2);
  g.fillStyle(0x5c5c66, 1);
  g.fillRect(1, 15, CELL - 2, 2);
  g.fillRect(15, 1, 2, 14);
  g.fillRect(7, 17, 2, 14);
  g.fillRect(23, 17, 2, 14);
  g.fillStyle(0x8a8a96, 1);
  g.fillRect(3, 3, 10, 3);
  g.fillRect(19, 3, 10, 3);
  g.fillRect(11, 19, 10, 3);
  tex("garbage-shock", CELL, CELL);

  // おじゃま（通常）。ブロックの端を判別できるよう、単セルの繰り返し柄で描く。
  g.clear();
  g.fillStyle(GARBAGE_DARK, 1);
  g.fillRect(0, 0, CELL, CELL);
  g.fillStyle(GARBAGE_COLOR, 1);
  g.fillRect(1, 1, CELL - 2, CELL - 2);
  g.fillStyle(shade(GARBAGE_COLOR, 1.2), 1);
  g.fillRect(3, 3, CELL - 6, 4);
  g.fillStyle(GARBAGE_DARK, 1);
  g.fillRect(6, 14, CELL - 12, 4);
  tex("garbage", CELL, CELL);

  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, CELL, CELL);
  tex("white", CELL, CELL);

  // カーソル（横2マス）
  g.clear();
  const w = CELL * 2 + 6;
  const h = CELL + 6;
  g.lineStyle(3, 0xffffff, 1);
  const corner = 9;
  for (const [x, y, dx, dy] of [
    [0, 0, 1, 1],
    [w, 0, -1, 1],
    [0, h, 1, -1],
    [w, h, -1, -1],
  ]) {
    g.beginPath();
    g.moveTo(x, y + dy * corner);
    g.lineTo(x, y);
    g.lineTo(x + dx * corner, y);
    g.strokePath();
  }
  g.lineStyle(3, 0xffffff, 1);
  g.beginPath();
  g.moveTo(w / 2, 0);
  g.lineTo(w / 2, 4);
  g.moveTo(w / 2, h);
  g.lineTo(w / 2, h - 4);
  g.strokePath();
  tex("cursor", w + 1, h + 1);

  g.destroy();
}
