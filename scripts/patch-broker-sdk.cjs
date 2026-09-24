const fs = require("fs");
const path = require("path");

const pnpmDir = path.join(process.cwd(), "node_modules", ".pnpm");

if (!fs.existsSync(pnpmDir)) {
  console.log("[patch-broker-sdk] node_modules/.pnpm not found; skipping.");
  process.exit(0);
}

const packageDirs = fs.readdirSync(pnpmDir, { withFileTypes: true })
  .filter((entry) =>
    entry.isDirectory() &&
    entry.name.startsWith("@luxalgo+broker-sdk@0.3.0")
  )
  .map((entry) =>
    path.join(
      pnpmDir,
      entry.name,
      "node_modules",
      "@luxalgo",
      "broker-sdk",
      "dist",
      "chunk-JAL36ZHN.js"
    )
  )
  .filter((file) => fs.existsSync(file));

if (packageDirs.length === 0) {
  console.log("[patch-broker-sdk] broker-sdk chunk not found; skipping.");
  process.exit(0);
}

let changed = 0;

for (const file of packageDirs) {
  let source = fs.readFileSync(file, "utf8");

  source = source.replace(
    "const { apiKey, apiSecret } = credentials;",
    'const { apiKey, apiSecret, marketType = "linear" } = credentials;'
  );

  source = source.replace(
    "const allExecutions = [];\n  let windowStart = historyStart;",
    'const allExecutions = [];\n  const category = marketType === "spot" ? "spot" : "linear";\n  let windowStart = historyStart;'
  );

  source = source.replace(
    'category: "linear",',
    "category,"
  );

  if (!source.includes('marketType = "linear"')) {
    throw new Error(
      `[patch-broker-sdk] Could not patch expected credentials line: ${file}`
    );
  }

  if (!source.includes('marketType === "spot" ? "spot" : "linear"')) {
    throw new Error(
      `[patch-broker-sdk] Could not add Spot category selection: ${file}`
    );
  }

  fs.writeFileSync(file, source, "utf8");
  changed += 1;
  console.log(`[patch-broker-sdk] Patched: ${file}`);
}

console.log(`[patch-broker-sdk] Complete. Checked/patched ${changed} file(s).`);