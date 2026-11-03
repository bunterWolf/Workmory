import fs from 'fs';
import os from 'os';
import path from 'path';

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workmory-settings-'));

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => userDataDir) },
}), { virtual: true });

import { SettingsManager } from './SettingsManager';

const settingsFile = path.join(userDataDir, 'settings.json');
const writeSettings = (data: object) => fs.writeFileSync(settingsFile, JSON.stringify(data), 'utf8');

describe('SettingsManager themeMode', () => {
  afterEach(() => {
    try { fs.unlinkSync(settingsFile); } catch (e) { /* not created */ }
  });

  afterAll(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  test('defaults to system without a settings file', () => {
    expect(new SettingsManager().getThemeMode()).toBe('system');
  });

  test('loads a saved light or dark mode', () => {
    writeSettings({ themeMode: 'dark' });
    expect(new SettingsManager().getThemeMode()).toBe('dark');
    writeSettings({ themeMode: 'light' });
    expect(new SettingsManager().getThemeMode()).toBe('light');
  });

  test('ignores an unknown saved value', () => {
    writeSettings({ themeMode: 'blue' });
    expect(new SettingsManager().getThemeMode()).toBe('system');
  });

  test('persists a changed mode without touching other settings', () => {
    writeSettings({ allowPrerelease: true, autoLaunchEnabled: true, activityStoreDirPath: null });
    new SettingsManager().setThemeMode('dark');
    const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    expect(saved).toEqual({ activityStoreDirPath: null, allowPrerelease: true, autoLaunchEnabled: true, themeMode: 'dark' });
    expect(new SettingsManager().getThemeMode()).toBe('dark');
  });
});
