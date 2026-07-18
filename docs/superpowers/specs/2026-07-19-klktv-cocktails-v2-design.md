# klktv-cocktails v2 — дизайн новой версии

**Дата:** 2026-07-19
**Статус:** утверждён к реализации (дизайн одобрен владельцем)
**Ветка:** `v2`
**Основано на:** [аудите текущей системы](../../audit/2026-07-19-current-system-audit.md)

## 1. Контекст и цель

Закрытая по логину база напитков и еды бара Kollektiv (карта + обучение персонала). Текущая версия на проде, активно используется, данные заполнены. Задача — новая версия: клиентский фронт с нуля на **Kollektiv UI Kit**, бэкенд оставляем и чистим, схему эволюционируем, все данные переносим в новую (dev) БД без потерь.

**Принципы:**
- Новый функционал ≥ текущего прода (мерило — [инвентарь фич](../../audit/details/frontend-inventory.md)).
- Идеальный таргет UX — готовые страницы кита (`block-cocktail-guide`).
- Прод живёт параллельно; новая БД — dev; миграция повторяемая; cutover — когда готова новая админка.

## 2. Продуктовые решения (утверждены)

1. **Безалко вливается в «Авторские».** Разделы «Non Alco» (`zero`) и «Zero Culture» (`zc`) упраздняются как отдельные секции; их напитки становятся частью меню авторских (с флагом алко/безалко и признаком бренд-линии ZC). Итог — 4 контентные секции: Авторские · Классика · Спириты · Кухня (совпадает с дефолтным bottom-nav кита).
2. **История/таймлайн — позже.** Данные (8 записей) сохраняем, раздел не строим в этот заход.
3. **Cutover:** прод — рабочая система, ETL повторяемый; переключение после готовности новой админки (Фаза 2).

## 3. Архитектура и стек

| Слой | Решение |
|---|---|
| Фронт | React 19 + Vite + TypeScript + Tailwind v4 + Kollektiv UI Kit (shadcn registry `@kollektiv`). Основа — блок `block-cocktail-guide`. Тема кита ставится первой; `lib/utils.ts` не откатываем на сток. |
| Бэк | FastAPI + SQLAlchemy 2.0 (keep-and-clean). **Alembic** — единственный источник схемы. |
| БД | Новая Postgres на Railway (`tokaido...:59246`). |
| Хостинг | Railway, 3 сервиса под v2 (front/back/postgres), параллельно проду. |
| Репо | Этот же репозиторий, ветка `v2`; `backend/` и `frontend/` в корне. |

**Не тащим в v2** (из аудита): сид в загрузочном пути, захардкоженные пароли/секреты, `create_all`+ручные ALTER, таблица `classic_progress`, `brand_country`/URL-в-имени, копипаст `admin.py`, строковые ABV/цена/КБЖУ/вес.

## 4. Целевая схема (эволюция)

Сохраняем реляционный скелет (справочники + M:N + FK с ON DELETE). Изменения ниже. Для всех ре-тайпнутых полей сохраняем сырой текст в `*_raw` (ничего не теряем).

### 4.1 Справочники
- `users` — без изменений (id, username unique, password_hash, role, name, created_at).
- `glasses`, `spirits`, `families`, `flavors`, `descriptors` — как есть.
- `badges` — +`sort_order`.
- `tags` — +`label` (консистентность со справочниками).
- `categories` (навигация) — остаются 4 видимые секции (menu/classics/spirits/kitchen); строки `zero`/`zc` удаляются. Флаг `is_visible` оставляем рабочим (в проде был мёртв).

### 4.2 `drinks` — единое меню (вбирает `cocktails` + `zero_cocktails` + `zc_drinks`)
- Ядро: `id`, `slug` unique, `name`, `img`, `subtitle` (было `tagline`), `sort_order`, `created_at`, `updated_at`.
- Тип: `is_alcoholic bool NOT NULL default true`; `is_zero_culture bool default false` (бренд-линия ZC — опознаётся бейджем/тегом внутри «Авторских»).
- Числа: `abv NUMERIC` + `abv_raw`; `price_amount NUMERIC` + `price_currency default '₽'` + `price_raw`; `volume_ml INTEGER` (кит ждёт volume).
- Безалко-атрибуты: `caffeine_level INT` (nullable), `is_carbonated bool` (nullable).
- Бокал/бейдж: `glass_id FK` (единый fallback вместо `glass_label_override`), `badge_id FK`.
- Стори-поля кита (маппинг из `cocktail_details` + новые): `recipe`, `garnish`, `pitch`, `about`, `naming`, `faq`, `photo`.
- M:N: `drink_tags`, `drink_flavors`, `drink_spirits` (мульти-спирт для strong-чипов).
- `drink_details` (id, drink_id FK CASCADE, label, text, sort_order) — общие блоки для нераспознанного контента (унифицирует три старые `*_details`).

