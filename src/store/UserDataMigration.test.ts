import fs from 'fs';
import os from 'os';
import path from 'path';
import { migrateLegacyUserData, MIGRATED_FILES } from './UserDataMigration';

let root: string;
let legacyDir: string;
let newDir: string;

const write = (dir: string, file: string, content: string) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), content, 'utf8');
};
const read = (dir: string, file: string) => fs.readFileSync(path.join(dir, file), 'utf8');

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-hours-migration-'));
  legacyDir = path.join(root, 'Workmory');
  newDir = path.join(root, 'Missing Hours');
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test('copies settings and activity data from the old folder into a new folder that does not exist yet', () => {
  write(legacyDir, 'settings.json', '{"themeMode":"dark"}');
  write(legacyDir, 'chronflow-activity-store.json', '{"days":{}}');

  expect(migrateLegacyUserData(legacyDir, newDir).sort()).toEqual([...MIGRATED_FILES].sort());

  expect(read(newDir, 'settings.json')).toBe('{"themeMode":"dark"}');
  expect(read(newDir, 'chronflow-activity-store.json')).toBe('{"days":{}}');
});

test('leaves the old folder untouched as a backup', () => {
  write(legacyDir, 'settings.json', 'S');
  write(legacyDir, 'chronflow-activity-store.json', 'D');

  migrateLegacyUserData(legacyDir, newDir);

  expect(read(legacyDir, 'settings.json')).toBe('S');
  expect(read(legacyDir, 'chronflow-activity-store.json')).toBe('D');
});

test('copies into an existing new folder that only holds other files (e.g. the instance lock)', () => {
  write(newDir, 'lockfile', '');
  write(legacyDir, 'chronflow-activity-store.json', 'D');

  expect(migrateLegacyUserData(legacyDir, newDir)).toEqual(['chronflow-activity-store.json']);
  expect(read(newDir, 'chronflow-activity-store.json')).toBe('D');
});

test('copies only the files that exist in the old folder', () => {
  write(legacyDir, 'settings.json', '{"activityStoreDirPath":"C:\\\\Data"}');

  expect(migrateLegacyUserData(legacyDir, newDir)).toEqual(['settings.json']);
  expect(fs.existsSync(path.join(newDir, 'chronflow-activity-store.json'))).toBe(false);
});

test('does nothing once the new folder has activity data, and never overwrites it', () => {
  write(legacyDir, 'settings.json', 'old settings');
  write(legacyDir, 'chronflow-activity-store.json', 'old data');
  write(newDir, 'chronflow-activity-store.json', 'new data');

  expect(migrateLegacyUserData(legacyDir, newDir)).toEqual([]);
  expect(read(newDir, 'chronflow-activity-store.json')).toBe('new data');
  expect(fs.existsSync(path.join(newDir, 'settings.json'))).toBe(false);
});

test('does nothing once the new folder has settings', () => {
  write(legacyDir, 'chronflow-activity-store.json', 'old data');
  write(newDir, 'settings.json', 'new settings');

  expect(migrateLegacyUserData(legacyDir, newDir)).toEqual([]);
  expect(fs.existsSync(path.join(newDir, 'chronflow-activity-store.json'))).toBe(false);
});

test('does nothing without an old folder', () => {
  expect(migrateLegacyUserData(legacyDir, newDir)).toEqual([]);
  expect(fs.existsSync(newDir)).toBe(false);
});

test('does nothing when both paths are the same folder', () => {
  write(legacyDir, 'settings.json', 'S');
  expect(migrateLegacyUserData(legacyDir, legacyDir)).toEqual([]);
});

test('leaves no temporary files behind', () => {
  write(legacyDir, 'settings.json', 'S');
  write(legacyDir, 'chronflow-activity-store.json', 'D');

  migrateLegacyUserData(legacyDir, newDir);

  expect(fs.readdirSync(newDir).sort()).toEqual([...MIGRATED_FILES].sort());
});
