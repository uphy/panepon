import { GameAudio } from "./audio";

/** シーン間で共有する音声。?bgm=0 で BGM を止められる（e2e 用）。 */
export const audio = new GameAudio();
audio.bgmEnabled = new URLSearchParams(location.search).get("bgm") !== "0";
