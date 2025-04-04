module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Explicitly tell Jest to look for .js and .ts test files in the src directory
  testMatch: [
    '<rootDir>/src/**/*.test.(ts|js)',
  ],
  // Optional: Add other Jest configurations as needed
  // roots: [
  //   '<rootDir>/src'
  // ],
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