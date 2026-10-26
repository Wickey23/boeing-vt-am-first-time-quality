/** Small dependency-free, uncompressed ZIP writer for ASCII-named research exports. */
export function zipTextFiles(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const all: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (a: Uint8Array, i: number, v: number) => new DataView(a.buffer).setUint16(i, v, true);
  const u32 = (a: Uint8Array, i: number, v: number) => new DataView(a.buffer).setUint32(i, v >>> 0, true);
  function crc32(data: Uint8Array) {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let n = 0; n < 8; n++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  for (const [name, body] of Object.entries(files)) {
    if (!/^[a-z0-9][a-z0-9_.-]{0,99}$/i.test(name)) throw new Error("Invalid archive file name.");
    const filename = encoder.encode(name), data = encoder.encode(body), crc = crc32(data);
    if (data.length > 10000000) throw new Error("Export exceeds safe size.");
    const local = new Uint8Array(30 + filename.length + data.length);
    u32(local, 0, 0x04034b50); u16(local, 4, 20); u16(local, 6, 0x0800); u16(local, 8, 0);
    u32(local, 14, crc); u32(local, 18, data.length); u32(local, 22, data.length); u16(local, 26, filename.length);
    local.set(filename, 30); local.set(data, 30 + filename.length);
    const dir = new Uint8Array(46 + filename.length);
    u32(dir, 0, 0x02014b50); u16(dir, 4, 20); u16(dir, 6, 20); u16(dir, 8, 0x0800);
    u16(dir, 10, 0); u32(dir, 16, crc); u32(dir, 20, data.length); u32(dir, 24, data.length);
    u16(dir, 28, filename.length); u32(dir, 42, offset); dir.set(filename, 46);
    all.push(local); central.push(dir); offset += local.length;
  }
  const centralBytes = central.reduce((sum, f) => sum + f.length, 0);
  const end = new Uint8Array(22);
  u32(end, 0, 0x06054b50); u16(end, 8, central.length); u16(end, 10, central.length);
  u32(end, 12, centralBytes); u32(end, 16, offset);
  const combined = new Uint8Array(offset + centralBytes + end.length);
  let i = 0;
  for (const part of [...all, ...central, end]) { combined.set(part, i); i += part.length; }
  return combined;
}
