# TDD Implementation Plan — Stray Spotter

Concrete, ordered steps to retrofit tests onto the existing codebase and wire them into GitHub Actions. Each phase has a clear output and a done condition.

---

## Current State

| What exists | Status |
|---|---|
| `backend/tests/unit/controllers/postController.transaction.test.js` | Done — covers `uploadImage` and `deletePost` transaction lifecycle |
| Integration tests | Done — Phase 2 complete |
| GitHub Actions test job | None — CI only builds and deploys |
| `app` exported separately from `listen()` | Done — `src/app.js` exports app, `src/server.js` calls `listen()` |

---

## Phase 0: Prerequisites

These are one-time setup tasks that unlock everything else.

### 0.1 — Separate `app` from `listen()` in `server.js`

**Why:** Supertest needs to import the Express `app` instance. Currently `app.listen()` is called unconditionally at module load, which binds a port and causes test hangs.

**Change:** Split `server.js` into two concerns:
- `src/app.js` — creates and configures the Express app, exports it
- `src/server.js` — imports `app`, calls `app.listen()`, handles graceful shutdown

`app.js` becomes importable by tests without side effects.

**Done when:** `const app = require('./app')` in a test file does not bind a port and does not throw.

### 0.2 — Install Supertest

```bash
cd backend && npm install --save-dev supertest
```

### 0.3 — Create the integration test directory

```
backend/tests/integration/
```

### 0.4 — Add Jest config to `package.json`

Add explicit test path patterns so unit and integration suites can be run independently:

```json
"jest": {
  "testEnvironment": "node",
  "testMatch": [
    "**/tests/unit/**/*.test.js",
    "**/tests/integration/**/*.test.js"
  ]
}
```

**Done when:** `npx jest --testPathPattern=unit` and `npx jest --testPathPattern=integration` each run independently.

### 0.5 — Test database container

This setup is **only for local development**. CI already handles its own MySQL container via GitHub Actions service containers (Phase 3.1). The test container is completely separate from the existing `docker-compose.yml` — it shares no volumes, networks, or state with the dev/production setup.

**File:** `backend/docker-compose.test.yml`

```yaml
services:
  mysql-test:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: strayspotter_database_test
    ports:
      - "3307:3306"
    tmpfs:
      - /var/lib/mysql
```

- Port **3307** avoids collision with the dev MySQL on 3306.
- `tmpfs` mounts the data directory in memory — fully ephemeral and fast.
- No named volumes, so nothing persists after `docker compose down`.

Docker orchestration and schema application are handled by Jest `globalSetup`/`globalTeardown` files — no CLI tools required beyond Docker itself.

**Create `backend/tests/integration/setup.js`** (`globalSetup`):
- Runs `docker compose -f docker-compose.test.yml up -d`
- Polls MySQL with `mysql2` until ready (no `wait-on` needed)
- Reads `init.sql`, strips the `CREATE DATABASE`/`USE` lines (test DB already exists), and applies the tables via `mysql2`

**Create `backend/tests/integration/teardown.js`** (`globalTeardown`):
- Runs `docker compose -f docker-compose.test.yml down`

**Create `backend/jest.integration.config.js`**:

```js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/integration/**/*.test.js'],
  globalSetup: './tests/integration/setup.js',
  globalTeardown: './tests/integration/teardown.js',
  forceExit: true,
};
```

**Add scripts to `backend/package.json`:**

```json
"scripts": {
  "test:unit": "jest --testPathPattern=unit",
  "test:integration": "DB_HOST=127.0.0.1 DB_PORT=3307 DB_NAME=strayspotter_database_test DB_USER=root DB_PASSWORD=root JWT_SECRET=test-secret NODE_ENV=test jest --config jest.integration.config.js"
}
```

Test env vars are hardcoded inline — throwaway credentials, no separate env file needed.

Note: `backend/src/db/index.js` reads `DB_PORT` and `DB_USER` from env. `DB_USER` was previously hardcoded as `'admin'` and has been changed to `process.env.DB_USER ?? 'admin'`.

**Done when:** `npm run test:integration` in the `backend/` directory:
1. Starts the MySQL test container on port 3307.
2. Applies the schema from `init.sql`.
3. Runs all integration tests.
4. Tears the container down regardless of test outcome.
5. The dev containers on `docker-compose.yml` are unaffected throughout.

---

## Phase 1: Unit Tests (Backend)

