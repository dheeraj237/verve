/** Jest config for TypeScript project using ts-jest */
const common = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^dexie$': '<rootDir>/node_modules/rxdb/node_modules/dexie/dist/dexie.js'
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  // Transform rxdb/dexie ESM sources in node_modules so Jest can parse them.
  transformIgnorePatterns: ['node_modules/(?!(rxdb|dexie)/)'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  forceExit: true
};

module.exports = {
  projects: [
    {
      displayName: 'unit',
      ...common,
      // Unit tests should not automatically enable a fake indexedDB by de
      // default, but load our common test shims early so `indexedDB` exists
      // before any module imports that may initialize RxDB.
      testPathIgnorePatterns: ['/tests/integration/', '/tests/e2e/', '\\.integration\\.test\\.'],
      // Load minimal IndexedDB shim early (runs before modules are imported).
      setupFiles: ['<rootDir>/src/setupIndexedDBEnv.ts'],
      // Provide unit-specific mocks after env setup.
      setupFilesAfterEnv: ['<rootDir>/src/setupUnitMocks.ts'],
      moduleNameMapper: {
        '^@/core/rxdb/rxdb-client$': '<rootDir>/src/__mocks__/rxdb-client-mock.ts',
        '^@/(.*)$': '<rootDir>/src/$1'
      }
    },
    {
      displayName: 'integration',
      ...common,
      testEnvironment: 'jsdom',
      // Integration tests need a DOM-like indexedDB provided by
      // `fake-indexeddb/auto` so RxDB can initialize against `indexedDB`.
      // Load fake-indexeddb and ensure a clean DB before integration tests.
      setupFiles: ['<rootDir>/src/setupIndexedDBEnv.ts', '<rootDir>/src/setupIntegrationEnv.ts', '<rootDir>/src/setupNodeEnv.ts'],
      // Match both dedicated `tests/integration` folder and any files named
      // `*.integration.test.*` located under `src` or elsewhere.
      testMatch: [
        '<rootDir>/tests/integration/**/?(*.)+(spec|test).[tj]s?(x)',
        '**/*.integration.test.[tj]s?(x)'
      ]
    }
  ]
};
