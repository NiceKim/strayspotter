# TDD Guide — Stray Spotter

A practical reference for how testing is structured in this project, what each layer is responsible for, and the workflow to follow when adding new features.

---

## Philosophy

**Retrofit phase (now):** Write tests that prove existing code works. These become your safety net for refactoring. You are not writing tests first yet — you are capturing current behaviour as a specification.

**TDD phase (new features):** Write a failing test first. Run it to confirm it is red. Write the minimum code to make it green. Then refactor. Never write production code without a failing test that demands it.

---

## The Test Pyramid

```
         ┌──────────────────────────────────┐
         │  E2E (Playwright)                │
         │  ~5 tests · slow · full stack    │
         │  critical user journeys only     │
         ├──────────────────────────────────┤
         │  Integration (Supertest)         │
         │  ~30–50 tests · medium speed     │
         │  every API route, real test DB   │
         ├──────────────────────────────────┤
         │  Unit (Jest)                     │
         │  ~100+ tests · fast              │
         │  every function, all deps mocked │
         └──────────────────────────────────┘
```

More tests at the bottom. Unit tests are cheap to write and run in milliseconds. E2E tests are expensive and slow — use them only for flows that no lower layer can verify.

---

## Layer 1: Unit Tests

### What they cover
Each function in isolation. All external dependencies (database, S3, OneMap, bcrypt, JWT) are replaced with Jest mocks. Tests run without a network or database.

### What to assert
- **Happy path:** correct inputs produce the correct response (status code, body shape, which mocks were called with which args).
- **Validation paths:** missing or invalid inputs throw the right custom error type (`ValidationError`, `NotFoundError`, etc.).
- **Error propagation:** when a dependency throws, `next(err)` is called with that error — not swallowed, not re-wrapped incorrectly.
- **Transaction lifecycle:** `beginTransaction` → `commit` → `release` on success; `rollback` → `release` on failure. Never call `release` without calling `rollback` first on error.
- **S3 cleanup:** if S3 upload succeeds but a subsequent DB write fails, `deleteFromCloud` must be called with the uploaded key.

### Rules
- One `describe` per function under test.
- `beforeEach(() => jest.clearAllMocks())` — never let mock state bleed between tests.
- Do not assert implementation details (e.g. which internal variable was set). Assert outcomes (response status, which public mocks were called, what `next` received).
- Keep each test under ~30 lines. If it is longer, the function under test is doing too much.

### What not to unit test
- Express routing (covered by integration tests).
- SQL query correctness (covered by integration tests).
- Third-party library internals (jest, bcrypt, mysql2).

---

## Layer 2: Integration Tests

### What they cover
Every API endpoint through HTTP using Supertest. The Express app is imported directly (no real HTTP server is bound). The test database (`strayspotter_database_test`) is real — queries actually execute. External network calls (S3, OneMap, the classification server) are mocked at the module level.

### What to assert
- Correct HTTP status codes for all documented response cases.
- Response body shape (required fields are present, types are correct).
- Database side effects: after a `POST /api/posts`, a row exists in `posts` and `pictures`.
- Auth enforcement: protected routes return 401 without a valid token.
- Cookie behaviour: `refreshToken` cookie is set on login/register.

### Setup requirements
- `server.js` must export `app` separately from `app.listen()`. Supertest needs the Express instance, not a bound server.
- Each test file is responsible for seeding and cleaning its own test data. Use `beforeEach` to insert fixtures and `afterEach` to delete them. Never rely on data left by a previous test.
- Wrap test-data cleanup in `afterAll` to handle cases where a test fails mid-run.

### Rules
- Integration tests live in `backend/tests/integration/`.
- Mock S3 and OneMap at the top of each file with `jest.mock()` so no real credentials are needed.
- Never share state between `describe` blocks via module-level variables. Declare fixtures inside `beforeEach`.
- Integration tests are slower — keep the count focused. Do not write integration tests for cases already covered at the unit level (e.g. testing every validation branch via HTTP is redundant).

### What not to integration test
- Exact SQL query strings (test the behaviour, not the implementation).
- Frontend rendering.
- E2E flows that require a browser (covered by Playwright).