### 4.3 `classics`
- `id`, `slug`, `name`, `family_id FK RESTRICT`, `year INT`, `origin`, `composition`/`recipe`, `glass_id FK` (единый fallback), `garnish`, `history`, `for_whom` (= kit `fits`), `sort_order`, timestamps.
- M:N: `classic_spirits`, `classic_descriptors`, `classic_related_drinks` (было `classic_related_cocktails`, теперь → `drinks`) — «наш ответ».

### 4.4 `spirit_categories` / `spirit_entries`
- Категории: как есть (`slug`, `label`, `sort_order`, `is_archived`).
- Записи: `abv NUMERIC` + `abv_raw`; `price_amount`+`price_currency`+`serving_ml`+`price_raw`; `flavour`, `brand` (очищенный), `country` (очищенный, без `регион:`), `description` (проза из `brand_country`), `source_url` (вынесенные URL), `features`, `cocktail_pairings`, `fact`. **Ретайр** `brand_country`.

### 4.5 `kitchen_categories` / `kitchen_dishes`
- Блюда: `weight_g INT` + `weight_raw`; `timing_min_low INT` + `timing_min_high INT` + `timing_raw`; `price_amount`+`price_currency`+`price_raw`; КБЖУ → `kcal_portion`, `protein_g`, `fat_g`, `carb_g`, `kcal_100g` + `nutrition_raw`; `description`, `tagline`, `serving`, `interesting_facts`.

### 4.6 Прогресс
- **Дроп** `classic_progress` (легаси, строгое подмножество `learning_progress`).
- `learning_progress` (user_id, kind, slug, learned_at). Целостность: при переименовании slug CRUD-слой мигрирует строки прогресса (фикс HIGH-2); фоновая чистка сирот. Kinds: `menu`, `classics`, `spirits`, `kitchen` (в проде заполнены classics/kitchen/menu).

### 4.7 `timeline_entries`
- Как есть; в UI пока не выводим.

## 5. Миграция данных (ETL прод → новая БД)

- Отдельный **идемпотентный, повторно-запускаемый** скрипт: прод read-only → трансформация → новая БД (upsert по slug).
- Маппинг: `cocktails`→`drinks(is_alcoholic=true)`, `zero_cocktails`→`drinks(is_alcoholic=false)`, `zc_drinks`→`drinks(is_zero_culture=true, is_alcoholic per row)`. Дубль **Upcykle Cola** (cocktails+zc) схлопывается в одну строку.
- Парсеры: ABV, цена (сумма/валюта/порция), КБЖУ (два формата), вес, тайминг. Сырой текст → `*_raw`.
- Спириты: разбор `brand`/`country`/`brand_country`, вынос URL, чистка `регион:`, фикс `Ирдандия`.
- Чистка тест-мусора (`test-tag`, `ДОБАВЛЕНО ИЗ UI`, `Тестовый`, `Обновлённый`, `Габа.`).
- Детали: известные лейблы → структурные поля кита; остальное → `drink_details`.
- Прогресс: переносим `learning_progress` как есть (kinds classics/kitchen/menu валидны после слияния).
- **Верификация после прогона:** счётчики по типам, отсутствие сирот прогресса, дубль схлопнут, ~10–20 нечисловых строк — ручной глазами (лог «требует внимания»).

## 6. Чистка бэкенда (keep-and-clean)

