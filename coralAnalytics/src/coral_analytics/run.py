import argparse
import logging
import os
from datetime import date
from pathlib import Path

from coral_analytics.downloadreport import download_file
from coral_analytics.postgres_store import (
    create_local_engine,
    create_schema,
    process_report_bytes,
    reset_schema,
)


logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)


def parse_report_date(file_name: str, override: str | None) -> date:
    if override:
        return date.fromisoformat(override)
    try:
        return date.fromisoformat(Path(file_name).stem)
    except ValueError:
        return date.today()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Coral Club Excel reports into PostgreSQL")
    parser.add_argument("--file", help="Import an existing Excel file instead of downloading")
    parser.add_argument("--date", help="Report date in YYYY-MM-DD format")
    parser.add_argument("--init-schema", action="store_true", help="Create the local database schema only")
    parser.add_argument("--reset-schema", action="store_true", help="Drop and recreate Coral tables and view")
    args = parser.parse_args()

    if args.init_schema or args.reset_schema:
        engine = create_local_engine()
        try:
            if args.reset_schema:
                reset_schema(engine)
                logger.info("Coral database schema reset")
            else:
                create_schema(engine)
                logger.info("Database schema initialized")
        finally:
            engine.dispose()
        return

    report_dir = Path(os.environ.get("REPORT_DIR", "/data/reports"))
    report_date_override = args.date or os.environ.get("REPORT_DATE") or None

    if args.file:
        report_path = Path(args.file)
        report_date = parse_report_date(report_path.name, report_date_override)
        report_contents = report_path.read_bytes()
    else:
        report_date = parse_report_date(report_date_override or date.today().isoformat(), None)
        report_dir.mkdir(parents=True, exist_ok=True)
        report_path = report_dir / f"{report_date.isoformat()}.xlsx"
        report_period = os.environ.get("REPORT_PERIOD") or report_date.strftime("%Y%m")
        report_contents = download_file(
            os.environ["CORAL_LOGIN"],
            os.environ["CORAL_PASSWORD"],
            os.environ.get("CORAL_LANG", "gb"),
            os.environ.get("REPORT_TYPE", "CDXPRep"),
            report_period,
        )
        report_path.write_bytes(report_contents)

    engine = create_local_engine()
    try:
        create_schema(engine)
        row_count = process_report_bytes(
            engine, report_contents, report_path.name, report_date
        )
        logger.info("Imported %d rows from %s for %s", row_count, report_path.name, report_date)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()