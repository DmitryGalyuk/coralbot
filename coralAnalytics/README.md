# Coral Analytics

Локальный ETL для отчётов Coral Club: скачивание Excel, преобразование через pandas и запись напрямую в PostgreSQL. Azure Functions, Blob Storage и промежуточный Parquet в этом сервисе не используются.

## Состав

- `db` — PostgreSQL 16 с постоянным Docker volume.
- `schema-init` — одноразовая инициализация таблиц, title lookup и view перед запуском Superset; Coral credentials не нужны.
- `reset-db` — ручной destructive task для отладки: пересоздаёт только `dailystats`, `titles` и `coralview`, не удаляя metadata Superset.
- `importer` — одноразовый Python job: скачивает или читает Excel, преобразует его и делает upsert в `dailystats`.
- `superset` — Apache Superset, запускается отдельно профилем `bi`; его metadata хранится в отдельной базе `superset`.
- `data/reports/incoming` — скачанные или ожидающие обработки Excel-файлы.
- `data/reports/processed` — локальный архив Excel после успешной загрузки в PostgreSQL.
- `data/backups/postgres` — локальные custom-format дампы PostgreSQL; содержимое `data/` не попадает в git.

В Superset добавьте подключение к аналитической БД `coral` по адресу `db:5432`. Встроенная metadata DB Superset не используется для данных отчёта.

## Запуск

1. Создать локальный env-файл: `cp .env.example .env`, затем задать Coral credentials и локальный пароль PostgreSQL.
2. Запустить PostgreSQL: `docker compose up -d db`.
3. Выполнить ежедневный импорт: `docker compose run --rm importer`.

Для локального запуска BI: `docker compose --profile bi up -d --build superset`, затем открыть `http://localhost:8088`. Если в `superset/` есть dataset и dashboard exports, Superset импортирует их при старте; сами exports можно хранить в Git. На домашнем сервере порт Superset публикуется на сетевых интерфейсах хоста, поэтому ограничьте доступ firewall-ом и используйте VPN или защищённый reverse proxy.

Для полного сброса Coral-таблиц во время отладки: `docker compose --profile maintenance run --rm reset-db`. Команда удаляет данные `dailystats` и пересоздаёт справочник и view; она не удаляет Superset metadata или PostgreSQL volume целиком.

Управление домашним сервером выполняется только через `coralctl`: `coralctl restart` перезапускает контейнеры, `coralctl rebuild` пересобирает образы, а `coralctl setup` включает оба таймера. Ни одна из этих команд не сбрасывает БД; восстановление возможно только явной командой `coralctl restore FILE` или `coralctl setup --bacpac FILE`.

Схема создаёт таблицы `dailystats` и `titles`, наполняет `titles` справочником рангов и создаёт `public.coralview`. View вычисляет календарные поля, `IsDirector`, `IsLatestDate`, `TitleName`/`TitleRank`; `Path` строится как цепочка ID от корня структуры в рамках даты snapshot. Имя отчёта сохраняется в `file_name`, дата отчёта берётся из `REPORT_DATE`, если задана, иначе из текущей локальной даты. Период скачивания можно переопределить через `REPORT_PERIOD`.

Повторная загрузка за ту же дату обновляет строки с совпадающим `id`, а не добавляет дубликаты.

## Исторический архив отчётов

Скопируйте Excel-файлы в `coralAnalytics/data/reports/incoming/`, сохраняя дату в имени как `YYYY-MM-DD.xlsx`, затем запустите:

```sh
coralAnalytics/coralctl reports --pending-only
```

Отчёт перемещается в `processed/` только после успешной загрузки в PostgreSQL и refresh `public.coral_stats_mv`. При ошибке он остаётся в `incoming/` для повтора. Для очереди исторических отчётов materialized view обновляется один раз после всей успешной очереди. Ежедневный timer сначала обрабатывает ожидающие файлы, затем скачивает новый отчёт и после успеха загружает оба каталога в Google Drive. Синхронизация использует `rclone copy`, поэтому удаление локального файла не удаляет облачную копию.

## Домашний Linux-сервер

