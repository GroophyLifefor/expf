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
  return readdirSync(path).filter((name) => {
    const fullPath = `${path}/${name}`;
    return statSync(fullPath).isDirectory();
  });
}

async function runTest(label, installCommand, testSubfolder) {
  console.log(
    `\n--- Running test for: ${label} - test folder: ${testSubfolder} ---`
  );
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

  return {
    resultFile: filename,
  };
}

function compareResults(latestFile, candidateFile) {
  const latest = JSON.parse(readFileSync(latestFile, 'utf8'));
  const candidate = JSON.parse(readFileSync(candidateFile, 'utf8'));

  const latestTime = latest.serverResults.executionTimeMs;
  const candidateTime = candidate.serverResults.executionTimeMs;

  console.log('\n--- 📊 Performance Comparison ---');
  console.log(`Latest executionTimeMs:   ${latestTime.toFixed(2)} ms`);
  console.log(`Candidate executionTimeMs: ${candidateTime.toFixed(2)} ms`);

  const diff = latestTime - candidateTime;
  const percent = (diff / latestTime) * 100;

  if (diff > 0) {
    console.log(
      `✅ Candidate is faster by ${Math.abs(diff).toFixed(
        2
      )} ms (${percent.toFixed(2)}%)`
    );
  } else if (diff < 0) {
    console.log(
      `⚠️  Candidate is slower by ${Math.abs(diff).toFixed(2)} ms (${Math.abs(
        percent
      ).toFixed(2)}%)`
    );
  } else {
    console.log('➖ Both versions have the same execution time.');
  }
}

async function main() {
  const testFolders = getTestFolders(`/app/${TEST_DIR}`);

  for (const testSubfolder of testFolders) {
    const { resultFile: latestResult } = runTest(
      'latest',
      `npm install ${PACKAGE_NAME}@latest`,
      testSubfolder
    );
    const { resultFile: candidateResult } = runTest(
      'candidate',
      `npm install /app`,
      testSubfolder
    );

    console.log(`\n--- Comparing results for test folder: ${testSubfolder} ---`);
    compareResults(latestResult, candidateResult);
  }
}

main();
