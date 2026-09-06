/**
 * ゲーム中に画面が暗くならないようにする（Screen Wake Lock API）。
 * 連鎖を眺めている間や、指を離して考えている間にスリープしないため。
 * 画面が隠れると OS がロックを外すので、戻ってきたら取り直す。未対応のブラウザでは何もしない。
 */
export class WakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;
  private readonly onVisible = (): void => {
    if (this.wanted && document.visibilityState === "visible") void this.acquire();
  };

  get supported(): boolean {
    return typeof navigator !== "undefined" && "wakeLock" in navigator;
  }

  /** ロックを取る。取れるまで（画面が見えるまで）保持する意思を覚えておく。 */
  async request(): Promise<void> {
    if (!this.supported) return;
    if (!this.wanted) {
      this.wanted = true;
      document.addEventListener("visibilitychange", this.onVisible);
    }
    await this.acquire();
  }

  /** ロックを外し、以後は取り直さない。 */
  release(): void {
    this.wanted = false;
    document.removeEventListener("visibilitychange", this.onVisible);
    void this.sentinel?.release();
    this.sentinel = null;
  }

  private async acquire(): Promise<void> {
    if (this.sentinel && !this.sentinel.released) return;
    try {
      this.sentinel = await navigator.wakeLock.request("screen");
    } catch {
      // 省電力モードや画面が見えていないときは拒否される。次に見えたときに取り直す
      this.sentinel = null;
    }
  }
}

export const wakeLock = new WakeLock();
