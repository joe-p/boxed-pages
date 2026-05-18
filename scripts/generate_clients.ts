import { spawn } from "node:child_process";
import { glob } from "node:fs";
import Fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUT_DIR = path.join(__dirname, "..", "contracts", "out");
const CLIENTS_DIR = path.join(__dirname, "..", "contracts", "clients");

const TS_NOCHECK = "// @ts-nocheck\n";

async function generateClient(file: string) {
  const contractName = path.basename(file).replace(".arc56.json", "");
  const clientPath = path.join(CLIENTS_DIR, `${contractName}Client.ts`);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "npx",
      [
        "algokit-client-generator",
        "generate",
        "-a",
        path.join(OUT_DIR, file),
        "-o",
        clientPath,
      ],
      { stdio: "inherit" },
    );
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`algokit-client-generator exited with code ${code}`));
    });
    proc.on("error", reject);
  });

  // Prepend @ts-nocheck to the generated file
  const content = await Fs.readFile(clientPath, "utf-8");
  if (!content.startsWith(TS_NOCHECK)) {
    await Fs.writeFile(clientPath, TS_NOCHECK + content);
  }
}

glob("*.arc56.json", { cwd: OUT_DIR }, (err, matches) => {
  if (err) throw err;
  Promise.all(matches.map(generateClient)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
});
