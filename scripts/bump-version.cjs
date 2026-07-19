/**
 * 三处版本同步唯一入口:package.json → src-tauri/Cargo.toml + src-tauri/tauri.conf.json。
 * 用法:node scripts/bump-version.cjs <patch|minor|major|x.y.z>
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
const confPath = path.join(root, "src-tauri", "tauri.conf.json");

const arg = process.argv[2];
if (!arg) {
  console.error("用法:node scripts/bump-version.cjs <patch|minor|major|x.y.z>");
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const cur = pkg.version.split(".").map(Number);
let next;
if (arg === "patch") next = [cur[0], cur[1], cur[2] + 1].join(".");
else if (arg === "minor") next = [cur[0], cur[1] + 1, 0].join(".");
else if (arg === "major") next = [cur[0] + 1, 0, 0].join(".");
else if (/^\d+\.\d+\.\d+$/.test(arg)) next = arg;
else {
  console.error(`非法版本参数:${arg}`);
  process.exit(1);
}

pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const cargo = fs.readFileSync(cargoPath, "utf-8");
fs.writeFileSync(cargoPath, cargo.replace(/^version = "[^"]+"/m, `version = "${next}"`));

const conf = JSON.parse(fs.readFileSync(confPath, "utf-8"));
conf.version = next;
fs.writeFileSync(confPath, JSON.stringify(conf, null, 2) + "\n");

console.log(`版本已同步为 ${next}(package.json / Cargo.toml / tauri.conf.json)`);
