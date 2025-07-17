function printComparisonTable(latest, candidate) {
  const latestTime = latest.serverResults.executionTimeMs;
  const candidateTime = candidate.serverResults.executionTimeMs;

  console.log('\n## 📊 Performance Comparison\n');
  
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
  const colWidths = [22, 14, 14, 14, 12, 10];
  
  // Calculate actual column widths based on content
  tableData.forEach(row => {
    headers.forEach((header, i) => {
      const content = row[i];
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

// Test with mock data
const mockLatest = {
  serverResults: {
    executionTimeMs: 5224.85
  },
  clientResults: {
    latency: {
      averageMs: 0.03
    },
    requestsPerSecond: 18083665.34,
    errors: 0
  }
};

const mockCandidate = {
  serverResults: {
    executionTimeMs: 5225.30
  },
  clientResults: {
    latency: {
      averageMs: 0.03
    },
    requestsPerSecond: 17792828.69,
    errors: 0
  }
};

const mockLatestNoAutocannon = {
  serverResults: {
    executionTimeMs: 3500.25
  },
  clientResults: {
    latency: {
      averageMs: 0
    }
  }
};

const mockCandidateNoAutocannon = {
  serverResults: {
    executionTimeMs: 3400.15
  },
  clientResults: {
    latency: {
      averageMs: 0
    }
  }
};

console.log('=== Test 1: With Autocannon Data ===');
printComparisonTable(mockLatest, mockCandidate);

console.log('\n\n=== Test 2: Without Autocannon Data ===');
printComparisonTable(mockLatestNoAutocannon, mockCandidateNoAutocannon);
