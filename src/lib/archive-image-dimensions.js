import { readFileSync } from "node:fs";
import { join } from "node:path";

const cache = new Map();
export function imageDimensions(src) {
  if (!src || !src.startsWith("/img/work/archive/")) return {};
  if (cache.has(src)) return cache.get(src);
  let result = {};
  try {
    const buffer = readFileSync(join(process.cwd(), "public", src.slice(1)));
    if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
      const format = buffer.toString("ascii", 12, 16);
      if (format === "VP8X") {
        result = {width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1};
      } else if (format === "VP8L") {
        result = {
          width: 1 + buffer[21] + ((buffer[22] & 63) << 8),
          height: 1 + ((buffer[22] >> 6) | (buffer[23] << 2) | ((buffer[24] & 15) << 10))
        };
      } else if (format === "VP8 ") {
        result = {width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff};
      }
    } else if (buffer.toString("ascii", 1, 4) === "PNG") {
      result = {width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20)};
    }
    if (!(result.width > 0 && result.height > 0)) throw new Error("Could not read image dimensions");
  } catch (error) {
    throw new Error(`Archive image is missing or invalid: ${src}: ${error.message}`);
  }
  cache.set(src, result);
  return result;
}
