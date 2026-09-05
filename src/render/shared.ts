import { GameAudio } from "./audio";

/** シーン間で共有する音声。?bgm=0 で BGM を止められる（e2e 用）。 */
export const audio = new GameAudio();
audio.bgmEnabled = new URLSearchParams(location.search).get("bgm") !== "0";

// ブラウザは AudioContext の開始をユーザー操作の中でしか許さない。
// Phaser はキー入力をキューに溜めて次のフレームで処理するので、Phaser のハンドラから start() を呼んでも
// 操作の外になり、Safari では止まったままになる。ここで DOM のイベントを直接受けて操作の中で start() する。
for (const type of ["keydown", "pointerdown", "touchend", "mousedown"] as const) {
  window.addEventListener(type, () => audio.start(), { capture: true, passive: true });
}
