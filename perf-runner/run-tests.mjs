import { execSync } from 'child_process';
import { writeFileSync, readdirSync, statSync } from 'fs';
import os from 'os';
import { performance } from 'perf_hooks';
import { readFileSync } from 'fs';

const PACKAGE_NAME = process.env.PACKAGE_NAME;
const TEST_DIR = process.env.TEST_DIR || 'expf-tests'; // expf-tests prefered, optional
const RESULT_UPLOAD_URL = process.env.RESULT_UPLOAD_URL; // optional
const NODE_VERSION = process.env.NODE_VERSION;

const PR_ID = process.env.PR_ID || '';
const isPR = !!PR_ID;
const GITHUB_TOKEN = process.env.COMMENTTOKEN || '';
const REPOSITORY_OWNER = process.env.REPOSITORY_OWNER || '';
const REPOSITORY = process.env.REPOSITORY || '';

console.log('PR', {
  isPR,
  PR_ID,
  REPOSITORY_OWNER,
  REPOSITORY,
  GITHUB_TOKEN: GITHUB_TOKEN ? GITHUB_TOKEN.slice(0, 4) + '... (hidden)' : '-NOT FOUND (undefined or null)-',
});

if (!PACKAGE_NAME) throw new Error('PACKAGE_NAME env var not set!');
if (!NODE_VERSION) throw new Error('NODE_VERSION env var not set!');

if (isPR) {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN env var must be set for PR runs!');
  }

  if (!REPOSITORY_OWNER) {
    throw new Error('REPOSITORY_OWNER env var must be set for PR runs!');
  }

  if (!REPOSITORY) {
    throw new Error('REPOSITORY env var must be set for PR runs!');
  }
}

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
  execSync(`rm -rf ${testTempDir} && mkdir -p ${testTempDir}`, {
    stdio: 'inherit',
  });
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
      result.clientResults.requestsPerSecond =
        parsedData.requests.total / (parsedData.duration / 1000);
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
    readFileSync(
      `${tempDir}-candidate-${testSubfolder}/${candidateFile}`,
      'utf8'
    )
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
    timeDiff > 0 ? 'Faster' : timeDiff < 0 ? 'Slower' : 'Same',
  ]);

  // Check if both have autocannon data
  const hasLatestAutocannon =
    latest.clientResults &&
    latest.clientResults.latency &&
    latest.clientResults.requestsPerSecond;
  const hasCandidateAutocannon =
    candidate.clientResults &&
    candidate.clientResults.latency &&
    candidate.clientResults.requestsPerSecond;

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
      latencyDiff > 0 ? 'Lower' : latencyDiff < 0 ? 'Higher' : 'Same',
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
      rpsDiff > 0 ? 'Higher' : rpsDiff < 0 ? 'Lower' : 'Same',
    ]);

    // Errors comparison (if available)
    if (
      latest.clientResults.errors !== undefined &&
      candidate.clientResults.errors !== undefined
    ) {
      const latestErrors = latest.clientResults.errors;
      const candidateErrors = candidate.clientResults.errors;
      const errorsDiff = candidateErrors - latestErrors;

      tableData.push([
        'Errors',
        latestErrors.toString(),
        candidateErrors.toString(),
        errorsDiff.toString(),
        latestErrors > 0
          ? `${((errorsDiff / latestErrors) * 100).toFixed(2)}%`
          : 'N/A',
        errorsDiff < 0 ? 'Fewer' : errorsDiff > 0 ? 'More' : 'Same',
      ]);
    }
  }

  // Output markdown table with proper padding
  const headers = [
    'Metric',
    'Latest',
    'Candidate',
    'Difference',
    'Change (%)',
    'Status',
  ];
  const colWidths = [20, 12, 12, 12, 12, 12];

  // Calculate actual column widths based on content
  tableData.forEach((row) => {
    headers.forEach((header, i) => {
      const content = i === 0 ? row[i] : row[i];
      colWidths[i] = Math.max(colWidths[i], content.toString().length + 2);
    });
  });

  // Print header
  let output = '';

  const headerRow = headers
    .map((header, i) => header.padEnd(colWidths[i]))
    .join('| ');
  const separatorRow = colWidths.map((width) => '-'.repeat(width)).join('|-');

  output += `| ${headerRow}|\n`;
  output += `|-${separatorRow}|\n`;

  // Print data rows
  tableData.forEach((row) => {
    const dataRow = row
      .map((cell, i) => cell.toString().padEnd(colWidths[i]))
      .join('| ');
    output += `| ${dataRow}|\n`;
  });

  if (!hasLatestAutocannon || !hasCandidateAutocannon) {
    output += '\n*Note: Autocannon data not available for comparison*\n';
  }

  console.log(output);
  return {
    output
  }
}

async function postComment(message) {
  const url = `https://api.github.com/repos/${REPOSITORY_OWNER}/${REPOSITORY}/issues/${PR_ID}/comments`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'perf-bot',
    },
    body: JSON.stringify({ body: message }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Failed to post comment: ${response.status} ${text}`);
  } else {
    const data = await response.json();
    console.log('Comment posted:', data.html_url);
  }
}

async function main() {
  const testFolders = getTestFolders(`/app/${TEST_DIR}`);
  const compareList = [];

  for (const testSubfolder of testFolders) {
    console.log(`\n--- Starting parallel tests for: ${testSubfolder} ---`);

    const latestResult = await runTest(
      'latest',
      `npm install ${PACKAGE_NAME}@latest`,
      testSubfolder
    );
    const candidateResult = await runTest(
      'candidate',
      `npm install /app`,
      testSubfolder
    );

    console.log(
      `\n--- Comparing results for test folder: ${testSubfolder} ---`
    );
    const { output } = compareResults(
      testSubfolder,
      latestResult.resultFile,
      candidateResult.resultFile
    );
    compareList.push({
      testSubfolder,
      output
    });
  }

  if (isPR) {
    console.log('\n--- Posting PR comment ---');
    
    let message = '[This comment is auto-generated by the perf runner]\n\n';

    message += `## Performance Comparison for PR #${PR_ID}, Node.js ${NODE_VERSION}\n\n`;

    compareList.forEach(({ testSubfolder, output }) => {
      message += `### Test Folder: ${testSubfolder}\n\n`;
      message += output.trim() + '\n\n';
    });

    console.log(`Posting comment: ${message}`);
    await postComment(message);
    console.log('PR comment posted.');
  } else {
    console.log('\n--- No PR comment posted, running in non-PR mode ---');
  }
}

main();