Work through controllers and services in priority order. Each file is independent — they can be done in any order or in parallel.

### 1.1 — `userController` unit tests

**File:** `backend/tests/unit/controllers/userController.test.js`

**Mocks required:**
- `jest.mock('../../../src/db')` — mock `fetchUserByEmail`, `fetchUserByAccountId`, `fetchUserById`, `insertUser`, `updateUserPassword`
- `jest.mock('bcrypt')` — mock `genSalt`, `hash`, `compare`
- `jest.mock('jsonwebtoken')` — mock `sign` (returns a predictable string)

**Cases to cover:**

`register`:
- Missing `accountId` → `ValidationError` → `next` called with it
- Missing `password` or `email` → `ValidationError`
- Duplicate email → `ValidationError`
- Duplicate `accountId` → `ValidationError`
- Success → `db.insertUser` called → `res.status(201).json(...)` with `token` and `user`
- Success → `res.cookie` called with `refreshToken`

`login`:
- Missing `accountId` or `password` → `ValidationError`
- User not found → `UnauthorizedError`
- Wrong password (`bcrypt.compare` returns false) → `UnauthorizedError`
- Success → `res.status(200).json(...)` with `token` and `user`

`getUserDetails`:
- User not found → `NotFoundError`
- Success → `res.status(200).json(...)` with `accountId`, `email`, `joinedDate`

`refreshToken`:
- Success → `jwt.sign` called → `res.status(200).json({ token })`

`changePassword`:
- Missing `oldPassword` or `newPassword` → `ValidationError`
- User not found → `NotFoundError`
- Wrong old password → `UnauthorizedError`
- Success → `db.updateUserPassword` called, `res.status(200).json(...)`

**Done when:** all cases pass, `npm test` is green.

---

### 1.2 — `postController` unit tests (remaining functions)

**File:** `backend/tests/unit/controllers/postController.test.js`

Transaction tests already exist in `postController.transaction.test.js`. This file covers the remaining functions.

**Mocks required:**
- `jest.mock('../../../src/db')` — mock `fetchLikesByPostId`, `hasUserLikedPost`, `likePost`, `unlikePost`, `fetchPostsByUserId`, `fetchMyPostsCount`

**Cases to cover:**

`getLikes`:
- Missing post ID → `ValidationError`
- No auth (`req.userId` absent) → `likedByMe: false` in response
- With auth → `db.hasUserLikedPost` called, `likedByMe` reflects result
- Success → `res.status(200).json({ count, likedByMe })`

`likePost`:
- Missing post ID → `ValidationError`
- Missing user ID → `ValidationError`
- `db.likePost` returns 0 (already liked) → `res.json({ changed: false, ... })`
- Success → `res.json({ changed: true, ... })`

`unlikePost`:
- Same structure as `likePost`

`getMyPosts`:
- Default pagination applied (limit 10, offset 0)
- Custom `limit`/`offset` from query → passed through to `db.fetchPostsByUserId`
- Success → `res.status(200).json(posts)`

`getMyPostsCount`:
- Success → `res.status(200).json(count)`

---

### 1.3 — `imageController` unit tests

**File:** `backend/tests/unit/controllers/imageController.test.js`

**Mocks required:**
- `jest.mock('../../../src/db')` — mock `fetchPosts`
- `jest.mock('../../../src/services/s3Service')` — mock `getPresignedUrl`

**Cases to cover:**

`listImages`:
- No query params → defaults to `limit=100, offset=0`
- Custom `maxKeys` and `offset` → passed to `db.fetchPosts`
- Success → `res.json(posts)`

`getImageUrl`:
- Missing `key` → `ValidationError`
- Success → `s3Service.getPresignedUrl` called with key, `res.json({ url })`

---

### 1.4 — `pictureController` unit tests

**File:** `backend/tests/unit/controllers/pictureController.test.js`

**Cases to cover:** examine `pictureController.js` and cover all exported functions using the same pattern as above.

---

### 1.5 — `image_handler` service unit tests

**File:** `backend/tests/unit/services/image_handler.test.js`

**Mocks required:**
- `jest.mock('../../../src/db')` — mock `getValidToken`, `insertPictureToDb`
- `jest.mock('../../../src/services/s3Service')` — mock `uploadToCloud`
- `jest.mock('../../../src/lib/oneMap')` — mock `reverseGeocode`
- `jest.mock('exifr')` — mock `parse`
- `jest.mock('heic-convert')` — mock the converter

