# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Stray Spotter is a web platform for sharing photos of neighborhood cats. Users upload images; the backend extracts EXIF GPS metadata, reverse-geocodes coordinates to Singapore districts via the OneMap API, stores the image in S3, and persists metadata in MySQL. A report page visualises aggregated sightings data.

## Repository Structure

```
/                   # Root: docker-compose files, nginx.conf, .env
├── frontend/       # Next.js 15 / React 19 / TypeScript / Tailwind (port 3001)
├── backend/        # Node.js / Express REST API (port 3000)
│   ├── src/
│   │   ├── server.js           # Entry point
│   │   ├── routes/             # Express routers (posts, pictures, images, users)
│   │   ├── controllers/        # Request handlers
│   │   ├── services/           # Business logic (image_handler, s3Service, report)
│   │   ├── db/                 # MySQL pool + query modules (pictures, posts, tokens, user)
│   │   ├── lib/                # oneMap.js (geocoding), postalData.js
│   │   └── middleware/         # auth.js (JWT), errorHandler.js, rateLimiters.js
│   ├── tests/unit/controllers/ # Jest unit tests
│   ├── init.sql                # DB schema
│   └── swagger.yaml            # API docs served at /api-docs
└── ai-service/     # FastAPI stub for cat classification (not yet integrated)
```

## Development Commands

### Full stack (Docker — recommended)
```bash
npm run dev       # Build & start all services in dev mode (hot-reload volumes mounted)
npm start         # Production compose (uses pre-built GHCR images)
```
Dev access: http://localhost:8080 (nginx proxy). Direct ports: backend :3000, frontend :3001.

### Frontend only
```bash
cd frontend
npm run dev       # next dev -p 3001
npm run build
npm run lint      # next lint
```

### Backend only
```bash
cd backend
npm run dev       # dotenv -e ../.env node src/server.js  (needs .env at root)
npm test          # Jest against strayspotter_database_test
npm run dev-test  # Start server pointed at test DB
```

### Run a single Jest test file
```bash
cd backend
npx jest tests/unit/controllers/postController.transaction.test.js
```

## Environment Setup

Copy `.env.example` to `.env` at the repo root and fill in values. The backend reads it via `dotenv-cli`; all services use the same file. Key variables:

| Variable | Purpose |
|---|---|
| `DB_HOST` / `DB_HOST_DEV` | MySQL host (prod vs dev) |
| `DB_NAME` | Database name (`strayspotter_database`) |
| `DB_PASSWORD` | MySQL password |
| `JWT_SECRET` | Token signing secret |
| `ACCESS_KEY_ID` / `SECRET_ACCESS_KEY_ID` | AWS credentials for S3 |
| `DEV_BUCKET` / `PROD_BUCKET` | S3 bucket names |
| `ONEMAP_API_EMAIL` / `ONEMAP_API_PASSWORD` | OneMap SG reverse geocoding |
| `SENTRY_DSN` | Error monitoring (Sentry only active in production) |

DB schema is in `backend/init.sql`. Test suite requires a separate `strayspotter_database_test` database.

## Architecture Notes

**Request flow for image upload:** multipart form → Express (`multer`) → `imageController` → `image_handler.js` service which: (1) parses EXIF GPS, (2) calls OneMap to resolve district number, (3) converts HEIC→JPG if needed, (4) uploads to S3 under `gallery/` prefix, (5) inserts `pictures` row, then creates a `posts` row (with optional `anonymous_posts` record if unauthenticated).

**Auth:** JWT access token in `Authorization: Bearer <token>` header. Refresh token in httpOnly `refreshToken` cookie. Two middleware variants: `verifyToken` (requires auth) and `optionalVerifyToken` (allows anonymous). Anonymous posts store a separate password hash in `anonymous_posts` for edit/delete.

**S3 images:** never served directly. The backend generates presigned URLs (1-hour TTL) via `s3Service.getPresignedUrl()`. Dev and prod use separate S3 buckets controlled by `NODE_ENV`.

**Frontend API calls:** the Next.js app sets `NEXT_PUBLIC_API_URL=/api`. In both dev and prod, nginx proxies `/api` to the backend, so the frontend never calls the backend directly.

**Database layer:** `backend/src/db/index.js` exports a shared `mysql2/promise` pool plus named query functions from sub-modules. Controllers receive a connection or use the pool directly; transactions are used for multi-table writes (see `postController`).

## Deployment

Push to `main` triggers GitHub Actions:
1. Builds Docker images for `backend/` and `frontend/`, pushes to GHCR (`ghcr.io/nicekim/strayspotter-*`).
2. Deploys to AWS EC2 via SSM Run Command using OIDC (no long-lived AWS keys in CI). Required secrets: `AWS_ROLE_TO_ASSUME`, `AWS_REGION`, `EC2_INSTANCE_ID`.

## Code Conventions

From `CONTRIBUTING.md`:
- **Commits:** `<type>: <subject>` — types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- **Branches:** `feature/<name>`, `hotfix/<name>`, `refactor/<topic>`, `chore/<topic>` off `development`; `main` is production-only
- **JS:** semicolons required, always use curly braces, camelCase for variables/functions
- **Python / DB:** snake_case for variables and column/table names
