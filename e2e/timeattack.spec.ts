import { expect, test } from "@playwright/test";

test("タイムアタック: 残り時間を表示し、時間切れで TIME UP と記録が残る", async ({ page }) => {
  await page.goto("/?mode=timeattack&seed=7&bgm=0&countdown=0&time=3");
  await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => {
    const p = (window as any).__panepon;
    return { limit: p.game.timeLimit, text: p.scene.views[0].infoText.text, boards: p.game.boards.length };
  });
  expect(info.limit).toBe(180);
  expect(info.boards).toBe(1);
  expect(info.text).toMatch(/^00:0[123]\s+SPEED 1/);

  await page.waitForFunction(() => (window as any).__panepon.game.finished, null, { timeout: 10_000 });
  const result = await page.evaluate(() => {
    const p = (window as any).__panepon;
    const v = p.scene.views[0];
    return {
      timeUp: p.game.timeUp,
      gameOver: p.game.boards[0].gameOver,
      title: v.overlayTitle.text,
      time: v.infoText.text.slice(0, 5),
      stored: JSON.parse(localStorage.getItem("panepon.highscores.v1") ?? "{}"),
    };
  });
  expect(result.timeUp).toBe(true);
  expect(result.gameOver).toBe(false);
  expect(result.title).toBe("TIME UP");
  expect(result.time).toBe("00:00");
  expect(result.stored.timeattack).toHaveLength(1);
  expect(result.stored.endless ?? []).toHaveLength(0);
});
