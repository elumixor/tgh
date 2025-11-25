FROM oven/bun:1.2.20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://raw.githubusercontent.com/anthropics/anthropic-quickstarts/main/install.sh | sh && \
    rm -rf /var/lib/apt/lists/*

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

COPY . .

CMD ["bun", "run", "src/index.ts"]
