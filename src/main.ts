import Phaser from "phaser";
import { GameScene } from "./render/GameScene";
import { MenuScene } from "./render/MenuScene";
import { BG_COLOR, GAME_H, GAME_W } from "./render/theme";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: GAME_W,
  height: GAME_H,
  backgroundColor: BG_COLOR,
  pixelArt: false,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { gamepad: true },
  scene: [MenuScene, GameScene],
});
