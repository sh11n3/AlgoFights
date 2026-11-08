import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
for (const directory of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  const source = fileURLToPath(
    new URL(`../node_modules/pdfjs-dist/${directory}/`, import.meta.url),
  );
  const target = fileURLToPath(
    new URL(`../public/pdf-assets/${directory}/`, import.meta.url),
  );
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
}
await cp(
  new URL("../node_modules/pdfjs-dist/LICENSE", import.meta.url),
  new URL("../public/pdf-assets/LICENSE", import.meta.url),
);
