# Sprint 3 Backend Core

## Baseline and ownership

Implemented against accepted `08856bf` and the frozen Sprint 3 Shared Contracts,
including the Application.UseCases backward-compatibility amendment. Baseline had
only migrations 000001–000005. Those files remain byte-for-byte unchanged.
No new infrastructure or alternative application boundary was introduced.

Core remains `persistence.New(pool)` implementing `application.UseCases`. Existing
legacy methods and their signatures/behavior are retained. Frontend, black-box QA,
OpenAPI, routes, auth and product HTTP features are outside this change.

## Domain/application

Ticket adds `ArrivedAt` and `NoShowAt`; common HTTP TicketDTO is unchanged.
QueuePolicy and UpdateQueuePolicyCommand include all eight numeric policy fields.
Core validates the complete command; it does not guess defaults for omitted fields.
`CreateLiveTicket` returns `{Ticket, Replayed}`. Added `ArriveAppointment`,
`MarkNoShow`, and `GetQueuePosition`. QueuePosition fields and reason values match
the frozen contract. `TicketEvent.DecisionPriority` and effective priority are int64.
ARRIVED and NO_SHOW are audit event types. No new public error was added.

## Migration 000006

Adds arrival/no-show timestamps and frozen fact/source/state checks. Existing
scheduled-source/queue-anchor checks and active-ticket-per-window index remain.
Adds the six policy fields and all frozen validation constraints. Existing policies
receive the Sprint 3 defaults (including 100/10 base priorities), increment version
exactly once, and update their timestamp; the seed policy becomes version 2.

Audit decision priority becomes BIGINT, without the former 1000 cap. Transition
checks allow ARRIVED and NO_SHOW. The append-only trigger remains enabled.
Adds a concurrency-safe L-number sequence/function, reconciled against retained
L-numbers only during migration. Regular allocation uses nextval, never MAX+1.
Historical Q-numbered LIVE tickets retain their IDs and numbers. QR/LIVE candidate
index complements the existing due-appointment index.

Down migration restores Sprint 2 schema only when its types/constraints can represent
all retained data. It refuses rollback if arrival/no-show facts, their audit entries,
or priorities above 1000 exist; it never rewrites/deletes immutable history to make
a downgrade succeed. On an unsuccessful migrate-down the migrator may mark the
version dirty; investigate before retrying. Policy versions are not decremented.
A successful down/up reconciles retained L-numbers and versions the default reset.

## One Queue Engine

`queue_ranking.go` defines `rankedCandidates`, `rankingOrder`, and `rankingArgs`.
Both CallNext and QueuePosition use this exact eligibility, arithmetic and ordering.
No second formula is implemented in Go or in another SQL path.

The SQL uses source-specific base priority, effective arrival and queue time,
whole-second floor before conversion, grace and capped lateness penalty, then
unbounded linear waiting boost. All multiplication operands are BIGINT; integer
division floors nonnegative values. Timestamp extraction uses PostgreSQL exact
numeric arithmetic, not floating point. Ordering is effective priority descending,
effective queue time ascending, ticket UUID ascending.

CallNext retains READ COMMITTED, the window row lock, OPEN/busy validation, service
capability filtering and FOR UPDATE OF t SKIP LOCKED. One policy is read into a
value snapshot. Ranking, called_at and CALLED event use one transaction_timestamp
and the exact selected final effective priority. An overlapping policy update
cannot mix values or versions in a decision. SKIP LOCKED ranks available candidates;
it does not promise global commit order among simultaneous requests.

QueuePosition uses a short read-only REPEATABLE READ transaction and one database
time. Ticket, policy, reference window and candidates share a snapshot. Reference
selection is number then UUID among OPEN compatible windows, including busy ones.
A window's candidate set includes all services it supports. Terminal/active tickets,
future appointments and tickets without compatible capacity return the contract's
nullable fields and reasons. A missing branch policy is an internal configuration
error, not an empty queue.

## LIVE, arrival, NO_SHOW and events

LIVE exact identity is source/branch/service, with UUID comparison by value. Shared
idempotency-key uniqueness resolves cross-source races. A transaction advisory lock
serializes same-key LIVE creators before L-number allocation; one insert and CREATED
commit atomically. Replay returns persisted current state and emits no event. Sequence
gaps after rollback or cross-source conflicts are permitted. LIVE creation never
assigns a window. created_at and queue_entered_at equal transaction_timestamp.

