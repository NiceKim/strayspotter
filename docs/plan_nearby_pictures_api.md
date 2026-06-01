# Plan: Nearby Pictures API

## Goal

Add `GET /api/images/nearby` — returns posts whose pictures were taken within a given radius of a coordinate, sorted by most recent first. Mirrors the shape of the existing `GET /api/images` response so the frontend can reuse the same rendering logic.

---

## Endpoint

```
GET /api/images/nearby
```

### Query parameters

| Param | Type | Required | Default | Constraint |
|---|---|---|---|---|
| `latitude` | float | yes | — | -90 to 90 |
| `longitude` | float | yes | — | -180 to 180 |
| `radius` | float (km) | no | 1.0 | 0 < radius ≤ 50 |
| `limit` | int | no | 20 | 1 – 100 |
| `offset` | int | no | 0 | ≥ 0 |

### Response — 200 OK

Same column shape as `fetchPosts`, with one extra field:

```json
[
  {
    "id": 42,
    "picture_id": 17,
    "user_id": null,
    "created_at": "2025-04-10T12:34:56.000Z",
    "picture_key": "abc123.jpg",
    "cat_status": 0,
    "account_id": null,
    "distance_km": 0.43
  }
]
```

### Error responses

| Status | Condition |
|---|---|
| 400 | `latitude` or `longitude` missing / out of range |
| 400 | `radius` ≤ 0 or > 50 |

---

## Files to change

### 1. `backend/src/db/pictures.js` — add `fetchNearbyPosts`

Add after `fetchRecentPhotoId` and export it.

```js
/**
 * Fetches posts whose pictures were taken within `radiusKm` of the given coordinates.
 * Uses the Haversine formula to compute great-circle distance in SQL.
 * Pictures with NULL coordinates are excluded.
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} latitude  - Centre latitude  (-90 to 90)
 * @param {number} longitude - Centre longitude (-180 to 180)
 * @param {number} radiusKm  - Search radius in kilometres
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<Object[]>} Posts ordered by created_at DESC, each with distance_km.
 */
async function fetchNearbyPosts(pool, latitude, longitude, radiusKm, limit = 20, offset = 0) {
  const haversine = `
    (6371 * ACOS(
      COS(RADIANS(?)) * COS(RADIANS(pictures.latitude))
      * COS(RADIANS(pictures.longitude) - RADIANS(?))
      + SIN(RADIANS(?)) * SIN(RADIANS(pictures.latitude))
    ))`;
  const query = `
    SELECT
      posts.id,
      posts.picture_id,
      posts.user_id,
      posts.created_at,
      pictures.picture_key,
      pictures.cat_status,
      users.account_id,
      ${haversine} AS distance_km
    FROM posts
    JOIN pictures ON pictures.id = posts.picture_id
    LEFT JOIN users ON users.id = posts.user_id
    WHERE posts.deleted_at IS NULL
      AND pictures.latitude  IS NOT NULL
      AND pictures.longitude IS NOT NULL
      AND ${haversine} <= ?
    ORDER BY posts.created_at DESC
    LIMIT ? OFFSET ?
  `;
  // lat, lng, lat appear twice (once for SELECT alias, once for WHERE filter)
  const params = [latitude, longitude, latitude, latitude, longitude, latitude, radiusKm, limit, offset];
  const [result] = await pool.query(query, params);
  return result;
}
```

Also add `fetchNearbyPosts` to `module.exports`.

---

### 2. `backend/src/controllers/imageController.js` — add `listNearbyImages`

Add after `listImages`, following the same pattern:

```js
/**
 * Retrieves posts near a given GPS coordinate.
 *
 * Request query:
 *   latitude  {number}  required — centre latitude  (-90 to 90)
 *   longitude {number}  required — centre longitude (-180 to 180)
 *   radius    {number}  optional — search radius in km (default 1, max 50)
 *   limit     {number}  optional — max results       (default 20, max 100)
 *   offset    {number}  optional — pagination offset (default 0)
 *
 * Response 200: Array of post rows, each with distance_km field.
 * Response 400: Missing / out-of-range parameters.
 */
async function listNearbyImages(req, res, next) {
  try {
    const lat  = parseFloat(req.query.latitude);
    const lng  = parseFloat(req.query.longitude);
    const radius = Math.min(parseFloat(req.query.radius) || 1.0, 50);
    const limit  = Math.min(parseInt(req.query.limit,  10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    if (isNaN(lat) || lat < -90  || lat > 90)  throw new ValidationError('latitude must be a number between -90 and 90');
    if (isNaN(lng) || lng < -180 || lng > 180) throw new ValidationError('longitude must be a number between -180 and 180');
    if (radius <= 0) throw new ValidationError('radius must be greater than 0');

    const posts = await db.fetchNearbyPosts(db.pool, lat, lng, radius, limit, offset);
    res.json(posts);
  } catch (err) {
    next(err);
  }
}
```

Export it: add `listNearbyImages` to `module.exports`.

---

### 3. `backend/src/routes/imageRoutes.js` — register the route

Place the new route **before** `GET /images` so the more-specific path `/images/nearby` is matched first:

```js
router.get('/images/nearby', imageController.listNearbyImages);
router.get('/images', imageController.listImages);
```

---

### 4. `backend/swagger.yaml` — document the endpoint

Add a `/images/nearby` entry under `paths`, following the same pattern as `/images`.

---

## Key design decisions

**Haversine in SQL, not a spatial index.**
The `pictures` table stores coordinates as plain `FLOAT` columns, so MySQL spatial extensions (`ST_Distance_Sphere`, `POINT` type, `SPATIAL INDEX`) would require a schema migration. Using the Haversine formula inline in SQL works correctly today and is fast enough for the expected data volume. If row count grows into the millions, a spatial index migration can be planned separately.

**`distance_km` included in the response.**
The frontend map view can use this to display the distance badge on each card without a second round-trip.

**Radius capped at 50 km.**
Singapore is roughly 50 km across, so this is a natural upper bound that also protects against accidentally expensive full-table distance scans.

**Route order matters.**
Express matches routes in registration order. `/images/nearby` must be registered before `/images` to avoid Express treating `nearby` as the `maxKeys` query param for the generic route.

---

## Testing checklist

- [ ] `latitude` / `longitude` missing → 400
- [ ] `latitude` out of range → 400
- [ ] `radius` = 0 or negative → 400
- [ ] Valid coords with no nearby pictures → `[]`
- [ ] Valid coords with pictures in radius → sorted by `created_at DESC`
- [ ] Pictures with `NULL` coordinates are excluded
- [ ] Soft-deleted posts excluded
- [ ] `limit` and `offset` pagination works
- [ ] `distance_km` value is plausible for known test coordinates
