FROM debian:bullseye-slim

WORKDIR /runner

# Install curl, git, and required dependencies
RUN apt-get update && apt-get install -y curl git ca-certificates bash build-essential

# Install NVM
ENV NVM_DIR=/root/.nvm
ENV NODE_VERSION=20

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash && \
    bash -c "source $NVM_DIR/nvm.sh && nvm install $NODE_VERSION && nvm use $NODE_VERSION && npm install -g autocannon"

# Copy test runner script into image
COPY run-tests.mjs ./run-tests.mjs

# We'll always override CMD in CI, so default here doesn't matter
CMD ["bash"]

