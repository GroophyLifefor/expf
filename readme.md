
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
- [ ] Extract req/sec, latency, throughput from autocannon output
- [ ] Create Markdown or CSV table for all test comparisons
- [ ] Optionally send results to PR comment
- [ ] Optionally send results to external dashboard
- [ ] Optimize Dockerfile, it's big as hell (149.9 MB)