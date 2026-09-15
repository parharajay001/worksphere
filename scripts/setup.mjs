import { copyFileSync, constants } from "node:fs";

try {
  copyFileSync(
    new URL("../.env.example", import.meta.url),
    new URL("../.env.local", import.meta.url),
    constants.COPYFILE_EXCL,
  );
  console.log("Created .env.local. Start WorkSphere with npm run dev.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(
    "Kept your existing .env.local. Start WorkSphere with npm run dev.",
  );
}