**Cases to cover:**

`validateFile` (internal, tested via `processImageUpload`):
- Missing file → `ValidationError`
- Missing buffer → `ValidationError`
- Non-image mimetype → `ValidationError`
- File over 10 MB → `PayloadTooLargeError`

`processImageUpload`:
- EXIF parse fails → continues with `null` coords (no throw)
- EXIF returns lat/lng → `oneMap.reverseGeocode` called with those coords
- HEIC by extension → `heicConvert` called, result uploaded as JPEG
- HEIC by mimetype (`image/heic`) → same
- Non-HEIC → `heicConvert` not called
- S3 upload fails → error is re-thrown
- Success → returns `{ pictureKey, pictureId }`

---

### 1.6 — `s3Service` unit tests

**File:** `backend/tests/unit/services/s3Service.test.js`

**Mocks required:**
- `jest.mock('@aws-sdk/client-s3')` — mock `S3Client`, `PutObjectCommand`, `DeleteObjectCommand`
- `jest.mock('@aws-sdk/s3-request-presigner')` — mock `getSignedUrl`

**Cases to cover:**
- `uploadToCloud` → `PutObjectCommand` called with correct bucket and key
- `deleteFromCloud` → `DeleteObjectCommand` called with correct key
- `getPresignedUrl` → `getSignedUrl` called, returns URL string

---

### 1.7 — `oneMap` lib unit tests

**File:** `backend/tests/unit/lib/oneMap.test.js`

**Mocks required:**
- `jest.mock('axios')`

**Cases to cover:**
- `reverseGeocode` with valid coords → `axios.get` called with correct URL and token, returns district number
- `reverseGeocode` with no results → returns `null`
- API error → propagates the error

---

## Phase 2: Integration Tests (Backend)

All integration tests import the Express app via `require('../../src/app')` and use Supertest. S3 and OneMap are mocked via `jest.mock()`. The test DB is `strayspotter_database_test`.

Each test file seeds its own data in `beforeEach` and cleans up in `afterEach`/`afterAll`.

---

### 2.1 — Auth integration tests

**File:** `backend/tests/integration/auth.test.js`

**Endpoints:** `POST /api/users/register`, `POST /api/users/login`, `POST /api/users/refresh`, `GET /api/users/details`, `PATCH /api/users/password`

**Cases to cover:**
- Register with valid fields → 201, `token` in body, `refreshToken` cookie set
- Register with duplicate email → 400
- Login with correct credentials → 200, `token` in body
- Login with wrong password → 401
- `GET /api/users/details` without token → 401
- `GET /api/users/details` with valid token → 200, correct user shape
- `POST /api/users/refresh` with valid refresh cookie → 200, new token
- `PATCH /api/users/password` with wrong old password → 401
- Full flow: register → login → refresh → change password → login with new password → 200

---

### 2.2 — Posts integration tests

**File:** `backend/tests/integration/posts.test.js`

**Mocks:** `jest.mock('../../src/services/image_handler')`, `jest.mock('../../src/services/s3Service')`

**Endpoints:** `POST /api/posts`, `DELETE /api/posts/:id`, `GET /api/posts/:id/likes`, `POST /api/posts/:id/likes`, `DELETE /api/posts/:id/likes`, `GET /api/posts/mine`, `GET /api/posts/mine/count`

**Cases to cover:**
- Upload without file → 400
- Upload without status → 400
- Anonymous upload without nickname/password → 400
- Anonymous upload (valid) → 201, `posts` row exists in DB
- Authenticated upload → 201, `posts` row has correct `user_id`
- Delete own post (authenticated) → 200, row removed from DB
- Delete another user's post → 403
- Anonymous delete with correct password → 200
- Anonymous delete with wrong password → 403
- Like a post → 200, `changed: true`
- Like the same post again → 200, `changed: false`
- Unlike a post → 200
- `GET /api/posts/mine` without auth → 401
- `GET /api/posts/mine` with auth → 200, array of posts

---

### 2.3 — Images integration tests

**File:** `backend/tests/integration/images.test.js`

**Mocks:** `jest.mock('../../src/services/s3Service')` (mock `getPresignedUrl`)

**Endpoints:** `GET /api/images`, `GET /api/image-url`

