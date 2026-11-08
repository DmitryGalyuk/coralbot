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

Управление домашним сервером выполняется через `coralctl`. Запуск без команды показывает справку и ничего не меняет. `setup` запускает сервисы и включает таймеры, но не скачивает и не импортирует отчёт. Для отдельных действий используйте `build-importer`, `download-report`, `process-reports`, `refresh-view`, `backup-db`, `sync-reports` и `sync-db-backups`. Восстановление возможно только явными командами `restore FILE` или `restore-bacpac FILE`.

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
coralAnalytics/coralctl build-importer
coralAnalytics/coralctl download-report
coralAnalytics/coralctl process-reports
coralAnalytics/coralctl refresh-view
coralAnalytics/coralctl backup-db
coralAnalytics/coralctl sync-reports
coralAnalytics/coralctl sync-db-backups
coralAnalytics/coralctl restore-db coral_20261106T030000Z.dump
coralAnalytics/coralctl restore-bacpac azure_db_backup/export.bacpac
coralAnalytics/coralctl export-superset
coralAnalytics/coralctl import-superset
coralAnalytics/coralctl sync
coralAnalytics/coralctl status
```

`download-report` только скачивает Excel в `incoming/`; уже существующий файл за ту же дату не перезаписывается. `process-reports` обрабатывает всю очередь и один раз обновляет `public.coral_stats_mv` после успешного импорта. `refresh-view` пересчитывает только эту materialized view. `build-importer` пересобирает образы, необходимые для запуска импортёра. `backup-db` создаёт и проверяет локальный дамп, затем копирует его в Google Drive. Команды `sync-reports` и `sync-db-backups` отдельно повторяют загрузку соответствующих локальных архивов в Drive.

`setup` ставит два timer: ежедневный составной цикл загрузки/импорта отчётов и PostgreSQL backup в день `BACKUP_DAY` (по умолчанию 15-е число, время `BACKUP_TIME`, по умолчанию 03:00). Таймеры продолжают запускать объединённые операции; вручную доступны отдельные команды выше. Если `.env` отсутствует, `coralctl` создаёт его из `.env.example` и останавливается для заполнения.

Во время setup `coralctl` печатает текущий этап (build, database, Superset, timers). Операции rclone имеют сетевые таймауты; если команда остановилась, последняя строка показывает, какой шаг проверить.

`backup-db` создаёт локальный `pg_dump` custom archive, проверяет его и отправляет в Drive. По умолчанию локально сохраняются последние три успешно загруженных дампа (`BACKUP_KEEP_LOCAL=3`); Google Drive-копии не удаляются. `restore-db FILE` перед восстановлением делает текущую резервную копию, восстанавливает во временную БД и просит подтвердить переключение. `restore FILE` остаётся alias.

`export-superset` и `import-superset` требуют запущенный Superset. Экспорт создаёт новые датированные YAML-каталоги в `coralAnalytics/superset/`; закоммитьте их в Git. Импорт применяет последние dataset и dashboard exports. Superset также импортирует эти файлы при каждом старте.

Для редкого восстановления BACPAC, экспортированного из Azure SQL и уже доступного локальным файлом, используйте `coralAnalytics/coralctl restore-bacpac FILE`. Команда не включает таймеры и не запускает импорт отчёта; она требует Linux x86_64 и интерактивно подтверждает замену базы. Автоматического скачивания BACPAC из Azure в CLI пока нет.

Статус расписаний: `systemctl --user list-timers coral-reports.timer coral-backup.timer`. Логи: `journalctl --user -u coral-reports.service` и `journalctl --user -u coral-backup.service`. Отчёты и дампы хранятся локально под `coralAnalytics/data/` и копируются в remote, не синхронизируются с удалением. Superset доступен по настроенному `SUPERSET_LOCAL_PORT`; для внешнего доступа используйте VPN/firewall.

## Подключение к PostgreSQL

Из другой Compose-службы адрес базы: `db:5432`, база: `coral` (или значение `POSTGRES_DB`). С хоста используется `localhost:${POSTGRES_LOCAL_PORT}`. Для Superset подключать именно базу `coral`, а не внутреннюю базу метаданных Superset.

База `superset` создаётся init-скриптом только при первом создании volume PostgreSQL. Если изменить имя пользователя PostgreSQL, владельца базы в `init-db/01-create-superset-db.sql` тоже нужно изменить. `SUPERSET_SECRET_KEY` следует заменить на случайный секрет и хранить только в локальном `.env`.