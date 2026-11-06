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

Для запуска BI: `docker compose --profile bi up -d --build superset`, затем открыть `http://localhost:8088`. Если в `superset/` есть dataset и dashboard exports, Superset импортирует их при старте; сами exports теперь можно хранить в Git. Для сервера Superset опубликован только на localhost; внешний доступ настраивайте через VPN или reverse proxy с аутентификацией.

Для полного сброса Coral-таблиц во время отладки: `docker compose --profile maintenance run --rm reset-db`. Команда удаляет данные `dailystats` и пересоздаёт справочник и view; она не удаляет Superset metadata или PostgreSQL volume целиком.

Для безопасного перезапуска Postgres и Superset на домашнем сервере используйте `./restart-home-linux.sh`. Эта команда только перезапускает контейнеры и не запускает восстановление BACPAC. После `git pull`, если нужно пересобрать образы, используйте `./restart-home-linux.sh --build`; данные PostgreSQL остаются в Docker volume.

## Восстановление SQL Server BACPAC

`restore_bacpac.py` использует схему и данные из BACPAC как источник истины: импортирует архив во временную SQL Server базу, переносит её в отдельную PostgreSQL базу и запускает проектный `schema-init` для заполнения `titles` и создания `coralview`. Старые SQL-проекты при этом не используются. Нужны Docker Compose, `psql`, SQL Server с правом создавать базы и PostgreSQL-пользователь с правами создания баз. По умолчанию требуются `sqlpackage` и `pgloader` в `PATH`; для Docker-mode нужны `docker`, доступная общая сеть и имя PostgreSQL сервиса в этой сети.

```sh
SQLSERVER_URL='mssql://user:password@server:1433/master' \
POSTGRES_URL='postgresql://coral:password@localhost:5432/coral' \
python3 restore_bacpac.py azure_db_backup/coral-2026-11-5-16-17.bacpac \
	--confirm-database coral
```

Для контейнерного запуска `sqlpackage` и `pgloader` задайте `RESTORE_DOCKER_NETWORK` и `PGLOADER_POSTGRES_HOST`, например `coralanalytics_default` и `db`. SQL Server должен быть доступен по `SQLSERVER_URL` в этой же Docker-сети.

Скрипт просит интерактивно подтвердить имя целевой базы. Только после успешного импорта, инициализации схемы и проверки `coralview` он заменяет целевую базу; база `superset` не затрагивается. SQL Server views из BACPAC не копируются; PostgreSQL `coralview` создаётся проектным initializer.

Схема создаёт таблицы `dailystats` и `titles`, наполняет `titles` справочником рангов и создаёт `public.coralview`. View вычисляет календарные поля, `IsDirector`, `IsLatestDate`, `TitleName`/`TitleRank`; `Path` строится как цепочка ID от корня структуры в рамках даты snapshot. Имя отчёта сохраняется в `file_name`, дата отчёта берётся из `REPORT_DATE`, если задана, иначе из текущей локальной даты. Период скачивания можно переопределить через `REPORT_PERIOD`.

Повторная загрузка за ту же дату обновляет строки с совпадающим `id`, а не добавляет дубликаты.

## Импорт готового Excel

Поместить файл в `data/reports` и выполнить, например:

```sh
docker compose run --rm importer --file /data/reports/2026-11-04.xlsx
```

Имя файла должно содержать дату в формате `YYYY-MM-DD.xlsx`, либо нужно передать `--date YYYY-MM-DD`.

## Ночное расписание

Для переноса на домашний Linux-сервер:

```sh
git checkout <нужная-ветка>
cp coralAnalytics/.env.example coralAnalytics/.env
# Заполнить Coral credentials и локальные пароли в coralAnalytics/.env
chmod +x coralAnalytics/deploy-home-linux.sh
coralAnalytics/deploy-home-linux.sh --schedule 02:00
```

Один управляющий скрипт запускает сервисы и каждый раз устанавливает/включает daily user-level `systemd` timer. Если `.env` отсутствует, скрипт создаёт его из `.env.example` и останавливается, чтобы можно было заполнить секреты. Примеры:

```sh
# Обычный запуск/обновление с использованием Docker build cache
coralAnalytics/deploy-home-linux.sh --schedule 02:00

# Только перезапуск контейнеров без пересборки
coralAnalytics/deploy-home-linux.sh --restart

# Пересборка образов без Docker build cache
coralAnalytics/deploy-home-linux.sh --rebuild

# Явно восстановить BACPAC; перед заменой базы будет запрошено подтверждение
coralAnalytics/deploy-home-linux.sh \
	--bacpac coralAnalytics/azure_db_backup/coral-2026-11-5-16-17.bacpac \
	--schedule 02:00
```

Без `--bacpac` скрипт не запускает restore и не меняет данные PostgreSQL. `--restart` нельзя совмещать с `--bacpac`. При restore скрипт поднимет временный SQL Server и попросит подтвердить замену базы; SQL Server staging удаляется после восстановления. Каталог `azure_db_backup` исключён из Git.

Если lingering ещё выключен, скрипт включает его через `sudo loginctl enable-linger "$USER"`, чтобы timer работал после выхода пользователя и перезагрузки. Пользователь должен иметь доступ к Docker. Статус расписания: `systemctl --user list-timers coral-import.timer`; логи: `journalctl --user -u coral-import.service`. Superset опубликован согласно `SUPERSET_LOCAL_PORT`; для внешнего доступа используйте firewall и VPN, не открывайте порт в интернет без защиты.

Проверка timer: `systemctl --user status coral-import.timer`. Логи импорта: `journalctl --user -u coral-import.service`; логи базы: `docker compose -f coralAnalytics/docker-compose.yml logs db`. Docker volume не заменяет резервные копии: настройте периодический `pg_dump` на другой диск или удалённое хранилище.

## Подключение к PostgreSQL

Из другой Compose-службы адрес базы: `db:5432`, база: `coral` (или значение `POSTGRES_DB`). С хоста используется `localhost:${POSTGRES_LOCAL_PORT}`. Для Superset подключать именно базу `coral`, а не внутреннюю базу метаданных Superset.

База `superset` создаётся init-скриптом только при первом создании volume PostgreSQL. Если изменить имя пользователя PostgreSQL, владельца базы в `init-db/01-create-superset-db.sql` тоже нужно изменить. `SUPERSET_SECRET_KEY` следует заменить на случайный секрет и хранить только в локальном `.env`.