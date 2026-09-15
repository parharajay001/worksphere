import { appendFileSync, copyFileSync, constants, readFileSync } from "node:fs";

const examplePath = new URL("../.env.example", import.meta.url);
const localPath = new URL("../.env.local", import.meta.url);

try {
  copyFileSync(examplePath, localPath, constants.COPYFILE_EXCL);
  console.log("Created .env.local. Run npm run db:setup, then npm run dev.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  const existing = readFileSync(localPath, "utf8");
  const existingKeys = new Set(
    [...existing.matchAll(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/gm)].map(
      (match) => match[1],
    ),
  );
  const additions = readFileSync(examplePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => {
      const key = line.match(/^([A-Z_][A-Z0-9_]*)=/)?.[1];
      return key && !existingKeys.has(key);
    });
  if (additions.length) {
    appendFileSync(
      localPath,
      `${existing.endsWith("\n") ? "" : "\n"}\n# New local defaults from .env.example\n${additions.join("\n")}\n`,
    );
    console.log(
      `Added missing configuration keys: ${additions.map((line) => line.split("=")[0]).join(", ")}. Existing values were preserved.`,
    );
  } else {
    console.log(
      "Kept your existing .env.local; no configuration keys were missing.",
    );
  }
}
