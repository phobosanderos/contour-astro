// Generate iOS-compatible PNG favicons from the existing original SVG artwork.
// Run before Astro builds. No source SVGs are altered.
import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const directory = join(process.cwd(), "public", "img");
const sizes = [32, 180, 192];
await mkdir(directory, { recursive: true });
for (const [theme, sourceName, background] of [
  ["light", "favicon-dark.svg", "#f4f4f0"],
  ["dark", "favicon-light.svg", "#0b0b0c"],
]) {
  const svg = await readFile(join(directory, sourceName));
  for (const size of sizes) {
    const inset = size === 32 ? 2 : Math.round(size * 0.10);
    const image = await sharp(svg, { density: 384 })
      .resize(size - inset * 2, size - inset * 2, { fit: "contain" })
      .png()
      .toBuffer();
    const dest = join(directory, `favicon-${size}-${theme}.png`);
    await sharp({
      create: { width: size, height: size, channels: 4, background },
    })
      .composite([{ input: image, left: inset, top: inset }])
      .png()
      .toFile(dest);
    console.log(`Generated ${dest}`);
  }
}
