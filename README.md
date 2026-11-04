# Product Availability Service

A lightweight microservice that returns real-time availability for a product. Internal services such as checkout and the storefront call one REST endpoint and get a consistent JSON answer.

```
GET /availability/{productId}
```

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js 20+ with TypeScript | Type safety on the API contract |
| HTTP | Express 5 | Small, well known; async errors flow to one error handler |
| Data | SQLite via `sql.js` (WebAssembly) | Embedded, zero setup, no native build; real SQL schema and primary-key index |
| Logging | pino / pino-http | Structured JSON logs with a request ID on every line |
| Rate limiting | express-rate-limit | Standard `RateLimit-*` headers, returns `429` |
| Docs | OpenAPI 3 + Swagger UI | Self-service contract for consuming teams |
| Tests | Vitest + Supertest | Unit tests for the business rule, API tests for the contract |
| Packaging | Docker (multi-stage, non-root) | Same image locally and on Cloud Run |

## Setup

Requires **Node.js 20 or later**.

```bash
npm install
```

## How to run

```bash
# Development (auto-reload)
npm run dev

# Production build
npm run build
npm start
```

The service starts on **http://localhost:3000**. On first run it creates `data/products.db` and seeds sample products. To reset the data: `npm run db:seed`.

**API docs:** http://localhost:3000/docs  ·  **Health:** http://localhost:3000/health

### Run with Docker

```bash
docker build -t product-availability-service .
docker run -p 8080:8080 product-availability-service
curl http://localhost:8080/availability/12345
```

### Run the tests

```bash
npm test
```

### Configuration

All settings are environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` (`8080` in Docker) | HTTP port |
| `DB_PATH` | `./data/products.db` | SQLite file location |
| `LOG_LEVEL` | `info` | `debug` shows cache hits and misses |
| `CACHE_TTL_MS` | `5000` | Cache lifetime per product; `0` disables caching |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `RATE_LIMIT_MAX` | `100` | Requests allowed per client per window |

## Example requests and responses

**In stock** (`quantity > 0`)

```bash
curl -i http://localhost:3000/availability/12345
```
```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Request-Id: 45997931-0e75-4890-99e0-edcebff46649

{"productId":"12345","inStock":true,"availableQuantity":42,"lastUpdated":"2026-03-18T18:20:00Z"}
```

**Out of stock** (`quantity = 0`)

```bash
curl http://localhost:3000/availability/12346
```
```json
{"productId":"12346","inStock":false,"availableQuantity":0,"lastUpdated":"2026-03-18T17:05:00Z"}
```

**Not found → 404**

```bash
curl http://localhost:3000/availability/99999
```
```json
{"error":{"code":"PRODUCT_NOT_FOUND","message":"Product '99999' was not found","requestId":"d5cbf306-..."}}
```

**Invalid ID → 400**

```bash
curl 'http://localhost:3000/availability/abc$1'
```
```json
{"error":{"code":"INVALID_PRODUCT_ID","message":"productId must be 1-64 characters and contain only letters, digits, hyphens or underscores","requestId":"ada84235-..."}}
```

**Unexpected failure → 500** (internal details are logged, never returned)

```json
{"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred","requestId":"..."}}
```

**Bypass the cache** (for callers that cannot accept stale data, such as checkout)

```bash
curl -H "Cache-Control: no-cache" http://localhost:3000/availability/12345
```

**Trace a request across services**

```bash
curl -H "X-Request-Id: checkout-7f3a" http://localhost:3000/availability/12345
```

### Sample product IDs

| productId | Quantity | inStock |
|---|---|---|
| `12345` | 42 | true |
| `12346` | 0 | false |
| `12347` | 7 | true |
| `12348` | 1 | true |
| `12349` | 128 | true |
| `SKU-2026-001` | 0 | false |

## Architecture

```
request
  │
  ▼
pino-http  ─ request ID + one structured log line per request
  │
rate limiter ─ 429 when a client exceeds the limit
  │
Controller  (src/controllers)   validate productId, call service, shape HTTP response
  │
Service     (src/services)      business rule (inStock = quantity > 0), caching
  │
Repository  (src/repositories)  data access behind an interface
  │
SQLite      (src/db)            products table, PRIMARY KEY lookup
  │
error handler (src/middleware)  maps typed errors to 400 / 404 / 429 / 500
```

```
src/
├── app.ts                  # composition root: wires dependencies and middleware
├── server.ts               # starts HTTP server, graceful shutdown
├── config.ts               # env-based configuration
├── logger.ts               # structured logger
├── errors.ts               # typed errors with stable error codes
├── validation.ts           # productId validation
├── models/product.ts       # internal record and public response types
├── controllers/            # HTTP layer
├── services/               # business logic
├── repositories/           # data access
├── cache/                  # TTL cache
├── middleware/             # request ID, 404 route, error handler
└── db/                     # schema, seed data, seed script
tests/                      # unit + API tests
openapi.yaml                # API contract
```

### Design decisions

- **Layered with dependency injection.** The service depends on a `ProductRepository` interface, not SQLite. Swapping the source (for example, the commerce platform's inventory API) means adding one repository class; controllers and business logic don't change. `createApp()` receives its dependencies, which is what makes the API tests run against an in-memory database.
- **Stable error codes.** Every error body has a machine-readable `code`, so callers branch on `PRODUCT_NOT_FOUND` vs `INVALID_PRODUCT_ID` instead of parsing messages. Unknown errors become a generic `500`; the stack is logged, not returned.
- **Validation at the edge.** IDs must match `^[A-Za-z0-9_-]{1,64}$`. Bad input is rejected before it reaches the data source.
- **Short-TTL cache, found products only.** Availability is read-heavy, so a 5-second cache absorbs spikes. Not-found results aren't cached, so a newly added product appears immediately. Callers that need fresh data send `Cache-Control: no-cache`.
- **Observability.** One JSON log line per request with method, URL, status, latency and request ID. `X-Request-Id` is accepted from callers and echoed back, so one request can be followed across services.

### Trade-offs and what I'd change for production

| Here | In production |
|---|---|
| In-process cache per instance | Shared cache (Memorystore/Redis), or invalidation driven by inventory-change events over Pub/Sub |
| In-memory rate limit per instance | Enforced at the API gateway / proxy layer, or with a shared store |
| SQLite seeded locally | Repository backed by the inventory system of record, or a read model kept current by events |
| Availability = on-hand quantity | Account for reservations, safety stock and per-location inventory (online vs. boutique) |
| Single endpoint | Batch endpoint (`POST /availability:batchGet`) so a product listing page makes one call, not N |