---

## Layer 3: E2E Tests (Playwright)

### What they cover
Full user journeys through a running application in a real browser. Playwright drives the Next.js frontend which calls the backend through nginx. These tests require all services to be running.

### Scope — keep it minimal
Only test flows that cannot be verified any other way. Aim for 5 flows maximum to start:

1. Anonymous user uploads a photo and sees it in the gallery.
2. User registers, logs in, uploads a photo, and sees it under "my posts".
3. Authenticated user deletes their own post.
4. Anonymous user deletes their own post using the password they set.
5. Report page loads and displays a chart.

### Rules
- E2E tests do not run in CI on every push — they run on merges to `main` or on a separate scheduled job.
- Use Playwright's `page.route()` to intercept and mock the OneMap and S3 presigner calls so tests do not depend on external services.
- Each test must clean up after itself (delete the user/post created during the test).

---

## TDD Workflow for New Features

### Step-by-step

1. **Understand the requirement.** Write it in plain English before touching code.

2. **Write the unit test first.** In the test, write the call you wish existed. Import the function, call it with the inputs you expect, and assert the output you expect. This test will not even compile/run cleanly yet.

3. **Run the test — confirm it is red.** If it is green without any code change, the test is not testing anything real.

4. **Write the minimum production code** to make the test pass. No extra logic, no defensive coding for cases that have no test.

5. **Run the test — confirm it is green.**

6. **Write the next test** for the next case (e.g. the validation failure path). Repeat from step 3.

7. **Refactor** once all cases are green. The tests tell you immediately if you break something.

8. **Add an integration test** once the unit is complete. Verify the route wires up correctly.

### Example: adding a new endpoint `GET /api/posts/:id`

```
tests/unit/controllers/postController.test.js
  describe('getPostById')
    test('200 with valid id')          ← write this first, see it fail
    test('400 when id is missing')
    test('404 when post not found')

tests/integration/posts.test.js
  describe('GET /api/posts/:id')
    test('200 returns correct shape')
    test('404 for non-existent id')
```

---

## Naming Conventions

| Layer | File location | Naming |
|---|---|---|
| Unit | `backend/tests/unit/controllers/` | `<controllerName>.test.js` |
| Unit | `backend/tests/unit/services/` | `<serviceName>.test.js` |
| Unit | `backend/tests/unit/lib/` | `<libName>.test.js` |
| Integration | `backend/tests/integration/` | `<resourceName>.test.js` |
| E2E | `frontend/tests/e2e/` | `<userJourney>.spec.ts` |

Test descriptions follow: `'<condition>: <expected outcome>'`

```js
test('missing file: throws ValidationError')
test('HEIC input: converts to JPEG before upload')
test('DB failure after S3 upload: rolls back and deletes S3 object')
```

---

## What to Mock and What Not To

| Dependency | Unit tests | Integration tests |
|---|---|---|
| MySQL pool / connection | Mock (`jest.mock('../db')`) | Real (`strayspotter_database_test`) |
| S3 (`@aws-sdk/client-s3`) | Mock | Mock |
| OneMap API (`oneMap.js`) | Mock | Mock |
| bcrypt | Only mock in transaction tests; real in auth unit tests | Real |
| JWT | Real (it is pure crypto, no I/O) | Real |
| `axios` (classification server) | Mock | Mock |
| Express middleware | Skip in unit tests | Real (applied by the app) |

---

## Running Tests

```bash
# All backend tests
cd backend && npm test

# Unit tests only
cd backend && npx jest --testPathPattern=unit

# Integration tests only
cd backend && npx jest --testPathPattern=integration

# Single file
cd backend && npx jest tests/unit/controllers/postController.test.js

# Watch mode during development
cd backend && npx jest --watch
```

---

## Definition of Done (per feature)

A feature is not done until:
- [ ] Unit tests cover the happy path and all documented error paths.
- [ ] An integration test covers the route end-to-end.
- [ ] All existing tests still pass (`npm test` is green).
- [ ] The GitHub Actions `test` workflow passes on the PR branch.
