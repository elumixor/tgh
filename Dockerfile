FROM oven/bun:1.2.20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl unzip && \
    curl -fsSL https://install.anthropic.com/claude | sh && \
    rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.local/bin:${PATH}"

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

CMD ["bun", "run", "src/index.ts"]