1. Alembic-baseline эволюционной схемы; убрать `create_all` + ручные ALTER + `_DATA_MIGRATIONS`.
2. Сид вон из загрузки: одноразовый провижн; бутстрап-админ из env; **никогда не переписывать существующие хеши/роли** (фикс C-1/HIGH-1).
3. Секреты `SECRET_KEY`/`DATABASE_URL` — required + fail-fast на старте (фикс C-2).
4. Обобщённая **slug-CRUD-фабрика** вместо копипасты `admin.py` (−~500 строк; фикс миграции прогресса HIGH-2 в одном месте).
5. Манифест: добавить `python-multipart`, `Pillow`; закоммитить `uv.lock`; ставить из манифеста, не из дивергентного Dockerfile.
6. Мелкие корректности: cookie логаута (secure/samesite/domain); `int(payload["sub"])`→401 вместо 500; upsert `mark_learned`; раздельные транзакции миграций; убрать мёртвый `role`-claim JWT; `/health` проверяет БД.
7. Дроп легаси-роутов прогресса `me.py` после перевода фронта.

## 7. Безопасность (по приоритету аудита)

C-1 (сид/пароли) и C-2 (секреты) — в §6. Далее: rate-limit логина (H-1), парольная политика ≥12 для админов (H-2), закрыть Swagger/openapi в проде (M-1), ревокация токенов + короткий TTL (M-2), CSRF-токен на мутации и аплоад (M-3), лимит пикселей Pillow (M-4), фикс user-enumeration по таймингу (M-5), миграция `python-jose`→PyJWT + pin/lock + pip-audit (M-6).

## 8. Фронт на ките — маппинг и паритет

Основа — `block-cocktail-guide` (файлы: shell/views/team-view/detail-sheet/page + data.ts как контракт). Секции:

| Секция кита | Источник данных | Прод-фичи к сохранению |
|---|---|---|
| Авторские (MenuView, media-card) | `drinks` | поиск (name/subtitle/flavors), фильтры спирит/бокал/**алко-безалко**, бейджи, learned, деталь-флеш-карточка (recipe/garnish/pitch/about/naming/faq/photo) |
| Классика (families tints) | `classics`+`families` | фильтры семейство/спирит, поиск, теория logic/evolution/tip, «наш ответ» кросс-линки → `drinks`, группировка «Все», прогресс по семействам |
| Спириты | `spirit_entries`+categories | категории, архив-режим (в карте/выведенные), деталь; **восстановить «В коктейлях»** (фикс бага поля) |
| Кухня | `kitchen_dishes`+categories | блюда курсами, фото 4:3, структурные КБЖУ/вес/тайминг |
| Прогресс + Команда | `learning_progress`, `users` | 6→4 kinds learned, две поверхности прогресса, ADMIN-таблица команды |

- **Улучшение:** реальные URL секций (кит отдаёт `route`/`onRouteChange`) — в проде их не было.
- **Данные:** единый bundle `GET /api/content` (нормализация под форму `data.ts` кита); прогресс через `/api/me/progress`.
- **Отложено:** раздел «История»; заполнение богатых полей кита (pitch/faq/naming) — контентом позже.

## 9. Фазы

- **Фаза 0 — данные:** финализировать DDL → Alembic baseline → ETL-скрипт → прогон в новую БД → верификация.
- **Фаза 1 — v2 параллельно проду:** бэк keep-and-clean на новой схеме (+фиксы §6–7) + клиентский фронт на ките (§8) → деплой на Railway. Команда правит прод; ETL перегоняем по мере надобности.
- **Фаза 2 — админка + cutover:** админка на ките (вне текущего блока — проектируем отдельно) → финальный ETL → переключение.

## 10. Критерии приёмки

- Все данные прода в новой БД, без потерь; сырой текст сохранён; дубли/тест-мусор устранены; верификация зелёная.
- Паритет фич: каждый пункт [инвентаря](../../audit/details/frontend-inventory.md) либо реализован, либо явно отложен с решением.
- Схема управляется Alembic; сид не в загрузочном пути; секреты required.
- Критичные баги безопасности (C-1, C-2) и потери данных (HIGH-1, HIGH-2) закрыты.
- v2 задеплоен на Railway и работает против новой БД параллельно проду.

## 11. Риски и открытые вопросы

- **Дрейф данных:** прод правят во время разработки → ETL обязан быть повторяемым; финальный прогон при cutover.
- **Ручная верификация** ~10–20 нечисловых строк (цены спиритов с порциями, два формата КБЖУ) — заложить время.
- **Админка вне кита** — форму спроектируем в Фазе 2 (отдельный дизайн-заход).
- **Богатые поля кита** (pitch/faq/naming/photo) в проде пусты — деградируют корректно (секции опциональны), наполняются позже.
