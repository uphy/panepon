/**
 * localStorage のキーの移行。旧名称のキー（panepon.*）に残っている記録・設定を新名称のキー（swaprise.*）へ写す。
 * 新キーに値があるときは触らず、写し終えた旧キーは消す。localStorage が使えない環境では何もしない。
 */
const OLD_PREFIX = "panepon.";
const NEW_PREFIX = "swaprise.";

export function migrateLegacyStorage(storage: Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">): void {
  const oldKeys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k?.startsWith(OLD_PREFIX)) oldKeys.push(k);
  }
  for (const oldKey of oldKeys) {
    const newKey = NEW_PREFIX + oldKey.slice(OLD_PREFIX.length);
    const value = storage.getItem(oldKey);
    if (value !== null && storage.getItem(newKey) === null) storage.setItem(newKey, value);
    storage.removeItem(oldKey);
  }
}

try {
  migrateLegacyStorage(localStorage);
} catch {
  // プライベートモードなどで localStorage が使えない。記録は残らないが動作には影響しない
}
