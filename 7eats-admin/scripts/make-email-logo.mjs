// One-off: rasterize the brand wordmark SVG to a retina PNG for use in emails
// (email clients don't render SVG). Output is committed to public/.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// sharp is a transitive (pnpm) dep, so resolve it from its real .pnpm location.
const require = createRequire(import.meta.url);
const sharp = require(
  new URL(
    "../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp",
    import.meta.url,
  ).pathname.replace(/^\//, ""),
);

const src = new URL("../public/7eats-logo.svg", import.meta.url);
const outWordmark = new URL("../public/7eats-logo-email.png", import.meta.url);

const svg = readFileSync(src);

// Render at 2x the largest display height we use (~32px) for crisp retina.
const TARGET_HEIGHT = 64;

const info = await sharp(svg, { density: 384 })
  .resize({ height: TARGET_HEIGHT })
  .png()
  .toFile(outWordmark.pathname.replace(/^\//, ""));

console.log("wordmark", `${info.width}x${info.height}`);
