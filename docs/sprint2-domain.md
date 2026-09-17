# Sprint #2 Backend Core

## Baseline and scope

Implemented against the accepted integration baseline with existing migrations 000003_tz2
and 000004_priority_rules. The Team Lead authorized using migration 000005 and minimally
adapting the existing HTTP consumer/fake to the frozen application signature.
The referenced docs/sprint2-shared-contracts.md was absent from this checkout; the full
frozen contract supplied in the task was used. Migrations 000001–000004 are untouched.

Core remains persistence.New(pool), implementing application.UseCases. No new stack,
service, pool, HTTP abstraction, event sourcing, background scheduler or infrastructure.
The tickets table remains authoritative. Existing public methods are retained; the
preliminary CreateAppointment signature is replaced with the frozen signature.

## Application boundary

Added AppointmentView, CreateAppointmentResult, UpdateQueuePolicyCommand and the exact
five methods: CreateAppointment, CancelAppointment, GetQueuePolicy, UpdateQueuePolicy,
ListTicketEvents. CreateAppointmentCommand.ScheduledAt is time.Time. Domain Ticket gains
only ScheduledAt *time.Time; QueuePolicy and TicketEvent use the frozen fields and enums.

Creation returns Replayed=false only after commit. Replay returns the current ticket
state, including CANCELLED, with Replayed=true. Replay validation precedes current-time
and service availability validation. The idempotency namespace is shared with QR.
Branch/service/source and the exact logical scheduled instant must match. UUIDs are compared
by value. appointment_requested_at stores the original instant as canonical UTC RFC3339Nano
text in the same INSERT/transaction as the ticket. Replay compares this durable value, including
nanoseconds; equivalent timezone representations canonicalize identically. scheduled_at and
queue_entered_at remain at PostgreSQL microsecond precision. A fresh process/pool does not lose
idempotency precision. Legacy rows without metadata compare against the exact stored timestamp;
discarded pre-000005 nanoseconds cannot be reconstructed.

Missing resources return ErrNotFound. Invalid appointment time/key, invalid policy
numeric values and forbidden cancellation return ErrInvalidState. Stale policy versions
return ErrPolicyVersionConflict. No new validation sentinel is introduced. API consumers
must validate request fields and map validation errors to the frozen 400 envelope.
A missing policy in CallNext is an internal configuration error, not ErrNotFound.
ErrWindowClosed remains available and wraps ErrInvalidState for frozen Sprint #1 matching.
All database failures crossing the boundary are sanitized; context errors remain matchable.

## Migration 000005

Reuses scheduled_at from 000003. Normalizes preliminary appointments by setting
queue_entered_at=scheduled_at, clearing window_id and converting pending WAITING/SCHEDULED
appointments to SCHEDULED. Served/terminal historical rows are not rewritten. The queue-anchor
and unassigned check applies to SCHEDULED, while source/scheduled_at presence is checked for
all rows. IDs, public numbers and actual lifecycle timestamps are preserved. Historical Q-prefixed
appointments are not renumbered. There is no historical event backfill.

Adds source/scheduled-time/queue-anchor checks, a cancelled-appointment assignment check,
an independent A-number sequence/function, queue_policies, ticket_events and supporting
indexes. The demo policy is 100/10/version 1. priority_rules remains intact for the existing
admin consumer; CallNext uses only queue_policies. Future branch provisioning remains out
of scope and must explicitly provide a policy for a branch participating in queue calls.

The event table validates event transitions and decision metadata. An UPDATE/DELETE trigger
protects append-only events. No event mutation use case exists. Historical tickets can
legitimately return an initialized empty event slice. Ordering is occurred_at ASC, id ASC.

Migration fails on pre-existing inconsistent data such as an APPOINTMENT with no scheduled_at
or a non-appointment with scheduled_at. It does not guess missing business timestamps.
Down removes the new policy/event objects, sequence/function and checks; it converts pending
APPOINTMENT/SCHEDULED back to WAITING so the pre-000005 CallNext can claim them. Stale assignments
are not restored; served/terminal rows remain unchanged. scheduled_at and priority_rules stay.
The appointment_requested_at metadata column is deliberately retained on down: dropping it
would irreversibly lose exact idempotency inputs. Up uses ADD COLUMN IF NOT EXISTS for this
column; pre-000005 code ignores it, and 000002 down drops it with tickets.

After creating the A-number sequence, up reconciles it to the largest existing numeric A-*
public number using setval(..., true). The next nextval therefore cannot reuse a retained
A-number after down/up. The maximum is inspected only during migration, never during normal
creation. Down remains destructive for policy/event data and is tested only in private schemas.

## Queue and concurrency

