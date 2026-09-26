// Test the CLI directly with a fake client that times out
// We'll monkey-patch the module to inject the failure
import { createRequire } from 'node:module';

// Override the fake client's serve function to timeout on getReleaseByTag
const require = createRequirement(import.meta.url);

// Actually, let's just test by running the CLI with a modified fixture
// Simpler: test the decide() function directly which we already confirmed throws

import { decide } from './release-close.js';
import { readFileSync } from 'node:fs';

const snapshot = JSON.parse(readFileSync('./fixtures/reference.json', 'utf-8'));

// Test 1: timeout on getReleaseByTag through decide()
console.log('=== Test 1: timeout on getReleaseByTag ===');
try {
  const client = {
    ...(await import('./fake-client.js')).makeFakeClient(snapshot),
  };
  // We can't modify the fake client's methods directly, so let's use failurePlan
  // Actually, decide() doesn't accept failurePlan for camadaDeDecisao path
  // Let me check the failurePlan parameter
} catch (e) {
  console.log('Setup error:', e.message);
}

// Test 2: Check the actual CLI behavior by calling runReleaseClose
console.log('=== Test 2: CLI path ===');
// The CLI entry point is at the bottom of release-close.js
// We need to test it differently since runReleaseClose is not exported
