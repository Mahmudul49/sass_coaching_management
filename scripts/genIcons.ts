/**
 * Generate the PWA raster icons from public/icon.svg.
 * Run: npx tsx scripts/genIcons.ts
 *
 * Produces: icon-192.png, icon-512.png (purpose "any"),
 *           icon-maskable-512.png (icon at 80% on a solid safe-zone bg),
 *           apple-touch-icon.png (180, flattened — iOS needs an opaque PNG).
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import { join } from "path";

const pub = join(process.cwd(), "public");
const svg = readFileSync(join(pub, "icon.svg"));
const BG = "#0A5A4E"; // matches the icon's darker gradient stop

async function render(size: number, out: string, flatten = false) {
  let img = sharp(svg).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (flatten) img = img.flatten({ background: BG });
  await img.png().toFile(join(pub, out));
  console.log(`  ✓ ${out}  ${size}x${size}${flatten ? " (opaque)" : ""}`);
}

async function maskable(size: number, out: string) {
  const inner = Math.round(size * 0.8); // safe zone: content within central 80%
  const pad = Math.round((size - inner) / 2);
  const icon = await sharp(svg).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: icon, top: pad, left: pad }])
    .png()
    .toFile(join(pub, out));
  console.log(`  ✓ ${out}  ${size}x${size} (maskable, safe-zone)`);
}

async function main() {
  await render(192, "icon-192.png");
  await render(512, "icon-512.png");
  await maskable(512, "icon-maskable-512.png");
  await render(180, "apple-touch-icon.png", true);
  console.log("✅ PWA icons generated");
}

main().catch((e) => {
  console.error("❌ icon generation failed:", e);
  process.exit(1);
});
