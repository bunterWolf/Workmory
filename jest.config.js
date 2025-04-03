module.exports = {
  // Die Testumgebung
  testEnvironment: 'node',

  // Dateien, die Jest ignorieren soll
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  // Dateiendungen, die Jest als Tests erkennen soll
  testMatch: ['**/*.test.js'],

  // Verzeichnisse für Modultransformationen
  transform: {},

  // Zeige Details zu jedem Test
  verbose: true
}; 