import { GDriveAdapter } from './adapters/gdrive-adapter';
import type { IPushAdapter, IPullAdapter } from './adapter-types';

// Compile-time type check: ensure GDriveAdapter conforms to new adapter capability interfaces.
// This file is intentionally minimal and only exists so `tsc` verifies types during build.
const _gdriveAsPush: IPushAdapter = new GDriveAdapter(undefined);
const _gdriveAsPull: IPullAdapter = new GDriveAdapter(undefined);

export { _gdriveAsPush, _gdriveAsPull };
