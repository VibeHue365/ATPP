# VibeHue Docker Services

This file standardizes local infrastructure used by Provider Verification.

## Services

```txt
MinIO API:      http://localhost:9000
MinIO Console:  http://localhost:9001
OCR Service:    http://localhost:8010
AI Service:     http://localhost:8000
```

Default MinIO dev credentials are defined in `docker-compose.yml`:

```txt
MINIO_ROOT_USER=vibehue_minio
MINIO_ROOT_PASSWORD=vibehue_minio_password
```

## Start Services

```bash
docker compose up -d minio redis ocr-service ai-service
```

## Stop Services

```bash
docker compose down
```

To also remove MinIO data:

```bash
docker compose down -v
```

## Backend Env

When the backend runs on the host machine, use:

```txt
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=vibehue_minio
MINIO_SECRET_KEY=vibehue_minio_password
MINIO_PROVIDER_DOCUMENT_BUCKET=provider-documents
MINIO_AUTO_CREATE_BUCKETS=true
OCR_SERVICE_URL=http://localhost:8010
AI_SERVICE_URL=http://127.0.0.1:8000
SMART_TAG_AI_ENABLED=true
SMART_TAG_AI_TIMEOUT_MS=15000
```

If the backend is later moved into Docker Compose, use:

```txt
MINIO_ENDPOINT=minio
OCR_SERVICE_URL=http://ocr-service:8010
AI_SERVICE_URL=http://ai-service:8000
```

## Health Checks

```bash
curl http://localhost:8010/health
curl http://localhost:8000/
```

The AI image bakes the local `intfloat/multilingual-e5-small` embedding model
during `docker compose build`. Smart Tag suggestions therefore do not consume
Gemini quota. The chatbot and image-search features may still require
`GEMINI_API_KEY` in `ai-service/.env`.

After changing the Smart Tag taxonomy, preview and apply the migration from the
`backend` directory:

```bash
npm run migrate:smart-tag-taxonomy:v2
npm run migrate:smart-tag-taxonomy:v2:apply
```

MinIO bucket creation is handled by the backend storage service when
`MINIO_AUTO_CREATE_BUCKETS=true`.
