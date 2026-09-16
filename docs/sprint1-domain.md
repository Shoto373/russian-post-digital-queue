# Sprint #1 Backend Core

Foundation сохранён. Core реализует только QR → WAITING → CALLED → SERVING → COMPLETED.
HTTP handlers, wiring в main, frontend и QA остаются задачами соответствующих участников.

## Интеграция с Backend API

```go
import (
    "postcode/backend/internal/application"
    "postcode/backend/internal/persistence"
)

var core application.UseCases = persistence.New(pool) // existing *pgxpool.Pool
```

Конструктор не создаёт pool и не применяет миграции. Жизненным циклом pool и запуском
миграций по-прежнему управляет Foundation. Новые зависимости не добавлены.
`application/contracts.go` содержит frozen interface, команды, результат и пять sentinel errors.
`persistence.Postgres` реализует интерфейс; compile-time assertion проверяет совместимость.
Идентификаторы на границе — `string`; pgtype.UUID остаётся внутренней деталью persistence.
Domain содержит ровно согласованные поля и все frozen enum values. JSON DTO и HTTP mapping
остаются ответственностью API; domain не содержит transport tags. Время возвращается в UTC.

`CreateQRTicketResult.Replayed=false` означает новое создание; `true` — существующий талон
с теми же Branch, Service и QR source. Replay возвращает текущее состояние талона, включая
изменения после создания. Ключ глобален, сравнивается точно, не обрезается и не истекает.
API использует Replayed для выбора 201/200.

`GetCurrentTicket`: CALLED/SERVING → указатель; существующее пустое окно → `nil, nil`;
несуществующее окно → `ErrNotFound`. Чтение выполняется в одном REPEATABLE READ snapshot,
чтобы одновременно завершившийся талон не вернулся как активный COMPLETED.

Проверять ошибки через `errors.Is`:

| Ошибка | Значение |
| --- | --- |
| ErrNotFound | Не найден Branch/Window/Ticket/Service или связь BranchService; некорректный UUID ресурса |
| ErrInvalidState | Неверный переход; окно не OPEN; пустой/пробельный idempotency key |
| ErrWindowBusy | Окно уже имеет CALLED/SERVING |
| ErrNoEligibleTickets | Нет незаблокированного подходящего WAITING талона |
| ErrIdempotencyConflict | Занятый ключ принадлежит другому Branch/Service/source |

API должен валидировать UUID и обязательный Idempotency-Key перед вызовом Core и выдавать
согласованный VALIDATION_ERROR. Услуга, не доступная в отделении, трактуется как отсутствующий
ресурс BranchService. Для существующего ключа сравнение logical request предшествует проверке
текущей доступности услуги. Прочие ошибки БД возвращаются как безопасная внутренняя ошибка
без raw PostgreSQL details; context cancellation/deadline сохраняют errors.Is semantics.
Коллекции при отсутствии элементов — инициализированный slice с длиной 0 (не nil).

## Миграция 000002_sprint1

Создаются branches, services, branch_services, windows, window_services, tickets;
sequence ticket_public_number_seq и SQL function next_ticket_public_number.
Services — глобальный каталог без branch_id. WindowService хранит branch_id для составных
FK: capability должна принадлежать тому же отделению и его BranchService.
Tickets также имеют FK на BranchService, Window/Branch и WindowService.
CHECK constraints ограничивают frozen enum values и обязательные поля этапов обслуживания.
Все даты — timestamptz.

Sequence генерирует Q-000001, Q-000002 и далее. После 999999 номер расширяется без усечения.
Пропуски при rollback/replay допустимы; номера не сбрасываются и не определяют FIFO.
Глобальные UNIQUE ограничения защищают public_number и idempotency_key.
Partial unique index tickets_one_active_per_window запрещает более одного CALLED/SERVING
талона на окно. Partial FIFO index покрывает выбор WAITING по branch, queue_entered_at, id.

Seed содержит отделение 11111111-1111-1111-1111-111111111111 «Демо-отделение №1»,
PARCELS 22222222-2222-2222-2222-222222222222 «Посылки» и
PAYMENTS 55555555-5555-5555-5555-555555555555 «Платежи»; обе услуги доступны отделению.
Окна OPEN: №1 33333333-3333-3333-3333-333333333333 → PARCELS,
№2 44444444-4444-4444-4444-444444444444 → PAYMENTS,
№3 66666666-6666-6666-6666-666666666666 → PARCELS.

Применение в существующем окружении:

```bash
docker compose run --rm --build migrate migrate up
docker compose run --rm migrate migrate version
```

Ожидается version=2, dirty=false. Миграция 000001 не изменена.
Down 000002 удаляет только объекты Core вместе с их данными; автоматически на рабочей БД
не запускается. Integration tests проверяют down/up исключительно в своей временной схеме.

## Транзакции и конкуренция

CreateQR: READ COMMITTED transaction, проверка существующего ключа, проверка BranchService,
INSERT ON CONFLICT(idempotency_key) DO NOTHING. Конкурентный INSERT ждёт unique conflict;
следующий SELECT использует новый snapshot и возвращает победителя или ErrIdempotencyConflict.
Replayed=false возвращается только после успешного COMMIT вставки.

CallNext: READ COMMITTED transaction. SELECT Window FOR UPDATE сериализует вызовы одного
окна. Проверяются OPEN и отсутствие активного талона. CTE выбирает подходящий WAITING той
же Branch с поддерживаемой Service, ORDER BY queue_entered_at, id, FOR UPDATE SKIP LOCKED;
UPDATE в том же statement назначает window_id, CALLED и called_at. Commit предшествует возврату.
Разные окна могут одновременно выбрать разные талоны. Заблокированный кандидат пропускается;
это FIFO среди доступных для блокировки кандидатов, без обещания глобального порядка commit.
Partial unique index дополнительно защищает одно активное назначение при записи вне Core.

Start/Complete: блокировка строки Ticket FOR UPDATE, проверка исходного состояния, UPDATE
статуса и timestamp, COMMIT. Конкурентный повтор видит уже изменённое состояние и получает
ErrInvalidState. Повтор не изменяет исходный timestamp. CALLED → SERVING сохраняет занятость
окна, SERVING → COMPLETED освобождает его для следующего вызова.

## Проверки

```bash
cd backend
go test ./...
go vet ./...
CORE_TEST_DATABASE_URL='postgres://user:password@localhost:5432/testdb?sslmode=disable' \
  go test -race -count=1 -v ./...
```

Без CORE_TEST_DATABASE_URL PostgreSQL tests явно SKIP; unit tests выполняются всегда.
Integration tests используют PostgreSQL 17 и golang-migrate. Требуется отдельная тестовая БД
и роль с CREATE SCHEMA. Каждый тест создаёт случайно именованную схему, применяет 000001/000002
и удаляет только свою схему при cleanup. Существующие схемы, данные и volumes не очищаются.
Тест Q-000001 относится исключительно к новой тестовой схеме, не к общему demo окружению.

Покрытие: migration up/down/up, exact seed, global catalogue/BranchService, ограничения
WindowService, QR persistence, exact/conflicting/concurrent idempotency, длинный public number,
легальные и ошибочные переходы, current ticket semantics, закрытое окно, busy/empty window,
исключение чужой Branch и неподдерживаемой Service, FIFO/tie-breaker, SKIP LOCKED,
конкурентный claim окон 1 и 3, два claim одного окна, конкурентные Start/Complete,
partial unique index и безопасные errors.Is ошибки.

Полный Queue Engine, Appointment/LIVE creation, приоритеты и управление окнами не реализованы.
