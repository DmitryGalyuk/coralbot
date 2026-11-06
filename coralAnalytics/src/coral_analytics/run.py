import argparse
import filecmp
import logging
import os
import re
import shutil
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
    stem = Path(file_name).stem
    try:
        return date.fromisoformat(stem)
    except ValueError as error:
        match = re.search(r"(?<!\d)(\d{4}-\d{2}-\d{2})(?!\d)", stem)
        if match:
            return date.fromisoformat(match.group(1))
        raise ValueError(
            f"Report filename must contain a YYYY-MM-DD date or use --date: {file_name}"
        ) from error


def archive_report(source: Path, processed_dir: Path) -> Path:
    processed_dir.mkdir(parents=True, exist_ok=True)
    source = source.resolve()
    if source.parent == processed_dir.resolve():
        return source

    destination = processed_dir / source.name
    if destination.exists():
        if filecmp.cmp(source, destination, shallow=False):
            if source.parent.name == "incoming":
                source.unlink()
            return destination
        stamp = f"{date.today():%Y%m%d}_{source.stat().st_mtime_ns}"
        destination = processed_dir / f"{source.stem}_{stamp}{source.suffix}"
        duplicate = 1
        while destination.exists():
            destination = processed_dir / f"{source.stem}_{stamp}_{duplicate}{source.suffix}"
            duplicate += 1

    if source.parent.name == "incoming":
        source.replace(destination)
    else:
        shutil.copy2(source, destination)
    return destination


def import_report(engine, report_path: Path, report_date: date, processed_dir: Path) -> int:
    report_contents = report_path.read_bytes()
    create_schema(engine)
    row_count = process_report_bytes(engine, report_contents, report_path.name, report_date)
    archive_path = archive_report(report_path, processed_dir)
    logger.info(
        "Imported %d rows from %s for %s; archived as %s",
        row_count,
        report_path.name,
        report_date,
        archive_path,
    )
    return row_count


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Coral Club Excel reports into PostgreSQL")
    parser.add_argument("--file", help="Import an existing Excel file instead of downloading")
    parser.add_argument("--date", help="Report date in YYYY-MM-DD format")
    parser.add_argument(
        "--pending-only",
        action="store_true",
        help="Import incoming reports without downloading a new report",
    )
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
    incoming_dir = Path(os.environ.get("REPORT_INCOMING_DIR", report_dir / "incoming"))
    processed_dir = Path(os.environ.get("REPORT_PROCESSED_DIR", report_dir / "processed"))
    report_date_override = args.date or os.environ.get("REPORT_DATE") or None

    if args.pending_only and args.file:
        parser.error("--pending-only cannot be combined with --file")

    incoming_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)
    engine = create_local_engine()
    try:
        pending_reports = []
        if not args.file:
            pending_reports = sorted(
                path
                for path in incoming_dir.iterdir()
                if path.is_file() and path.suffix.lower() == ".xlsx"
            )
            if pending_reports:
                logger.info("Processing %d pending report(s) from %s", len(pending_reports), incoming_dir)
            for report_path in pending_reports:
                report_date = parse_report_date(report_path.name, report_date_override)
                import_report(engine, report_path, report_date, processed_dir)

        if args.pending_only:
            if not pending_reports:
                logger.info("No pending reports found in %s", incoming_dir)
            return

        if args.file:
            report_path = Path(args.file).expanduser().resolve(strict=True)
            report_date = parse_report_date(report_path.name, report_date_override)
            import_report(engine, report_path, report_date, processed_dir)
            return

        report_date = parse_report_date(report_date_override or date.today().isoformat(), None)
        report_path = incoming_dir / f"{report_date.isoformat()}.xlsx"
        report_period = os.environ.get("REPORT_PERIOD") or report_date.strftime("%Y%m")
        logger.info("Downloading Coral report for period %s", report_period)
        report_contents = download_file(
            os.environ["CORAL_LOGIN"],
            os.environ["CORAL_PASSWORD"],
            os.environ.get("CORAL_LANG", "gb"),
            os.environ.get("REPORT_TYPE", "CDXPRep"),
            report_period,
        )
        logger.info("Downloaded %d bytes for %s", len(report_contents), report_date)
        temp_path = report_path.with_name(f".{report_path.name}.part")
        temp_path.write_bytes(report_contents)
        temp_path.replace(report_path)
        import_report(engine, report_path, report_date, processed_dir)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()