Arrival locks the ticket, requires APPOINTMENT/SCHEDULED, sets arrived_at using
transaction time without changing status or queue_entered_at, and atomically inserts
ARRIVED. Repeated arrival in SCHEDULED preserves the original fact/event. Arrival
is not an eligibility requirement; missing arrival means on-time legacy semantics.

NO_SHOW locks the ticket, transitions only CALLED, records transaction time and
preserves the historical window. Repeated NO_SHOW returns unchanged persisted state.
The existing partial unique index releases active capacity through status semantics.
NO_SHOW vs Start permits only one mutation. CallNext may observe WINDOW_BUSY before
NO_SHOW commits or claim another ticket afterward. Arrival vs CallNext may encounter
SKIP LOCKED and no candidate while arrival owns the row; a subsequent call sees the
committed fact. Arrival after a successful claim returns INVALID_TICKET_STATE.

Every new mutation and its audit insert share one transaction. Audit insertion failure
rolls back the operational mutation. Events are never replayed to reconstruct state.
Existing QR/Appointment creation, cancellation, Start and Complete audit remain.
Legacy return/redirect/window/admin operations are retained, not expanded into Sprint 3.

## Cross-ownership mechanical adaptations

Only four HTTP-owned files changed under the explicit amendment:

* `client_handlers.go`: unwrap `CreateLiveTicketResult.Ticket` for the existing mapper;
  preserve current 201 response and route; do not consume Replayed.
* `handlers_test.go`: adapt the fake's method result to CreateLiveTicketResult while
  retaining existing fixture callbacks returning Ticket.
* `admin_handlers.go`: TicketEventDTO.DecisionPriority becomes *int64 to accept the
  domain field without narrowing. JSON property and number/null representation stay.
* `handlers_sprint2_test.go`: priority fixture is int64 for the shared pointer type.

No route, status, error mapping or HTTP feature was implemented.

## API integration handoff

The current HTTP policy handler still builds the old partial Core command. Product/API
must implement the frozen legacy PUT merge (read policy, check expectedVersion, fill
omitted fields, atomic Core update with that version), full Sprint 3 validation and
expanded response. Until that integration, real legacy policy PUT is rejected by Core
because antiStarvationPointsPerMinute is zero in the incomplete command. Weakening Core
validation or silently filling defaults would violate the frozen boundary.

Product/API also owns LIVE operator route and 201/200 replay handling, arrival/no-show/
position routes and DTOs. New common Ticket timestamps must not leak into Ticket JSON.
Current legacy LIVE HTTP status stays 201 under the mechanical exception.
This Core completion does not claim the shared Sprint 3 product Definition of Done.

## Verification

Use PostgreSQL 17 in an isolated test database:

```sh
cd backend
export CORE_TEST_DATABASE_URL='postgres://postgres:coretest@127.0.0.1:55439/coretest?sslmode=disable'
go test -count=1 ./...
go test -race -count=1 ./...
go vet ./...
```

Each integration test creates and cleans a private random schema. Business fixtures
may use SQL inside Core integration tests; external black-box QA is unchanged.

Coverage includes LIVE exact/concurrent/cross-source idempotency, distinct allocation,
fresh-pool persistence, service routing, mixed-source ordering, UUID ties, QR/LIVE aging,
legacy/early/late arrival, grace/penalty boundaries, fractional-second floors, priorities
beyond 32-bit range, position/claim consistency, busy/multi-service reference windows,
concurrent snapshot isolation, all terminal reasons, concurrent transitions, loaded
policy consistency/version races, immutable audit, rollback injection, migration down/up
and protective downgrade refusal.

Sprint 1/2 tests remain: fixtures expecting strict fresh-source priority now wait below
the aging threshold instead of using decade-old dates; policy versions account for
migration 6; Core policy commands supply the new mandatory fields; migration 5 upgrade
checks now explicitly pass through version 4. LIVE tests account for its new result
wrapper and CREATED event. Historical ticket comparison ignores only the newly added
nullable columns. No baseline business assertion was simply removed.