CallNext retains READ COMMITTED, window FOR UPDATE, OPEN/busy checks, service capability
filter, candidate FOR UPDATE SKIP LOCKED, and the partial unique active-window index.
The branch policy is read once. QR/WAITING, legacy LIVE/WAITING and due APPOINTMENT/SCHEDULED participate;
eligibility uses scheduled_at <= transaction_timestamp(). No SCHEDULED-to-WAITING worker.
Ordering is priority DESC, effective timestamp ASC, UUID ASC. Effective time is scheduled_at
for appointments and queue_entered_at for QR/LIVE. Legacy LIVE uses the QR priority value and
shares QR FIFO/UUID ordering, preserving the former non-appointment tier. Due APPOINTMENT
outranks both. There is no new LIVE policy field or feature. CALLED events for LIVE record
the same loaded policy version and QR-tier decision priority. SKIP LOCKED orders available candidates;
it does not promise global commit order among concurrent transactions.

The selected policy version and priority are passed unchanged to the CALLED event.
A concurrent policy update cannot partially affect that decision. Policy updates use one
UPDATE WHERE branch_id AND version=expectedVersion; every success increments exactly once.

Appointment creation uses the existing global UNIQUE idempotency constraint and
INSERT ON CONFLICT followed by a fresh READ COMMITTED lookup. A transaction-scoped advisory
lock additionally serializes appointment requests for the same key before number allocation;
hash collisions only serialize unrelated requests. Replays do not allocate another A-number.
Sequence gaps after failed transactions are allowed; normal creation never uses MAX+1.

Cancel locks the ticket FOR UPDATE. Repeated CANCELLED is a no-op. Claim and cancel cannot
both change one SCHEDULED ticket. Cancellation does not clear an assignment from a claimed
ticket: it rejects CALLED/SERVING/COMPLETED instead.

QR create, appointment create, CallNext, StartService, CompleteService and appointment cancel
insert their event before committing the same transaction. CREATED/CALLED/STARTED/COMPLETED
use the corresponding ticket timestamp; cancellation uses the database clock. Failed event
insertion rolls the ticket mutation back. Replay/invalid transitions do not emit events.

## Integration boundaries and existing functionality

The existing HTTP appointment handler only parses time.Time and unwraps the new result so
it compiles. Its existing route/response behavior is not the Sprint #2 HTTP implementation.
Backend API ownership must implement the frozen appointment envelope, replay status, cancel,
policy/event routes and error mappings. TicketDTO remains unchanged, without scheduledAt.
HTTP test fake embeds the shared interface for unexercised methods and adapts CreateAppointment.
Frontend, QA, router and main wiring were not changed.

Existing LIVE creation, return, redirect, window lifecycle and legacy admin code are retained,
not expanded. Legacy LIVE/WAITING remains claimable through the same service-aware CallNext,
as a compatibility exception authorized by the targeted fix pass. Legacy return/redirect
reject APPOINTMENT with ErrInvalidState to preserve the frozen
appointment state machine; their QR/LIVE paths remain unchanged and outside Sprint #2 event
coverage. API integration must not expose return/redirect as Sprint #2 appointment actions. Legacy admin metrics do not include
SCHEDULED in their WAITING-only views. These are integration limitations, not new business rules.

## Verification

Use an isolated PostgreSQL database, not production:

```sh
cd backend
CORE_TEST_DATABASE_URL='postgres://.../testdb?sslmode=disable' go test -race -count=1 ./...
go vet ./...
```

Every integration test creates a random private schema and drops only that schema. Harness
expects migration 5 and retains the original down-to-1/up test. Tests cover future creation,
past rejection, offset-normalized replay, conflicting keys, repeated cancel, invalid cancel,
future/due selection, priority, deterministic ties, routing, simultaneous creators, double
claim, cancel-vs-claim, optimistic updates, loaded-policy consistency, event fields, historical
upgrade, audit immutability and rollback injection on every covered write path. Existing
Sprint #1 tests run against the same migration chain. The external QA HTTP runner is unchanged
and is not part of this Core verification.

Verification completed on PostgreSQL 17 in a temporary container without persistent volumes:
`go test -race -count=1 ./...` with CORE_TEST_DATABASE_URL — PASS (integration tests executed,
not skipped); `go vet ./...` — PASS; `git diff --check` — PASS. All seven existing Sprint #1
PostgreSQL tests passed. Migrations 000001–000004 have no diff. The temporary container was
stopped after verification. No commit or push was performed.


## Targeted review fixes

Regression tests in sprint2_fixes_integration_test.go cover LIVE create/claim with service and
OPEN checks, concurrent LIVE double claim, mixed QR/LIVE FIFO and due-appointment precedence,
A-number down/up with retained tickets, the actual pre-000005 candidate SQL after down,
assigned pending legacy normalization/cancellation, unchanged completed history on up/down,
exact/offset-equivalent nanosecond replay through a fresh pool, precise-input conflict,
concurrent identical creation and concurrent distinct-instant conflict. Exact metadata also
survives the A-number down/up regression. These changes do not touch HTTP or migrations 1–4.

Targeted fix verification: all 19 PostgreSQL integration tests (including the five targeted
regressions and the four existing concurrency subtests) executed without skips on PostgreSQL
17 with `go test -race -count=1 -v ./...`; PASS. `go vet ./...` and `git diff --check`: PASS.
Focused self-review of the four reported findings: PASS. Migrations 000001–000004 were
compared byte-for-byte with HEAD/main d09ee61 and remain unchanged.
