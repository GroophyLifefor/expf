
## Build

```
docker build -t muratkirazkaya/perf-runner:latest -f perf-runner/Dockerfile perf-runner
```

## Publish

```
docker push muratkirazkaya/perf-runner:latest
```

Hub Repo: https://hub.docker.com/r/muratkirazkaya/perf-runner

## Pray

```
sudo rm -fr ./*
```

### TODO

- [x] Run perf-test-lib tests inside Docker for multiple Node.js versions
- [x] Execute tests for each subfolder in expf-tests
- [x] Compare latest vs candidate results per test
- [x] Print comparison (e.g., execution time differences)
- [x] Extract req/sec, latency, throughput from autocannon output
- [x] Create Markdown or CSV table for all test comparisons
- [x] Optionally send results to PR comment
- [x] split run-tests.mjs into multiple files for more readable code
- [ ] Optionally send results to external dashboard
- [x] Optimize Dockerfile, it's big as hell (149.9 MB) (decreased to 55.9 MB)
- [ ] Add act (Run your GitHub Actions locally) support
- [ ] Fix repeating logics in client repositories, extract reuseable logic into npm package
- [x] Make each test folder has static package.json, not dynamic (so we don't need to have dependency of testing libraries in our library)
- [ ] Decrease file count 2 to 1 with like as 
```js
// /expf-tests/simple/main.mjs
class PerfTest {
  constructor(label, options) {
    this.label = label;
    this.options = options;
  }

  async start() { /* start server */ }
  async run() { /* run autocannon */ }
  async report() { /* format + send */ }
  async stop() { /* close server */ }
}

const test = new PerfTest(label, config);
await test.start();
await test.run();
await test.report();
await test.stop();
```

