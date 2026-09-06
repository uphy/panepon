import Phaser from "phaser";
import type { Layout } from "./theme";

/**
 * 高解像度端末（スマホの devicePixelRatio 2〜3）でぼやけないための仕組み。
 *
 * Phaser 4 の Game Config には解像度の設定がなく、論理サイズの canvas を CSS で引き伸ばすだけになる。
 * そこで canvas は論理サイズ × DPR で作り、カメラの zoom を DPR にして論理座標をそのまま使えるようにする。
 * テクスチャは DPR 倍の大きさで生成して Image を 1/DPR に縮め、Text は resolution を DPR にする。
 *
 * 入力座標は Pointer の worldX / worldY（カメラ変換後）を使う。x / y は canvas 座標なので DPR 倍になっている。
 */
export const DPR: number = (() => {
  if (typeof window === "undefined") return 1;
  return Math.min(3, Math.max(1, Math.ceil(window.devicePixelRatio || 1)));
})();

/** 論理サイズのレイアウトを canvas とカメラに反映する。シーンの create() とリサイズ時に呼ぶ。 */
export function applyLayout(scene: Phaser.Scene, layout: Layout): void {
  // Scale.FIT の displaySize は最初に決めた縦横比を resize() でも変えない。
  // 縦持ち → 横持ちで論理サイズの比が変わるときは、先に比を入れ直さないと canvas が細長いまま中央に残る。
  scene.scale.displaySize.setAspectRatio(layout.width / layout.height);
  scene.scale.resize(layout.width * DPR, layout.height * DPR);
  const cam = scene.cameras.main;
  cam.setZoom(DPR);
  cam.centerOn(layout.width / 2, layout.height / 2);
}

/**
 * scene.add.text() が作る Text の resolution を既定で DPR にする。
 * 呼び出し側は今までどおり論理 px でフォントサイズを指定すればよい。
 */
export function installHiDpiText(): void {
  const factory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (x: number, y: number, text: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text;
  };
  const original = factory.text;
  factory.text = function (this: Phaser.GameObjects.GameObjectFactory, x, y, text, style) {
    return original.call(this, x, y, text, { resolution: DPR, ...style });
  };
}
