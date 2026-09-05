import { expect, test } from "@playwright/test";

test("開始時に 3・2・1 のカウントダウンがあり、その間はゲームが進まない", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?mode=endless&seed=7&bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
  await page.waitForTimeout(800);
  const during = await page.evaluate(() => {
    const p = (window as any).__panepon;
    return { starting: p.scene.starting, frame: p.game.boards[0].frame };
  });
  expect(during.starting).toBe(true);
  expect(during.frame).toBe(0);

  await page.waitForFunction(() => !(window as any).__panepon.scene.starting, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => (window as any).__panepon.game.boards[0].frame);
  expect(after).toBeGreaterThan(0);
  expect(errors.filter((e) => !e.includes("drawImage"))).toEqual([]);
});
