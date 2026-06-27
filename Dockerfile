# ── Stage 1: Build ────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY src/ src/
COPY scripts/ scripts/
COPY public/ public/
RUN npx tsc

# ── Stage 2: Runtime ──────────────────────────
FROM python:3.12-slim
WORKDIR /app

# Install Node.js 22
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install PaddleOCR + pdf2image
RUN pip install --no-cache-dir \
    paddlepaddle \
    paddleocr \
    pdf2image \
    && paddleocr --help > /dev/null 2>&1 || true

# Copy built app
COPY --from=builder /app/dist/ dist/
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/scripts/ scripts/
COPY --from=builder /app/public/ public/
COPY --from=builder /app/package.json ./

# Pre-download PaddleOCR models (warm cache)
RUN python -c "from paddleocr import PaddleOCR; ocr = PaddleOCR(lang='ch'); print('PaddleOCR ready')" || true

ENV OCR_ENGINE=paddleocr
ENV AI_EXTRACTOR=rule
ENV PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True

EXPOSE 3001 3002

# Start both servers
CMD ["sh", "-c", "node dist/moka-mock.js & node dist/server.js"]
