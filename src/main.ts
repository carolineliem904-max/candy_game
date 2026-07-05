import Phaser from "phaser";
import { BoardScene } from "./scenes/BoardScene";
import { LevelMapScene } from "./scenes/LevelMapScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { GAME_HEIGHT, GAME_WIDTH } from "./scenes/layout";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#8ecbe8",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [PreloadScene, LevelMapScene, BoardScene],
});
