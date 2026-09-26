// Test the crash scenario: timeout on getReleaseByTag through the production path
import { makeFakeClient } from './fake-client.js';
import { decide } from './release-close.js';
import { readFileSync } from 'node:fs';

const snapshot = JSON.parse(readFileSync('./fixtures/reference.json', 'utf-8'));

// Create client that times out on getReleaseByTag
const client = makeFakeClient(snapshot, { getReleaseByTag: ['timeout'] });

console.log('Testing decide() with timeout on getReleaseByTag...');
try {
  const result = await decide({ snapshot, client });
  console.log('Result:', JSON.stringify(result.classification));
} catch (err) {
  console.log('CRASH:', err.name, '-', err.message);
  console.log('Stack (first 5 lines):');
  console.log(err.stack.split('\n').slice(0, 5).join('\n'));
}
