# Hackathon Comprehensive Audit & Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all P0 defects (Notifications / T8 verification, Dynamic QueuePolicy influencing CallNext order), ETA >7200s outlier filter, architectural inconsistencies (C1 dual policy, C2 service keys, C3 Tailwind bundling, C5 init.sql sync), security hardening (H1 CORS, H2 login rate limit, H4 secure cookie), and generate updated presentation materials (P1).

**Architecture:** 
1. Unify queue policy by driving `domain.ComputeSchedule` and ticket priority ranking from PostgreSQL `queue_policies` with in-memory caching and real-time waiting ticket re-ranking.
2. Filter completed service durations > 7200s in ETA calculations to prevent 10-hour forgotten tickets from skewing averages.
3. Bundle precompiled Tailwind CSS locally, remove CDN dependency.
4. Synchronize `init.sql` with migrations 000001-000016.
5. Create a professional `.pptx` presentation accurately describing the `due_at → source_rank → checkin_at → id` engine, outbox notifications, and high-availability deployment.

**Tech Stack:** Go 1.24, PostgreSQL 17, React 19 / Vite 7, Chi router, python-pptx.

---

### Task 1: Verify & Finalize P0 Notifications Subsystem (T8)

**Files:**
- Verify: `backend/internal/notification/`
- Verify: `backend/internal/persistence/t8_notification_integration_test.go`
- Modify: `docker-compose.yml`

- [ ] **Step 1.1: Verify notification unit tests pass**
  Run `cd backend && go test -v -race ./internal/notification/...`
- [ ] **Step 1.2: Verify T8 integration test passes against live PostgreSQL**
  Run `cd backend && CORE_TEST_DATABASE_URL='postgres://postcode:local-development-only@172.18.0.8:5432/postcode?sslmode=disable' go test -v -race -run TestT8_NotificationProviderOutageVerifiesQueueReliability ./internal/persistence/...`
- [ ] **Step 1.3: Ensure `notification-demo` is properly wired in docker-compose.yml with `restart: always`**
- [ ] **Step 1.4: Commit verification findings**

---

### Task 2: P0 — Connect Admin QueuePolicy to Canonical Queue Ordering (Fix C1 & C2)

**Files:**
- Modify: `backend/internal/domain/queue_schedule.go`
- Modify: `backend/internal/persistence/queue_policy.go`
- Modify: `backend/internal/persistence/postgres.go`
- Modify: `backend/internal/persistence/sprint2.go`
- Modify: `backend/internal/persistence/sprint3.go`
- Test: `backend/internal/persistence/due_at_integration_test.go`

**Interfaces:**
- `ComputeSchedule` consumes `QueuePolicyConfig` and service max_wait lookup.
- `UpdateQueuePolicy` updates DB `queue_policies` table and updates `source_rank` for all waiting tickets in that branch.
- `CreateLiveTicket`, `CreateQRTicket`, `CreateAppointment` read active branch policy from DB (or cached policy) to compute `due_at` and `source_rank`.

- [ ] **Step 2.1: Write failing test in `due_at_integration_test.go` verifying that changing priority in `UpdateQueuePolicy` immediately re-orders waiting tickets in CallNext**
- [ ] **Step 2.2: Fix C2 in `domain/queue_schedule.go`: add UUID and string case-insensitive matching in `getMaxWait` and populate `DefaultQueuePolicy()` with seed UUIDs**
- [ ] **Step 2.3: In `persistence/queue_policy.go`, enhance `UpdateQueuePolicy` to re-rank waiting tickets for that branch based on new priority ordering**
- [ ] **Step 2.4: In `postgres.go`, `sprint2.go`, `sprint3.go`, ensure ticket creation uses the branch's policy from `queue_policies`**
- [ ] **Step 2.5: Run tests and ensure all tests pass**
- [ ] **Step 2.6: Commit**

---

### Task 3: ETA Outlier Filtering (> 7200s)

**Files:**
- Modify: `backend/internal/persistence/eta.go`
- Test: `backend/internal/persistence/eta_integration_test.go`

