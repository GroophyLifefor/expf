import { readFileSync } from 'fs';
import { config } from './config.mjs';
import { formatTable } from './utils.mjs';

/**
 * Compare performance results between latest and candidate versions
 */
export function compareResults(testSubfolder, latestFile, candidateFile) {
  console.log(`\n--- Comparing results for: ${testSubfolder} ---`);
  console.log(`Latest result file: ${latestFile}`);
  console.log(`Candidate result file: ${candidateFile}`);
  
  const latest = JSON.parse(
    readFileSync(`${config.tempDir}-latest-${testSubfolder}/${latestFile}`, 'utf8')
  );
  const candidate = JSON.parse(
    readFileSync(`${config.tempDir}-candidate-${testSubfolder}/${candidateFile}`, 'utf8')
  );

  const latestTime = latest.serverResults.executionTimeMs;
  const candidateTime = candidate.serverResults.executionTimeMs;

  console.log(`\n## 📊 Performance Comparison (Node.js ${config.NODE_VERSION})\n`);

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
  const hasLatestAutocannon = hasAutocannonData(latest);
  const hasCandidateAutocannon = hasAutocannonData(candidate);

  if (hasLatestAutocannon && hasCandidateAutocannon) {
    addAutocannonComparisons(tableData, latest, candidate);
  }

  // Output markdown table
  const headers = [
    'Metric',
    'Latest',
    'Candidate',
    'Difference',
    'Change (%)',
    'Status',
  ];

  let output = formatTable(headers, tableData);

  if (!hasLatestAutocannon || !hasCandidateAutocannon) {
    output += '\n*Note: Autocannon data not available for comparison*\n';
  }

  console.log(output);
  return { output };
}

/**
 * Check if result has autocannon data
 */
function hasAutocannonData(result) {
  return result.clientResults &&
         result.clientResults.latency &&
         result.clientResults.requestsPerSecond;
}

/**
 * Add autocannon-specific comparisons to table data
 */
function addAutocannonComparisons(tableData, latest, candidate) {
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
  if (latest.clientResults.errors !== undefined &&
      candidate.clientResults.errors !== undefined) {
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
