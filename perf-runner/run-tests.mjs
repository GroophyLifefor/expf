import { execSync } from 'child_process';
import { writeFileSync, readdirSync, statSync } from 'fs';
import os from 'os';
import { performance } from 'perf_hooks';
import { readFileSync } from 'fs';

const PACKAGE_NAME = process.env.PACKAGE_NAME;
const TEST_DIR = process.env.TEST_DIR || 'expf-tests'; // expf-tests prefered, optional
const RESULT_UPLOAD_URL = process.env.RESULT_UPLOAD_URL; // optional
const NODE_VERSION = process.env.NODE_VERSION;

if (!PACKAGE_NAME) throw new Error('PACKAGE_NAME env var not set!');
if (!NODE_VERSION) console.warn('NODE_VERSION env var not set, using current Node version!');

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
  const testTempDir = `${tempDir}-${label}-${testSubfolder}`;
  execSync(`rm -rf ${testTempDir} && mkdir -p ${testTempDir}`, { stdio: 'inherit' });
  process.chdir(testTempDir);
  execSync(`npm init -y`, { stdio: 'inherit' });
  execSync(installCommand, { stdio: 'inherit' });
  execSync(`npm install autocannon`, { stdio: 'inherit' });
  execSync(`cp -r /app/${TEST_DIR}/${testSubfolder}/* .`, { stdio: 'inherit' });

  const start = performance.now();
  const output = execSync(`node run-test.mjs ${label}`, { encoding: 'utf8' });
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
        averageMs: 0,
      },
    },
  };

  // between ---start:expf-autocanon-data--- and ---end:expf-autocanon-data---
  const autocannonData = output.match(
    /---start:expf-autocanon-data---([\s\S]*?)---end:expf-autocanon-data---/
  );
  if (!autocannonData) {
    throw new Error('No autocannon data found in output!');
  } else {
    const autocannonOutput = autocannonData[1].trim();
    try {
      const parsedData = JSON.parse(autocannonOutput);
      result.clientResults.latency.averageMs = parsedData.latency.average;
      result.clientResults.requestsPerSecond = parsedData.requests.total / (parsedData.duration / 1000);
      result.clientResults.errors = parsedData.errors;
    } catch (error) {
      console.error('Failed to parse autocannon data:', error);
    }
  }

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

function compareResults(testSubfolder, latestFile, candidateFile) {
  console.log(`\n--- Comparing results for: ${testSubfolder} ---`);
  console.log(`Latest result file: ${latestFile}`);
  console.log(`Candidate result file: ${candidateFile}`);
  const latest = JSON.parse(
    readFileSync(`${tempDir}-latest-${testSubfolder}/${latestFile}`, 'utf8')
  );
  const candidate = JSON.parse(
    readFileSync(`${tempDir}-candidate-${testSubfolder}/${candidateFile}`, 'utf8')
  );

  const latestTime = latest.serverResults.executionTimeMs;
  const candidateTime = candidate.serverResults.executionTimeMs;

  console.log(`\n## 📊 Performance Comparison (Node.js ${NODE_VERSION})\n`);
  
  // Prepare table data
  const tableData = [];
  
  // Execution time comparison
  const timeDiff = latestTime - candidateTime;
  const timePercent = (timeDiff / latestTime) * 100;
  tableData.push([
    'Execution Time (ms)',
    latestTime.toFixed(2),
    candidateTime.toFixed(2),
    timeDiff.toFixed(2),
    `${timePercent.toFixed(2)}%`,
    timeDiff > 0 ? 'Faster' : timeDiff < 0 ? 'Slower' : 'Same'
  ]);

  // Check if both have autocannon data
  const hasLatestAutocannon = latest.clientResults && latest.clientResults.latency && latest.clientResults.requestsPerSecond;
  const hasCandidateAutocannon = candidate.clientResults && candidate.clientResults.latency && candidate.clientResults.requestsPerSecond;

  if (hasLatestAutocannon && hasCandidateAutocannon) {
    // Latency comparison
    const latestLatency = latest.clientResults.latency.averageMs;
    const candidateLatency = candidate.clientResults.latency.averageMs;
    const latencyDiff = latestLatency - candidateLatency;
    const latencyPercent = (latencyDiff / latestLatency) * 100;
    
    tableData.push([
      'Average Latency (ms)',
      latestLatency.toFixed(2),
      candidateLatency.toFixed(2),
      latencyDiff.toFixed(2),
      `${latencyPercent.toFixed(2)}%`,
      latencyDiff > 0 ? 'Lower' : latencyDiff < 0 ? 'Higher' : 'Same'
    ]);

    // Requests per second comparison
    const latestRps = latest.clientResults.requestsPerSecond;
    const candidateRps = candidate.clientResults.requestsPerSecond;
    const rpsDiff = candidateRps - latestRps;
    const rpsPercent = (rpsDiff / latestRps) * 100;
    
    tableData.push([
      'Requests/Second',
      latestRps.toFixed(2),
      candidateRps.toFixed(2),
      rpsDiff.toFixed(2),
      `${rpsPercent.toFixed(2)}%`,
      rpsDiff > 0 ? 'Higher' : rpsDiff < 0 ? 'Lower' : 'Same'
    ]);

    // Errors comparison (if available)
    if (latest.clientResults.errors !== undefined && candidate.clientResults.errors !== undefined) {
      const latestErrors = latest.clientResults.errors;
      const candidateErrors = candidate.clientResults.errors;
      const errorsDiff = candidateErrors - latestErrors;
      
      tableData.push([
        'Errors',
        latestErrors.toString(),
        candidateErrors.toString(),
        errorsDiff.toString(),
        latestErrors > 0 ? `${((errorsDiff / latestErrors) * 100).toFixed(2)}%` : 'N/A',
        errorsDiff < 0 ? 'Fewer' : errorsDiff > 0 ? 'More' : 'Same'
      ]);
    }
  }

  // Output markdown table with proper padding
  const headers = ['Metric', 'Latest', 'Candidate', 'Difference', 'Change (%)', 'Status'];
  const colWidths = [20, 12, 12, 12, 12, 12];
  
  // Calculate actual column widths based on content
  tableData.forEach(row => {
    headers.forEach((header, i) => {
      const content = i === 0 ? row[i] : row[i];
      colWidths[i] = Math.max(colWidths[i], content.toString().length + 2);
    });
  });
  
  // Print header
  const headerRow = headers.map((header, i) => header.padEnd(colWidths[i])).join('| ');
  const separatorRow = colWidths.map(width => '-'.repeat(width)).join('|-');
  
  console.log(`| ${headerRow}|`);
  console.log(`|-${separatorRow}|`);
  
  // Print data rows
  tableData.forEach(row => {
    const dataRow = row.map((cell, i) => cell.toString().padEnd(colWidths[i])).join('| ');
    console.log(`| ${dataRow}|`);
  });
  
  if (!hasLatestAutocannon || !hasCandidateAutocannon) {
    console.log('\n*Note: Autocannon data not available for comparison*');
  }
}

async function main() {
  const testFolders = getTestFolders(`/app/${TEST_DIR}`);

  for (const testSubfolder of testFolders) {
    console.log(`\n--- Starting parallel tests for: ${testSubfolder} ---`);
    
    const latestResult = await runTest('latest', `npm install ${PACKAGE_NAME}@latest`, testSubfolder);
    const candidateResult = await runTest('candidate', `npm install /app`, testSubfolder);

    console.log(
      `\n--- Comparing results for test folder: ${testSubfolder} ---`
    );
    compareResults(testSubfolder, latestResult.resultFile, candidateResult.resultFile);
  }
}

main();
