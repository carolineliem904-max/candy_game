import Phaser from "phaser";
import { BoardScene } from "./scenes/BoardScene";
import { LevelMapScene } from "./scenes/LevelMapScene";
import { GAME_HEIGHT, GAME_WIDTH } from "./scenes/layout";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1e1a2e",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [LevelMapScene, BoardScene],
});
