FROM debian:bullseye-slim

WORKDIR /runner

# Install dependencies
RUN apt-get update && apt-get install -y curl git ca-certificates bash build-essential

# Install NVM (just the tool, no Node yet)
ENV NVM_DIR=/root/.nvm

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Copy test runner script
COPY run-tests.mjs .

# Default command
CMD ["bash"]
