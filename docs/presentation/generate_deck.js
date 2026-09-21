const pptxgen = require('pptxgenjs');
const path = require('path');

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333" x 7.5"
pres.author = 'Pointers Team (5 указателей)';
pres.company = 'Почта России / PostCode Challenge';
pres.title = 'Цифровая очередь нового поколения';

// Palette tokens (NO leading #)
const C_NAVY = '003B73';       // Postal Navy primary
const C_DEEP_BLUE = '054FA6';   // Secondary digital blue
const C_CYAN = '0EA5E9';        // Vibrant accent
const C_BG_LIGHT = 'F8FAFC';    // Content slide background
const C_TEXT_DARK = '0F172A';   // Dark text
const C_MUTED = '64748B';       // Muted gray
const C_WHITE = 'FFFFFF';
const C_CARD_BG = 'FFFFFF';
const C_BORDER = 'E2E8F0';
const C_SUCCESS = '10B981';
const C_DARK_BG = '002B54';

// Helper for card container
function addCard(slide, x, y, w, h, bg = C_CARD_BG, border = C_BORDER) {
  slide.addShape(pres.ShapeType.rect, {
    x, y, w, h,
    fill: { color: bg },
    line: { color: border, width: 1 },
    rectRadius: 0.1
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 1: Title Slide (Dark Navy)
// ─────────────────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: C_NAVY };

  // Category Tag
  slide.addText('POSTCODE CHALLENGE 2026 • ПОЧТА РОССИИ', {
    x: 1.0, y: 1.5, w: 11.3, h: 0.4,
    fontFace: 'Arial', fontSize: 13, bold: true, color: C_CYAN,
    margin: 0
  });

  // Main Title
  slide.addText('Цифровая очередь\nнового поколения', {
    x: 1.0, y: 2.1, w: 11.3, h: 2.0,
    fontFace: 'Arial', fontSize: 44, bold: true, color: C_WHITE,
    lineSpacingMultiple: 1.1, margin: 0
  });

  // Subtitle
  slide.addText('Высоконадежный движок управления потоками клиентов: детерминизм вызова, Outbox-нотификации и отказоустойчивость 99.9%', {
    x: 1.0, y: 4.4, w: 10.5, h: 0.8,
    fontFace: 'Calibri', fontSize: 18, color: 'CADCFC',
    lineSpacingMultiple: 1.2, margin: 0
  });

  // Footer metadata
  slide.addText('Команда «5 указателей»  |  Платформа: Go 1.24 + PostgreSQL 17 + React 19  |  https://pointers-team.tech', {
    x: 1.0, y: 6.2, w: 11.3, h: 0.4,
    fontFace: 'Calibri', fontSize: 14, color: '94A3B8',
    margin: 0
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 2: Проблема и Архитектурный вызов (Light)
// ─────────────────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: C_BG_LIGHT };

  slide.addText('АРХИТЕКТУРНЫЙ ВЫЗОВ', {
    x: 0.8, y: 0.6, w: 11.7, h: 0.3,
    fontFace: 'Arial', fontSize: 11, bold: true, color: C_DEEP_BLUE, margin: 0
  });
  slide.addText('Ключевые проблемы традиционных систем очередей', {
    x: 0.8, y: 0.95, w: 11.7, h: 0.6,
    fontFace: 'Arial', fontSize: 26, bold: true, color: C_TEXT_DARK, margin: 0
  });

  const cards = [
    {
      title: 'Конфликт источников талонов',
      desc: 'Предварительная запись, QR-коды и живая очередь конкурируют за окна операторов. Без строгого детерминизма запись срывает слоты, а живая очередь подвергается «голоданию» (starvation).'
    },
    {
      title: 'Хрупкость внешних интеграций',
      desc: 'Падение SMS/Push-шлюза или почтового сервиса блокирует транзакцию вызова клиента в окне. В 90% систем сетевой таймаут внешнего API парализует работу операторов отделения.'
    },
    {
      title: 'Искажение прогноза ожидания (ETA)',
      desc: 'Ошибочно незакрытые оператором талоны («висящие» по несколько часов) катастрофически сдвигают среднее время обслуживания, вводя клиентов в заблуждение на табло и в смартфонах.'
    }
  ];

  cards.forEach((c, idx) => {
    const x = 0.8 + idx * 4.0;
    addCard(slide, x, 1.8, 3.7, 4.8);

    slide.addText(`0${idx + 1}`, {
      x: x + 0.3, y: 2.1, w: 1.0, h: 0.4,
      fontFace: 'Arial', fontSize: 16, bold: true, color: C_CYAN, margin: 0
    });
    slide.addText(c.title, {
      x: x + 0.3, y: 2.6, w: 3.1, h: 0.8,
      fontFace: 'Arial', fontSize: 18, bold: true, color: C_TEXT_DARK, margin: 0
    });
    slide.addText(c.desc, {
      x: x + 0.3, y: 3.5, w: 3.1, h: 2.8,
      fontFace: 'Calibri', fontSize: 14, color: C_MUTED, lineSpacingMultiple: 1.25, margin: 0
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 3: Канонический алгоритм ранжирования (Light)
// ─────────────────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: C_BG_LIGHT };

  slide.addText('ЯДРО ДВИЖКА', {
    x: 0.8, y: 0.6, w: 11.7, h: 0.3,
    fontFace: 'Arial', fontSize: 11, bold: true, color: C_DEEP_BLUE, margin: 0
  });
  slide.addText('Канонический алгоритм ранжирования CallNext', {
    x: 0.8, y: 0.95, w: 11.7, h: 0.6,
    fontFace: 'Arial', fontSize: 26, bold: true, color: C_TEXT_DARK, margin: 0
  });

  // Left card: Deterministic sorting formula
  addCard(slide, 0.8, 1.8, 6.0, 4.8);
  slide.addText('Формула абсолютного детерминизма', {
    x: 1.1, y: 2.1, w: 5.4, h: 0.4,
    fontFace: 'Arial', fontSize: 18, bold: true, color: C_TEXT_DARK, margin: 0
  });
  slide.addText('ORDER BY due_at ASC, source_rank ASC, checkin_at ASC, id ASC', {
    x: 1.1, y: 2.6, w: 5.4, h: 0.5,
    fontFace: 'Courier New', fontSize: 12, bold: true, color: C_NAVY, margin: 0
  });

  const steps = [
    '1. due_at (дедлайн обслуживания): для предварительной записи — время слота; для QR и живой очереди — checkin + нормативный max_wait услуги.',
    '2. source_rank (приоритет источника): Appointment (0) → QR (1) → Live (2). При равенстве дедлайнов запись вызывается первой.',
    '3. checkin_at (момент прибытия): защита от starvation — кто пришел в отделение раньше, обслуживается раньше.',
    '4. id (первичный ключ UUID): абсолютное устранение race condition при одновременном обращении операторов.'
  ];
  steps.forEach((st, i) => {
    slide.addText(st, {
      x: 1.1, y: 3.2 + i * 0.8, w: 5.4, h: 0.75,
      fontFace: 'Calibri', fontSize: 12, color: C_TEXT_DARK, lineSpacingMultiple: 1.2, margin: 0
    });
  });

  // Right card: Dynamic Admin UI sync
  addCard(slide, 7.1, 1.8, 5.4, 4.8);
  slide.addText('Динамическое управление политикой', {
    x: 7.4, y: 2.1, w: 4.8, h: 0.4,
    fontFace: 'Arial', fontSize: 18, bold: true, color: C_TEXT_DARK, margin: 0
  });

  const benefits = [
    'Единый источник правды: Admin UI сохраняет веса приоритетов и лимиты в PostgreSQL-таблицу queue_policies.',
    'Мгновенная реакция: метод UpdateQueuePolicy атомарно пересчитывает source_rank всех талонов со статусом WAITING.',
    'Безопасность транзакций: использование FOR UPDATE SKIP LOCKED гарантирует, что переранжирование не блокирует окна операторов.',
    'Hot-reload: фоновый монитор синхронизирует in-memory политику каждые 5 секунд без перезапуска сервиса.'
  ];
  benefits.forEach((b, i) => {
    slide.addText(b, {
      x: 7.4, y: 2.7 + i * 0.9, w: 4.8, h: 0.8,
      fontFace: 'Calibri', fontSize: 13, color: C_MUTED, lineSpacingMultiple: 1.2, margin: 0
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 4: Надежная доставка уведомлений — Тест T8 (Light)
// ─────────────────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: C_BG_LIGHT };

  slide.addText('НАДЕЖНОСТЬ ИЗОЛЯЦИИ', {
    x: 0.8, y: 0.6, w: 11.7, h: 0.3,
    fontFace: 'Arial', fontSize: 11, bold: true, color: C_DEEP_BLUE, margin: 0
  });
  slide.addText('Transactional Outbox: 100% сдача обязательного теста T8', {
    x: 0.8, y: 0.95, w: 11.7, h: 0.6,
    fontFace: 'Arial', fontSize: 26, bold: true, color: C_TEXT_DARK, margin: 0
  });

  // Card 1: Outbox Pattern
  addCard(slide, 0.8, 1.8, 3.7, 4.8);
  slide.addText('Атомарная фиксация', {
    x: 1.1, y: 2.1, w: 3.1, h: 0.4,
    fontFace: 'Arial', fontSize: 18, bold: true, color: C_TEXT_DARK, margin: 0
  });
  slide.addText('При вызове талона оператором запись в notification_outbox выполняется в той же транзакции БД, что и смена статуса талона на CALLED.\n\nДаже при внезапном отказе питания уведомление гарантированно сохранено.', {
    x: 1.1, y: 2.7, w: 3.1, h: 3.5,
    fontFace: 'Calibri', fontSize: 14, color: C_MUTED, lineSpacingMultiple: 1.3, margin: 0
  });

  // Card 2: Resilience & Retries
  addCard(slide, 4.8, 1.8, 3.7, 4.8);
  slide.addText('Асинхронные ретраи', {
    x: 5.1, y: 2.1, w: 3.1, h: 0.4,
    fontFace: 'Arial', fontSize: 18, bold: true, color: C_TEXT_DARK, margin: 0
  });
  slide.addText('Фоновый Outbox Dispatcher с экспоненциальным backoff (1s, 2s, 4s) опрашивает очередь.\n\nПри HTTP 503 или таймауте провайдера сообщение уходит в повтор без задержки оператора (0ms delay на вызове).', {
    x: 5.1, y: 2.7, w: 3.1, h: 3.5,
    fontFace: 'Calibri', fontSize: 14, color: C_MUTED, lineSpacingMultiple: 1.3, margin: 0
  });

  // Card 3: T8 Verification & Demo
  addCard(slide, 8.8, 1.8, 3.7, 4.8);
  slide.addText('Тест T8 и Demo Adapter', {
    x: 9.1, y: 2.1, w: 3.1, h: 0.4,
    fontFace: 'Arial', fontSize: 18, bold: true, color: C_TEXT_DARK, margin: 0
  });
  slide.addText('Встроен автономный notification-demo контейнер с симуляцией сбоев (503, таймауты).\n\nИнтеграционный тест TestT8_NotificationProviderOutageVerifiesQueueReliability официально подтверждает надежность ядра.', {
    x: 9.1, y: 2.7, w: 3.1, h: 3.5,
    fontFace: 'Calibri', fontSize: 14, color: C_MUTED, lineSpacingMultiple: 1.3, margin: 0
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 5: Точный расчет времени ожидания — ETA (Light)
// ─────────────────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: C_BG_LIGHT };

  slide.addText('ИНТЕЛЛЕКТУАЛЬНАЯ АНАЛИТИКА', {
    x: 0.8, y: 0.6, w: 11.7, h: 0.3,
    fontFace: 'Arial', fontSize: 11, bold: true, color: C_DEEP_BLUE, margin: 0
  });
  slide.addText('Расчет времени ожидания (ETA) и фильтрация выбросов', {
    x: 0.8, y: 0.95, w: 11.7, h: 0.6,
    fontFace: 'Arial', fontSize: 26, bold: true, color: C_TEXT_DARK, margin: 0
  });

  // Stat Callout 1
  addCard(slide, 0.8, 1.8, 3.6, 2.2);
  slide.addText('≤ 7 200 сек', {
    x: 1.1, y: 2.0, w: 3.0, h: 0.8,
    fontFace: 'Arial', fontSize: 36, bold: true, color: C_NAVY, margin: 0
  });
  slide.addText('Фильтр выбросов длительности (2 часа). «Забытые» операторами талоны отсекаются от обучающей выборки.', {
    x: 1.1, y: 2.9, w: 3.0, h: 0.9,
    fontFace: 'Calibri', fontSize: 13, color: C_MUTED, margin: 0
  });

  // Stat Callout 2
  addCard(slide, 4.8, 1.8, 3.6, 2.2);
  slide.addText('P90 + Weighted', {
    x: 5.1, y: 2.0, w: 3.0, h: 0.8,
    fontFace: 'Arial', fontSize: 32, bold: true, color: C_DEEP_BLUE, margin: 0
  });
  slide.addText('Экспоненциальное взвешивание последних 20 талонов дает актуальный темп работы отделения в текущий час.', {
    x: 5.1, y: 2.9, w: 3.0, h: 0.9,
    fontFace: 'Calibri', fontSize: 13, color: C_MUTED, margin: 0
  });

  // Stat Callout 3
  addCard(slide, 8.8, 1.8, 3.7, 2.2);
  slide.addText('N окон', {
    x: 9.1, y: 2.0, w: 3.0, h: 0.8,
    fontFace: 'Arial', fontSize: 36, bold: true, color: C_SUCCESS, margin: 0
  });
  slide.addText('Дискретная симуляция распределяет очередь впереди стоящих клиентов по открытым окнам параллельно.', {
    x: 9.1, y: 2.9, w: 3.0, h: 0.9,
    fontFace: 'Calibri', fontSize: 13, color: C_MUTED, margin: 0
  });

  // Bottom Explanatory Card
  addCard(slide, 0.8, 4.3, 11.7, 2.3);
  slide.addText('Алгоритм работы симулятора ожидания:', {
    x: 1.1, y: 4.5, w: 11.1, h: 0.4,
    fontFace: 'Arial', fontSize: 16, bold: true, color: C_TEXT_DARK, margin: 0
  });
  slide.addText('1. Определяются все открытые окна, привязанные к услуге талона, с учетом их текущей занятости и остатка времени.\n2. Впереди стоящие клиенты (position - 1) виртуально распределяются в окно с наименьшим временем освобождения.\n3. Рассчитанный результат формирует точный интервал EstimatedCallAt, отображаемый на электронном табло и в талоне.', {
    x: 1.1, y: 5.0, w: 11.1, h: 1.4,
    fontFace: 'Calibri', fontSize: 14, color: C_MUTED, lineSpacingMultiple: 1.3, margin: 0
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 6: Отказоустойчивость и безопасность (Light)
// ─────────────────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: C_BG_LIGHT };

  slide.addText('PRODUCTION READY', {
    x: 0.8, y: 0.6, w: 11.7, h: 0.3,
    fontFace: 'Arial', fontSize: 11, bold: true, color: C_DEEP_BLUE, margin: 0
  });
  slide.addText('Отказоустойчивость инфраструктуры и безопасность', {
    x: 0.8, y: 0.95, w: 11.7, h: 0.6,
    fontFace: 'Arial', fontSize: 26, bold: true, color: C_TEXT_DARK, margin: 0
  });

  const secCards = [
    {
      title: 'Watchdog & Самоисцеление',
      bullets: [
        'Поминутный cron-мониторинг всех 11 контейнеров отделения.',
        'Автоматический перезапуск упавших сервисов (restart: always).',
        'Мгновенный Telegram-алерт дежурному инженеру при деградации.'
      ]
    },
    {
      title: 'Сетевая безопасность',
      bullets: [
        'Strict CORS Whitelist: исключены уязвимости loose wildcard matching.',
        'In-memory Rate Limiter на авторизацию операторов и администратора.',
        'Защищенные Cookie (HttpOnly, Secure, SameSite=Lax).'
      ]
    },
    {
      title: 'Отказоустойчивый HTTPS',
      bullets: [
        'Полноценный Let\'s Encrypt SSL-сертификат для pointers-team.tech.',
        'Резервный домен post-queue.duckdns.org и прямой IP-доступ.',
        'Nginx с TLS 1.3, HTTP/2 и буферизацией 4k для мгновенной отдачи.'
      ]
    }
  ];

  secCards.forEach((sc, i) => {
    const x = 0.8 + i * 4.0;
    addCard(slide, x, 1.8, 3.7, 4.8);

    slide.addText(sc.title, {
      x: x + 0.3, y: 2.1, w: 3.1, h: 0.5,
      fontFace: 'Arial', fontSize: 18, bold: true, color: C_TEXT_DARK, margin: 0
    });

    sc.bullets.forEach((b, bIdx) => {
      slide.addText(`• ${b}`, {
        x: x + 0.3, y: 2.8 + bIdx * 1.1, w: 3.1, h: 1.0,
        fontFace: 'Calibri', fontSize: 13, color: C_MUTED, lineSpacingMultiple: 1.25, margin: 0
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 7: Интерфейсы системы и автономность (Light)
// ─────────────────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: C_BG_LIGHT };

  slide.addText('ПОЛЬЗОВАТЕЛЬСКИЙ ОПЫТ', {
    x: 0.8, y: 0.6, w: 11.7, h: 0.3,
    fontFace: 'Arial', fontSize: 11, bold: true, color: C_DEEP_BLUE, margin: 0
  });
  slide.addText('4 специализированных интерфейса и полная автономность', {
    x: 0.8, y: 0.95, w: 11.7, h: 0.6,
    fontFace: 'Arial', fontSize: 26, bold: true, color: C_TEXT_DARK, margin: 0
  });

  const uis = [
    {
      name: 'Табло зала (TV Board)',
      desc: 'Контрастное отображение текущих вызовов по окнам, голосовой синтез объявлений (Web Speech API) и звуковой гонг.'
    },
    {
      name: 'Пульт оператора',
      desc: 'Вызов следующего талона по каноническому детерминизму, вызов конкретного номера, управление перерывами и сменами.'
    },
    {
      name: 'Киоск самообслуживания',
      desc: 'Моментальная выдача талонов по QR-коду и живой очереди, сканирование броней предварительной записи.'
    },
    {
      name: 'Администратор ОПС',
      desc: 'Оперативное изменение весов очередей, управление услугами окон, мониторинг нагрузки и аналитика времени ожидания.'
    }
  ];

  uis.forEach((u, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.8 + col * 6.0;
    const y = 1.8 + row * 2.5;

    addCard(slide, x, y, 5.7, 2.2);

    slide.addText(u.name, {
      x: x + 0.3, y: y + 0.3, w: 5.1, h: 0.4,
      fontFace: 'Arial', fontSize: 17, bold: true, color: C_NAVY, margin: 0
    });
    slide.addText(u.desc, {
      x: x + 0.3, y: y + 0.8, w: 5.1, h: 1.2,
      fontFace: 'Calibri', fontSize: 14, color: C_MUTED, lineSpacingMultiple: 1.25, margin: 0
    });
  });

  // Offline note
  slide.addText('Локальный бандлинг: Tailwind CSS и шрифты упакованы автономно (отсутствие внешних CDN обеспечивает работу при отключении внешнего интернета).', {
    x: 0.8, y: 6.8, w: 11.7, h: 0.4,
    fontFace: 'Calibri', fontSize: 12, italic: true, color: C_MUTED, margin: 0
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 8: Результаты и стенд (Dark Navy)
// ─────────────────────────────────────────────────────────────────────────────
{
  const slide = pres.addSlide();
  slide.background = { color: C_DARK_BG };

  slide.addText('РЕЗУЛЬТАТЫ ИСПЫТАНИЙ', {
    x: 0.8, y: 0.8, w: 11.7, h: 0.3,
    fontFace: 'Arial', fontSize: 12, bold: true, color: C_CYAN, margin: 0
  });
  slide.addText('100% готовность к пилотному внедрению', {
    x: 0.8, y: 1.15, w: 11.7, h: 0.6,
    fontFace: 'Arial', fontSize: 32, bold: true, color: C_WHITE, margin: 0
  });

  // Matrix Card 1
  addCard(slide, 0.8, 2.2, 3.6, 3.4, '001F3F', '0EA5E9');
  slide.addText('10 из 10', {
    x: 1.1, y: 2.6, w: 3.0, h: 0.8,
    fontFace: 'Arial', fontSize: 40, bold: true, color: C_CYAN, margin: 0
  });
  slide.addText('Официальных тестов ТЗ (T1–T10) успешно сданы, включая T8 Outbox Outage.', {
    x: 1.1, y: 3.6, w: 3.0, h: 1.6,
    fontFace: 'Calibri', fontSize: 15, color: 'CBD5E1', lineSpacingMultiple: 1.2, margin: 0
  });

  // Matrix Card 2
  addCard(slide, 4.8, 2.2, 3.6, 3.4, '001F3F', '0EA5E9');
  slide.addText('0.42 сек', {
    x: 5.1, y: 2.6, w: 3.0, h: 0.8,
    fontFace: 'Arial', fontSize: 40, bold: true, color: C_SUCCESS, margin: 0
  });
  slide.addText('Время выполнения интеграционного стресс-теста T8 при полной имитации отказа внешнего шлюза.', {
    x: 5.1, y: 3.6, w: 3.0, h: 1.6,
    fontFace: 'Calibri', fontSize: 15, color: 'CBD5E1', lineSpacingMultiple: 1.2, margin: 0
  });

  // Matrix Card 3
  addCard(slide, 8.8, 2.2, 3.7, 3.4, '001F3F', '0EA5E9');
  slide.addText('100% TLS', {
    x: 9.1, y: 2.6, w: 3.0, h: 0.8,
    fontFace: 'Arial', fontSize: 40, bold: true, color: C_WHITE, margin: 0
  });
  slide.addText('Действующий доверенный сертификат Let\'s Encrypt и автоперезапуск контейнеров через Watchdog.', {
    x: 9.1, y: 3.6, w: 3.0, h: 1.6,
    fontFace: 'Calibri', fontSize: 15, color: 'CBD5E1', lineSpacingMultiple: 1.2, margin: 0
  });

  // Footer Links
  slide.addText('Демо-стенд: https://pointers-team.tech  |  Резерв: https://post-queue.duckdns.org  |  Спасибо за внимание!', {
    x: 0.8, y: 6.2, w: 11.7, h: 0.4,
    fontFace: 'Arial', fontSize: 15, bold: true, color: C_CYAN, margin: 0
  });
}

const outputPath = path.join(__dirname, 'postcode_queue_presentation.pptx');
pres.writeFile({ fileName: outputPath })
  .then(() => {
    console.log(`Presentation generated successfully: ${outputPath}`);
  })
  .catch(err => {
    console.error('Error generating presentation:', err);
    process.exit(1);
  });