**Cases to cover:**
- `GET /api/images` → 200, array
- `GET /api/images?maxKeys=2&offset=0` → returns at most 2 results
- `GET /api/image-url` without `key` → 400
- `GET /api/image-url?key=k1.jpg` → 200, `{ url: '...' }`

---

### 2.4 — Pictures (report) integration tests

**File:** `backend/tests/integration/pictures.test.js`

**Endpoints:** `GET /api/pictures/reports`, `GET /api/pictures/counts`, `GET /api/pictures/:id/gps`

Note: routes are plural (`/reports`, `/counts`) — this matches `pictureRoutes.js`.

**Cases to cover:**
- `GET /api/pictures/reports` without `timeFrame` → 400
- `GET /api/pictures/reports?timeFrame=daily` without date range → 400
- `GET /api/pictures/reports?timeFrame=monthly` without `month` → 400
- `GET /api/pictures/reports?timeFrame=monthly&month=2025-01` → 200, report shape
- `GET /api/pictures/counts` → 200, `{ day, week, month }` shape
- `GET /api/pictures/:id/gps` with non-numeric id → 400
- `GET /api/pictures/:id/gps` with valid id → 200, `{ latitude, longitude }`

---

## Phase 3: GitHub Actions

### 3.1 — Create `ci.yml` workflow

**File:** `.github/workflows/ci.yml`

Triggers on pushes to `development` and PRs targeting `development`.

Two jobs: `backend-unit` (runs `npx jest --testPathPattern=unit --ci`) and `backend-integration` (runs `npm run test:integration`). Both run in parallel on `ubuntu-latest`.

`ubuntu-latest` has Docker pre-installed, so `npm run test:integration` works identically to local — no service containers, no divergence.

### 3.2 — Gate deploy on tests passing

**File:** `.github/workflows/deploy.yml`

Add the same `backend-unit` and `backend-integration` jobs from `ci.yml` inline into `deploy.yml`, then add `needs: [backend-unit, backend-integration]` to `build-and-push`.

GitHub Actions `needs` only works within the same workflow file, so the test jobs must live here rather than being referenced from `ci.yml`.

`deploy-ec2` already depends on `build-and-push`, so the full chain becomes: tests → build → deploy.

**Done when:** a push to `main` with a failing test blocks the deploy job.

---

## Execution Order

| Phase | Task | Depends on |
|---|---|---|
| 0 | Split `app.js` from `server.js` | — |
| 0 | Install Supertest, create integration dir, add Jest config | — |
| 0 | Create `docker-compose.test.yml`, npm scripts | — |
| 1 | `userController` unit tests | Phase 0 |
| 1 | `postController` remaining unit tests | Phase 0 |
| 1 | `imageController` unit tests | Phase 0 |
| 1 | `image_handler` unit tests | Phase 0 |
| 1 | `s3Service` unit tests | Phase 0 |
| 1 | `oneMap` unit tests | Phase 0 |
| 2 | Auth integration tests | Phase 0 |
| 2 | Posts integration tests | Phase 0 |
| 2 | Images integration tests | Phase 0 |
| 2 | Pictures integration tests | Phase 0 |
| 3 | `ci.yml` GitHub Actions | Phases 1 and 2 stable |
| 3 | Gate deploy on tests (`deploy.yml`) | Phase 3 `ci.yml` |

---

## File Tree (target state)

```
backend/
  docker-compose.test.yml                    ← Phase 0
  jest.integration.config.js                 ← Phase 0
  tests/
    unit/
      controllers/
        postController.transaction.test.js   ← exists
        postController.test.js               ← Phase 1.2
        userController.test.js               ← Phase 1.1
        imageController.test.js              ← Phase 1.3
        pictureController.test.js            ← Phase 1.4
      services/
        image_handler.test.js                ← Phase 1.5
        s3Service.test.js                    ← Phase 1.6
      lib/
        oneMap.test.js                       ← Phase 1.7
    integration/
      setup.js                               ← Phase 0 (globalSetup: start container, apply schema)
      teardown.js                            ← Phase 0 (globalTeardown: stop container)
      auth.test.js                           ← Phase 2.1
      posts.test.js                          ← Phase 2.2
      images.test.js                         ← Phase 2.3
      pictures.test.js                       ← Phase 2.4

.github/workflows/
  ci.yml                                     ← Phase 3.1
  deploy.yml                                 ← Phase 3.2 (modified)
```
