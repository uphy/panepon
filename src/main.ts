import Phaser from "phaser";
import { GameScene } from "./render/GameScene";
import { MenuScene } from "./render/MenuScene";
import { BG_COLOR, layoutFor } from "./render/theme";
import { DPR, installHiDpiText } from "./render/hidpi";

installHiDpiText();
const layout = layoutFor("menu");

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: layout.width * DPR,
  height: layout.height * DPR,
  backgroundColor: BG_COLOR,
  pixelArt: false,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { gamepad: true, activePointers: 4 },
  scene: [MenuScene, GameScene],
});
