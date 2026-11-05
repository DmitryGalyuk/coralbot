# Coral Analytics

Локальный ETL для отчётов Coral Club: скачивание Excel, преобразование через pandas и запись напрямую в PostgreSQL. Azure Functions, Blob Storage и промежуточный Parquet в этом сервисе не используются.

## Состав

- `db` — PostgreSQL 16 с постоянным Docker volume.
- `schema-init` — одноразовая инициализация таблиц, title lookup и view перед запуском Superset; Coral credentials не нужны.
- `reset-db` — ручной destructive task для отладки: пересоздаёт только `dailystats`, `titles` и `coralview`, не удаляя metadata Superset.
- `importer` — одноразовый Python job: скачивает или читает Excel, преобразует его и делает upsert в `dailystats`.
- `superset` — Apache Superset, запускается отдельно профилем `bi`; его metadata хранится в отдельной базе `superset`.
- `data/reports` — локальный архив исходных Excel-файлов; содержимое не попадает в git.

В Superset добавьте подключение к аналитической БД `coral` по адресу `db:5432`. Встроенная metadata DB Superset не используется для данных отчёта.

## Запуск

1. Создать локальный env-файл: `cp .env.example .env`, затем задать Coral credentials и локальный пароль PostgreSQL.
2. Запустить PostgreSQL: `docker compose up -d db`.
3. Выполнить ежедневный импорт: `docker compose run --rm importer`.

Для запуска BI: `docker compose --profile bi up -d --build superset`, затем открыть `http://localhost:8088`. При старте Superset импортирует локально адаптированные dataset и dashboards из `superset/`; исходные экспорты не меняются. Для сервера Superset опубликован только на localhost; внешний доступ настраивайте через VPN или reverse proxy с аутентификацией.

Для полного сброса Coral-таблиц во время отладки: `docker compose --profile maintenance run --rm reset-db`. Команда удаляет данные `dailystats` и пересоздаёт справочник и view; она не удаляет Superset metadata или PostgreSQL volume целиком.

Схема создаёт таблицы `dailystats` и `titles`, наполняет `titles` справочником рангов и создаёт `public.coralview`. View вычисляет календарные поля, `IsDirector`, `IsLatestDate`, `TitleName`/`TitleRank`; `Path` строится как цепочка ID от корня структуры в рамках даты snapshot. Имя отчёта сохраняется в `file_name`, дата отчёта берётся из `REPORT_DATE`, если задана, иначе из текущей локальной даты. Период скачивания можно переопределить через `REPORT_PERIOD`.

Повторная загрузка за ту же дату обновляет строки с совпадающим `id`, а не добавляет дубликаты.

## Импорт готового Excel

Поместить файл в `data/reports` и выполнить, например:

```sh
docker compose run --rm importer --file /data/reports/2026-11-04.xlsx
```

Имя файла должно содержать дату в формате `YYYY-MM-DD.xlsx`, либо нужно передать `--date YYYY-MM-DD`.

## Ночное расписание

Контейнер загрузчика запускается как одноразовая задача, а расписание лучше поручить `systemd timer` на Linux-сервере. Команда для timer:

```sh
docker compose run --rm importer
```

Перед запуском по расписанию один раз собрать образ командой `docker compose build importer`. Путь к проекту и `.env` на сервере должны быть постоянными. Логи задачи доступны в журнале systemd; логи базы — через `docker compose logs db`.

## Подключение к PostgreSQL

Из другой Compose-службы адрес базы: `db:5432`, база: `coral` (или значение `POSTGRES_DB`). С хоста используется `localhost:${POSTGRES_LOCAL_PORT}`. Для Superset подключать именно базу `coral`, а не внутреннюю базу метаданных Superset.

База `superset` создаётся init-скриптом только при первом создании volume PostgreSQL. Если изменить имя пользователя PostgreSQL, владельца базы в `init-db/01-create-superset-db.sql` тоже нужно изменить. `SUPERSET_SECRET_KEY` следует заменить на случайный секрет и хранить только в локальном `.env`.