Установите `rclone` (на Debian/Ubuntu: `sudo apt install rclone`). Выполните `rclone config` под тем же Linux-пользователем, который запускает Coral, и создайте Google Drive remote. Например, если remote называется `coral-analytics`, задайте `RCLONE_REMOTE=coral-analytics:coralbot` в `coralAnalytics/.env`; часть после двоеточия — папка в Drive. Google-аккаунту в remote нужен Editor/write доступ к этой папке, а OAuth scope должен разрешать запись. OAuth-конфигурация `rclone` остаётся в домашнем каталоге пользователя, а не в Git.

Проверка доступа: `rclone lsd coral-analytics:coralbot` должна показать папку. Для создания/загрузки каталогов нужен write доступ; `Permission denied` означает, что аккаунт не Editor либо remote авторизован с read-only scope. Переподключите remote через `rclone config reconnect coral-analytics:` и выберите полный Drive access, либо выдайте используемому аккаунту Editor на папку, затем повторите `coralctl sync`.

```sh
git checkout <нужная-ветка>
cp coralAnalytics/.env.example coralAnalytics/.env
# Заполнить Coral credentials, пароли и RCLONE_REMOTE
chmod +x coralAnalytics/coralctl
coralAnalytics/coralctl setup --schedule 02:00
```

`coralctl` поддерживает эти команды:

```sh
coralAnalytics/coralctl setup --schedule 02:00
coralAnalytics/coralctl restart
coralAnalytics/coralctl rebuild
coralAnalytics/coralctl reports --pending-only
coralAnalytics/coralctl backup
coralAnalytics/coralctl restore coral_20261106T030000Z.dump
coralAnalytics/coralctl sync
coralAnalytics/coralctl status
```

`setup` сразу импортирует текущий отчёт, затем ставит два timer: ежедневную загрузку отчётов и PostgreSQL backup в день `BACKUP_DAY` (по умолчанию 15-е число, время `BACKUP_TIME`, по умолчанию 03:00). Оба запускают те же команды, что и вручную. Если `.env` отсутствует, `coralctl` создаёт его из `.env.example` и останавливается для заполнения.

Во время setup `coralctl` печатает текущий этап (`Checking Google Drive folders`, build, database, Superset, timers, first report). Операции rclone имеют сетевые таймауты; если команда остановилась, последняя строка показывает, какой шаг проверить.

`backup` создаёт локальный `pg_dump` custom archive, проверяет его и отправляет в Drive. По умолчанию локально сохраняются последние три успешно загруженных дампа (`BACKUP_KEEP_LOCAL=3`); Google Drive-копии не удаляются. `restore FILE` перед восстановлением делает текущую резервную копию, восстанавливает во временную БД и просит подтвердить переключение.

Для BACPAC используйте `coralAnalytics/coralctl setup --bacpac FILE`; без этого параметра база не восстанавливается. Скрипт проверяет Linux x86_64, Docker Compose, rclone remote и user-level systemd. Если необходимо, он включает lingering через `sudo loginctl enable-linger`, чтобы timers работали после выхода пользователя.

Статус расписаний: `systemctl --user list-timers coral-reports.timer coral-backup.timer`. Логи: `journalctl --user -u coral-reports.service` и `journalctl --user -u coral-backup.service`. Отчёты и дампы хранятся локально под `coralAnalytics/data/` и копируются в remote, не синхронизируются с удалением. Superset доступен по настроенному `SUPERSET_LOCAL_PORT`; для внешнего доступа используйте VPN/firewall.

## Подключение к PostgreSQL

Из другой Compose-службы адрес базы: `db:5432`, база: `coral` (или значение `POSTGRES_DB`). С хоста используется `localhost:${POSTGRES_LOCAL_PORT}`. Для Superset подключать именно базу `coral`, а не внутреннюю базу метаданных Superset.

База `superset` создаётся init-скриптом только при первом создании volume PostgreSQL. Если изменить имя пользователя PostgreSQL, владельца базы в `init-db/01-create-superset-db.sql` тоже нужно изменить. `SUPERSET_SECRET_KEY` следует заменить на случайный секрет и хранить только в локальном `.env`.