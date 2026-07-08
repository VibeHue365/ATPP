# VibeHue Docker Services

This file standardizes local infrastructure used by Provider Verification.

## Services

```txt
MinIO API:      http://localhost:9000
MinIO Console:  http://localhost:9001
OCR Service:    http://localhost:8010
```

Default MinIO dev credentials are defined in `docker-compose.yml`:

```txt
MINIO_ROOT_USER=vibehue_minio
MINIO_ROOT_PASSWORD=vibehue_minio_password
```

## Start Services

```bash
docker compose up -d minio ocr-service
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
```

If the backend is later moved into Docker Compose, use:

```txt
MINIO_ENDPOINT=minio
OCR_SERVICE_URL=http://ocr-service:8010
```

## Health Checks

```bash
curl http://localhost:8010/health
```

MinIO bucket creation is handled by the backend storage service when
`MINIO_AUTO_CREATE_BUCKETS=true`.
