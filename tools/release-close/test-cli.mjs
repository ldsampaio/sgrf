// Test the crash scenario through the full CLI entry point
import { runReleaseClose } from './release-close.js';

const io = {
  stdin: { on: () => {}, setEncoding: () => {}, resume: () => {}, pause: () => {} },
  stdout: { write: (s) => process.stdout.write(s) },
  stderr: { write: (s) => process.stderr.write(s) },
};

console.log('Testing CLI verify with timeout on getReleaseByTag...');
try {
  const exitCode = await runReleaseClose(['verify', '--version', 'v0.1.1'], io);
  console.log('Exit code:', exitCode);
} catch (err) {
  console.log('UNHANDLED CRASH:', err.name, '-', err.message);
}
