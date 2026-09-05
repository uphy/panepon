import { expect, test } from "@playwright/test";

test("ゲームオーバー後に Esc でメニューへ戻る", async ({ page }) => {
  await page.goto("/?mode=endless&seed=3&bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
  await page.evaluate(() => {
    const b = (window as any).__panepon.game.boards[0];
    const col: number[] = [];
    for (let r = 0; r < 12; r++) col.push(r % 2);
    b.setColumns([col]);
  });
  await page.waitForFunction(() => (window as any).__panepon.game.finished);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const active = await page.evaluate(() => {
    const s = (window as any).__panepon.scene;
    return s.scene.manager.getScenes(true).map((x: any) => x.scene.key);
  });
  expect(active).toEqual(["menu"]);
});
