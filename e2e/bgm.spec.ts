import { expect, test, type Page } from "@playwright/test";

/** document.hidden を偽装して visibilitychange を投げる。Phaser はこれを見て "hidden" / "visible" を出す。 */
async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((h) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

function bgmState(page: Page) {
  return page.evaluate(() => {
    const a = (window as any).__paneponAudio;
    return { playing: a.bgm?.playing ?? null, danger: a.danger, tempo: a.bgm?.tempoScale ?? 1 };
  });
}

test("危険状態で速くなった曲は、終了後とメニューでは元のテンポに戻る", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__panepon?.game));
  // AudioContext はユーザー操作のあとでしか動かないので、1回クリックしてから始める
  await page.mouse.click(10, 10);
  await page.waitForTimeout(300);
  expect((await bgmState(page)).playing).toBe("game");

  // 上2段にパネルを入れて危険状態にする
  await page.evaluate(() => {
    const b = (window as any).__panepon.game.boards[0];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0], [1], [2], [3], [4], [0]]);
  });
  await page.waitForTimeout(300);
  const danger = await bgmState(page);
  expect(danger.danger).toBe(true);
  expect(danger.tempo).toBeGreaterThan(1);

  // 天井まで積んで終わらせる
  await page.evaluate(() => {
    const b = (window as any).__panepon.game.boards[0];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1], [1], [2], [3], [4], [0]]);
  });
  await page.waitForFunction(() => (window as any).__panepon.game.finished, null, { timeout: 15_000 });
  await page.waitForTimeout(200);
  const ended = await bgmState(page);
  expect(ended.playing).toBeNull();
  expect(ended.danger).toBe(false);
  expect(ended.tempo).toBe(1);

  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const menu = await bgmState(page);
  expect(menu.playing).toBe("menu");
  expect(menu.danger).toBe(false);
  expect(menu.tempo).toBe(1);
});

test("メニューで画面が隠れると曲が止まり、戻ると鳴り直す", async ({ page }) => {
  await page.goto("/?countdown=0");
  await page.mouse.click(10, 10);
  await page.waitForTimeout(300);
  expect((await bgmState(page)).playing).toBe("menu");

  await setHidden(page, true);
  await page.waitForTimeout(400);
  expect((await bgmState(page)).playing).toBeNull();

  await setHidden(page, false);
  await page.waitForTimeout(300);
  expect((await bgmState(page)).playing).toBe("menu");
});
