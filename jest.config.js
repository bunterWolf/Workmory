module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Confine test discovery to the src tree, and match with a *relative*
  // testMatch pattern. Both halves matter:
  //   - `roots` stops Jest from ever crawling outside src — notably it never
  //     descends into '.claude/worktrees/<name>', so a checkout that lives next
  //     to sibling worktrees doesn't pick up duplicate test copies.
  //   - The relative pattern (no leading '<rootDir>/') is matched against the
  //     path relative to rootDir. An absolute '<rootDir>/src/**' pattern is
  //     matched against the full filesystem path, where micromatch's default
  //     `dot: false` refuses to descend through a dot-directory segment (e.g. a
  //     worktree at '.claude/worktrees/<name>') — silently matching 0 tests
  //     while still exiting non-zero. The relative form avoids that entirely.
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/*.test.(ts|js)',
  ],
  // transform: {
  //   '^.+\\.(ts|tsx)?$': 'ts-jest',
  // },
  // Dateien, die Jest ignorieren soll
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  // Verzeichnisse für Modultransformationen
  transform: {},

  // Zeige Details zu jedem Test
  verbose: true
}; 