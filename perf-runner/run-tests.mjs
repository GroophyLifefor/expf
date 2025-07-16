import { exec, execSync } from 'child_process';
import { writeFileSync, readdirSync, statSync } from 'fs';
import os from 'os';
import { performance } from 'perf_hooks';

const PACKAGE_NAME = process.env.PACKAGE_NAME;
const TEST_DIR = process.env.TEST_DIR || 'expf-tests'; // fixed, always expf-tests
const RESULT_UPLOAD_URL = process.env.RESULT_UPLOAD_URL;

if (!PACKAGE_NAME) throw new Error('PACKAGE_NAME env var not set!');

const tempDir = '/tmp/perf-test';

// Get all subfolders (tests) inside TEST_DIR
function getTestFolders(path) {
  return readdirSync(path).filter(name => {
    const fullPath = `${path}/${name}`;
    return statSync(fullPath).isDirectory();
  });
}

async function runTest(label, installCommand, testSubfolder) {
  console.log(`\n--- Running test for: ${label} - test folder: ${testSubfolder} ---`);
  execSync(`rm -rf ${tempDir} && mkdir -p ${tempDir}`, { stdio: 'inherit' });
  process.chdir(tempDir);
  execSync(`npm init -y`, { stdio: 'inherit' });
  execSync(installCommand, { stdio: 'inherit' });
  execSync(`npm install autocannon`, { stdio: 'inherit' });
  execSync(`cp -r /app/${TEST_DIR}/${testSubfolder}/* .`, { stdio: 'inherit' });

  const start = performance.now();
  execSync(`node run-test.mjs ${label}`, { stdio: 'inherit' });
  const end = performance.now();

  const result = {
    schemaVersion: '1.0.0',
    timestamp: Date.now(),
    runMetadata: {
      repo: `https://github.com/expressjs/${PACKAGE_NAME}`,
      gitRef: process.env.GIT_REF || 'unknown',
      toolSettings: {
        connections: 10,
        duration: 10,
      },
    },
    serverMetadata: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus(),
      totalmem: os.totalmem(),
    },
    clientMetadata: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus(),
    },
    serverResults: {
      executionTimeMs: end - start,
    },
    clientResults: {
      latency: {
        averageMs: 0, // TODO: parse from autocannon output if needed
      },
    },
  };

  const filename = `result-${label}-${testSubfolder}-${Date.now()}.json`;
  writeFileSync(filename, JSON.stringify(result, null, 2));
  console.log(`Saved result to: ${filename}`);

  if (RESULT_UPLOAD_URL) {
    execSync(
      `curl -X POST -H "Content-Type: application/json" -d @${filename} ${RESULT_UPLOAD_URL}`
    );
    console.log('Result uploaded.');
  }
}

async function main() {
  const testFolders = getTestFolders(`/app/${TEST_DIR}`);

  for (const testSubfolder of testFolders) {
    runTest('latest', `npm install ${PACKAGE_NAME}@latest`, testSubfolder);
    runTest('candidate', `npm install /app`, testSubfolder);
  }
}

main();
