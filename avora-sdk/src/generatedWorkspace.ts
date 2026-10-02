/** Publish one real generated application at a stable path. No compiler assets. */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { safePath } from "./generation";
const pointerFile = ".avora/generated/current.json";
const journalFile = ".avora/generated/publication.json";
async function exists(file: string) {
  try {
    await fs.lstat(file);
    return true;
  } catch (e: any) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
}
async function json(folder: string, relative: string, value: unknown) {
  const target = await safePath(folder, relative),
    temporary = target + "." + randomUUID();
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}
/** Caller owns the generation lock. Recover an interrupted directory swap before generating again. */
export async function recoverPublication(folder: string) {
  const journal = await safePath(folder, journalFile);
  if (!(await exists(journal))) return;
  const record = JSON.parse(await fs.readFile(journal, "utf8"));
  if (
    !record || typeof record !== "object" ||
    !/^generated\/(fastapi|django|nestjs|spring)$/.test(record.target) ||
    !/^\.avora\/generated\/\.backup-[a-f0-9-]{36}$/.test(record.backup) ||
    typeof record.publication !== "string"
  )
    throw new Error(
      "Invalid generation recovery record. Inspect .avora/generated/publication.json before retrying.",
    );
  const target = await safePath(folder, record.target),
    backup = await safePath(folder, record.backup);
  let current: any;
  try {
    current = JSON.parse(
      await fs.readFile(await safePath(folder, pointerFile), "utf8"),
    );
  } catch {}
  if (current?.publication !== record.publication) {
    if (await exists(backup)) {
      await fs.rm(target, { recursive: true, force: true });
      await fs.rename(backup, target);
    } else if (!record.hadTarget)
      await fs.rm(target, { recursive: true, force: true });
    if (record.previous) await json(folder, pointerFile, record.previous);
  }
  await fs.rm(backup, { recursive: true, force: true });
  await fs.rm(journal, { force: true });
}
export async function publishApplication(
  folder: string,
  stage: string,
  next: Record<string, any>,
  previous: any,
) {
  const target = await safePath(folder, next.directory);
  const generatedRoot = await safePath(folder, "generated");
  await fs.mkdir(generatedRoot, { recursive: true });
  await fs
    .writeFile(await safePath(folder, "generated/.gitignore"), "*\n", {
      flag: "wx",
    })
    .catch((e: any) => {
      if (e.code !== "EEXIST") throw e;
    });
  const hadTarget = await exists(target);
  if (hadTarget && previous?.directory !== next.directory)
    throw new Error(
      `Avora will not replace an unrecognized ${next.directory} folder. Move your existing folder and generate again.`,
    );
  const backup = ".avora/generated/.backup-" + randomUUID();
  next.publication = randomUUID();
  await json(folder, journalFile, {
    target: next.directory,
    backup,
    hadTarget,
    previous: previous || null,
    publication: next.publication,
  });
  try {
    if (hadTarget) await fs.rename(target, await safePath(folder, backup));
    await fs.rename(stage, target);
    await json(folder, pointerFile, next);
  } catch (error) {
    await recoverPublication(folder);
    throw error;
  }
  // A completed pointer is the commit record; delayed cleanup is safe to retry.
  await recoverPublication(folder);
  return target;
}
