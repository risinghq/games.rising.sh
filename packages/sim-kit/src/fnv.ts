const buf = new DataView(new ArrayBuffer(8));

/**
 * FNV-1a over the bytes of numbers and strings. A game folds its state into
 * one and compares the hex digest between runs, so any drift shows up as a
 * different string. Saved records pin digests: never change the byte order or
 * the constants.
 */
export class Fnv {
  h = 0x811c9dc5;
  num(n: number): void {
    buf.setFloat64(0, n);
    for (let i = 0; i < 8; i++) {
      this.h ^= buf.getUint8(i);
      this.h = Math.imul(this.h, 0x01000193);
    }
  }
  str(s: string): void {
    for (let i = 0; i < s.length; i++) {
      this.h ^= s.charCodeAt(i) & 0xff;
      this.h = Math.imul(this.h, 0x01000193);
    }
  }
  hex(): string {
    return (this.h >>> 0).toString(16).padStart(8, "0");
  }
}
