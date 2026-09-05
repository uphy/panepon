import { expect, test } from "@playwright/test";

test("メニューから始めたゲームを Esc で抜けると、メニューが描画されて再度始められる", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?bgm=0");
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const active = () =>
    page.evaluate(() => (window as any).__panepon.scene.scene.manager.getScenes(true).map((s: any) => s.scene.key));
  expect(await active()).toEqual(["menu"]);
  expect(errors).toEqual([]);
  // メニューが動いている（カーソル移動と再開始ができる）
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  expect(await active()).toEqual(["game"]);
  const mode = await page.evaluate(() => (window as any).__panepon.game.mode);
  expect(mode).toBe("cpu");
  expect(errors).toEqual([]);
});

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
