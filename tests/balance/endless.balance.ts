import { describe, expect, it } from "vitest";
import { Board } from "../../src/core";
import { casualPlayer } from "../../tools/sim/proxy";

/**
 * エンドレスの1回の長さ。遅い CPU（人の代わり）で 4〜10 分に収まること。
 * スマホで1回を短く遊べる長さにしてあり、計測時は 403〜509 秒（seed 1〜3）。
 * レベルの上がり方（PANELS_PER_LEVEL / FRAMES_PER_LEVEL）やせり上がり曲線を変えたときにここが動く。
 */
describe("バランス: エンドレス", () => {
  it("遅い CPU の生存時間が 4〜10 分に収まる", () => {
    for (const seed of [1, 2, 3]) {
      const b = new Board({ seed, speedLevel: 1, speedUp: true });
      const cpu = casualPlayer(b);
      for (let f = 0; f < 60 * 60 * 15 && !b.gameOver; f++) b.tick(cpu.next());
      const sec = b.frame / 60;
      expect(b.gameOver, `seed=${seed} は15分で終わらない`).toBe(true);
      expect(sec, `seed=${seed} 生存 ${sec.toFixed(0)}s`).toBeGreaterThanOrEqual(240);
      expect(sec, `seed=${seed} 生存 ${sec.toFixed(0)}s`).toBeLessThanOrEqual(600);
    }
  });
});
