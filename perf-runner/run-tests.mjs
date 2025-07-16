// run-tests.mjs
import { execSync } from "child_process";
import { writeFileSync } from "fs";
import os from "os";
import path from "path";
import { performance } from "perf_hooks";

const PACKAGE_NAME = process.env.PACKAGE_NAME;
const TEST_DIR = process.env.TEST_DIR;
const RESULT_UPLOAD_URL = process.env.RESULT_UPLOAD_URL;

const tempDir = "/tmp/perf-test";

function runTest(label, installCommand) {
  console.log(`\n--- Running test for: ${label} ---`);
  execSync(`rm -rf ${tempDir} && mkdir -p ${tempDir}`, { stdio: "inherit" });
  process.chdir(tempDir);
  execSync(`npm init -y`, { stdio: "inherit" });
  execSync(installCommand, { stdio: "inherit" });
  execSync(`cp -r /app/${TEST_DIR}/${PACKAGE_NAME}-get/* .`, { stdio: "inherit" });

  const start = performance.now();
  execSync(`node run-test.mjs`, { stdio: "inherit" });
  const end = performance.now();

  const result = {
    schemaVersion: "1.0.0",
    timestamp: Date.now(),
    runMetadata: {
      repo: `https://github.com/expressjs/${PACKAGE_NAME}`,
      gitRef: process.env.GIT_REF || "unknown",
      toolSettings: {
        connections: 10,
        duration: 10
      }
    },
    serverMetadata: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus(),
      totalmem: os.totalmem()
    },
    clientMetadata: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus()
    },
    serverResults: {
      executionTimeMs: end - start
    },
    clientResults: {
      latency: {
        averageMs: 0 // (you can parse from autocannon stdout)
      }
    }
  };

  const filename = `result-${label}-${Date.now()}.json`;
  writeFileSync(filename, JSON.stringify(result, null, 2));
  console.log(`Saved result to: ${filename}`);

  if (RESULT_UPLOAD_URL) {
    execSync(`curl -X POST -H "Content-Type: application/json" -d @${filename} ${RESULT_UPLOAD_URL}`);
    console.log("Result uploaded.");
  }
}

runTest("latest", `npm install ${PACKAGE_NAME}@latest`);
runTest("candidate", `npm install /app`);
