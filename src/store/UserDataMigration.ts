import * as fs from 'fs';
import * as path from 'path';

// The app was called Workmory before. Electron names the userData folder after the `name` in
// package.json (there is no top-level productName), so the data of earlier versions lies in a folder
// with this name next to the new one (`missing-hours`).
export const LEGACY_USER_DATA_DIR_NAME = 'workmory';

// The files the app itself keeps in userData. Chromium's own files there are not taken over.
export const MIGRATED_FILES = ['settings.json', 'chronflow-activity-store.json'];

/**
 * Copies the app's files from the old Workmory data folder into the new userData folder, once.
 * Runs only while the new folder holds none of these files, so it never overwrites data written
 * under the new name. The old folder stays untouched as a backup.
 * All files are first copied to temporary names and only then renamed, so an interrupted copy
 * never leaves a half-written file under a real name. Throws if copying fails.
 * @returns the names of the copied files (empty if there was nothing to migrate)
 */
export function migrateLegacyUserData(legacyDir: string, userDataDir: string): string[] {
  if (path.resolve(legacyDir) === path.resolve(userDataDir)) return [];
  if (MIGRATED_FILES.some(file => fs.existsSync(path.join(userDataDir, file)))) return [];

  const files = MIGRATED_FILES.filter(file => fs.existsSync(path.join(legacyDir, file)));
  if (files.length === 0) return [];

  fs.mkdirSync(userDataDir, { recursive: true });
  const tempPath = (file: string) => path.join(userDataDir, `${file}.migrating-${process.pid}`);
  try {
    for (const file of files) fs.copyFileSync(path.join(legacyDir, file), tempPath(file));
  } catch (error) {
    for (const file of files) fs.rmSync(tempPath(file), { force: true });
    throw error;
  }
  for (const file of files) fs.renameSync(tempPath(file), path.join(userDataDir, file));
  return files;
}
