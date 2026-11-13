import { initializeLogger } from '@livekit/agents';

initializeLogger({ pretty: false, level: 'error' });
await import('./provider-check.mjs');