**Interfaces:**
- `GetTicketETA(ctx context.Context, ticketID string) (domain.TicketETA, error)`

- [ ] **Step 3.1: Write a test in `eta_integration_test.go` with a completed ticket having duration = 36000s (10 hours) and assert it is excluded from sample size and calculations**
- [ ] **Step 3.2: Modify SQL in `backend/internal/persistence/eta.go` to add `AND extract(epoch FROM (h.completed_at-h.service_started_at)) <= 7200`**
- [ ] **Step 3.3: In `eta.go` simulation, clamp active window elapsed time to 7200s**
- [ ] **Step 3.4: Run tests and verify they pass**
- [ ] **Step 3.5: Commit**

---

### Task 4: Security Hardening (H1 CORS, H2 Login Rate Limit, H4 Cookie Secure Flag)

**Files:**
- Modify: `backend/internal/httpapi/middleware.go`
- Modify: `backend/internal/httpapi/auth_handlers.go`
- Modify: `backend/internal/httpapi/handlers.go`
- Test: `backend/internal/httpapi/router_test.go`

- [ ] **Step 4.1: Fix H1 in `middleware.go`: remove unsafe wildcard suffix matching `strings.HasSuffix(..., "duckdns.org")`, enforce exact origin matching against allowed origins list**
- [ ] **Step 4.2: Fix H4 in `auth_handlers.go`: set `Secure: r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"` on session cookies**
- [ ] **Step 4.3: Implement H2 login rate limiter (token bucket or sliding window per IP/email) on `POST /api/v1/auth/login` returning 429 when abused**
- [ ] **Step 4.4: Run tests in `httpapi/` and verify pass**
- [ ] **Step 4.5: Commit**

---

### Task 5: Frontend Production Tailwind Bundling (Fix C3)

**Files:**
- Restore: `frontend/src/tailwind.css` from commit `82d6aa3`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/index.html`

- [ ] **Step 5.1: Restore `frontend/src/tailwind.css` from commit `82d6aa3`**
- [ ] **Step 5.2: Add `import './tailwind.css';` to `frontend/src/main.tsx`**
- [ ] **Step 5.3: Remove `<script src="https://cdn.tailwindcss.com"></script>` from `frontend/index.html`**
- [ ] **Step 5.4: Run `npm run build` and `npm run typecheck` to verify complete bundling without external CDN**
- [ ] **Step 5.5: Commit**

---

### Task 6: Synchronize `postgres/init.sql` (Fix C5)

**Files:**
- Modify: `postgres/init.sql`

- [ ] **Step 6.1: Append migrations 000007 through 000016 to `postgres/init.sql`**
- [ ] **Step 6.2: Ensure `schema_migrations` table is seeded with `(16, false)` in `postgres/init.sql` so `golang-migrate` does not conflict on fresh initialization**
- [ ] **Step 6.3: Commit**

---

### Task 7: P1 Presentation Materials (PPTX Generation)

**Files:**
- Create: `docs/presentation/generate_presentation.py`
- Generate: `docs/presentation/postcode_queue_presentation.pptx`

- [ ] **Step 7.1: Create presentation generator script using `python-pptx` with 8 structured slides covering architecture, scheduling algorithm (`due_at → source_rank → checkin_at → id`), outbox notifications (T8), ETA calculation, HA deployment, and UX**
- [ ] **Step 7.2: Run generator to create `.pptx` presentation**
- [ ] **Step 7.3: Commit presentation deliverable**

---

### Task 8: Full Verification and Deployment to Server

- [ ] **Step 8.1: Run full test suite: `go test ./...` in `backend/`**
- [ ] **Step 8.2: Run full frontend build: `npm run build` in `frontend/`**
- [ ] **Step 8.3: Verify deployment on server `144.31.181.192`**
- [ ] **Step 8.4: Verify live HTTPS endpoints**
- [ ] **Step 8.5: Push branch `feat/tv-board` to `origin/feat/tv-board`**
