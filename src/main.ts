import Phaser from "phaser";
import { GameScene } from "./render/GameScene";
import { MenuScene } from "./render/MenuScene";
import { BG_COLOR, layoutFor } from "./render/theme";

const layout = layoutFor("menu");

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: layout.width,
  height: layout.height,
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
