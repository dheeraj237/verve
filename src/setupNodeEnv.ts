// Polyfill IndexedDB for RxDB/Dexie in Jest Node environment
try {
  // eslint-disable-next-line global-require
  require('fake-indexeddb/auto');
} catch (err) {
  // ignore if unavailable
}

// Register common RxDB plugins for the test/runtime environment so the
// library has the expected hooks available during tests.
try {
  // eslint-disable-next-line global-require
  const { addRxPlugin } = require('rxdb');
  // eslint-disable-next-line global-require
  const { RxDBLeaderElectionPlugin } = require('rxdb/plugins/leader-election');
  // eslint-disable-next-line global-require
  const { RxDBJsonDumpPlugin } = require('rxdb/plugins/json-dump');
  // eslint-disable-next-line global-require
  const { RxDBMigrationPlugin } = require('rxdb/plugins/migration');
  // eslint-disable-next-line global-require
  const { RxDBQueryBuilderPlugin } = require('rxdb/plugins/query-builder');

  addRxPlugin(RxDBLeaderElectionPlugin);
  addRxPlugin(RxDBJsonDumpPlugin);
  addRxPlugin(RxDBMigrationPlugin);
  addRxPlugin(RxDBQueryBuilderPlugin);
} catch (e) {
  // If plugins are unavailable during static analysis, ignore — tests that
  // specifically need plugins import and register them themselves.
}

process.on('unhandledRejection', (reason) => {
  // Ensure we see details of unhandled rejections happening during test load
  // eslint-disable-next-line no-console
  console.error('Global UnhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('Global UncaughtException:', err);
  throw err;
});
