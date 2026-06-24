import { readFileSync, existsSync } from "fs";

const envPath = ".env.local";
if (!existsSync(envPath)) {
  console.log("FILE_NOT_FOUND");
  process.exit(0);
}

const content = readFileSync(envPath, "utf-8");
const parsed = {};
for (const line of content.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  parsed[key] = val;
}

const keys = [
  "LLM_PROVIDER",
  "VOLCENGINE_API_KEY",
  "VOLCENGINE_BASE_URL",
  "VOLCENGINE_MODEL",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
];

for (const k of keys) {
  const v = parsed[k];
  const status = v && v.length > 0 ? "EXISTS" : "MISSING";
  console.log(`${k}:${status}`);
}
