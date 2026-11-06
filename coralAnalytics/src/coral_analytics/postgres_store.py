import os
from datetime import date
from pathlib import Path

import pandas as pd
from sqlalchemy import Date, Float, Integer, String, create_engine, inspect
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from coral_analytics.report2table import report_to_table


class Base(DeclarativeBase):
    pass


class DailyStat(Base):
    __tablename__ = "dailystats"

    gen: Mapped[int] = mapped_column(Integer, nullable=False)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str | None] = mapped_column(String(255))
    parent_id: Mapped[int | None] = mapped_column(Integer)
    rank: Mapped[str | None] = mapped_column(String(10))
    pending: Mapped[float | None] = mapped_column(Float)
    personal: Mapped[float | None] = mapped_column(Float)
    overall: Mapped[float | None] = mapped_column(Float)
    group_volume: Mapped[float | None] = mapped_column(Float)
    file_name: Mapped[str | None] = mapped_column(String(255))
    date_added: Mapped[date] = mapped_column(Date, primary_key=True)
    rownum: Mapped[int | None] = mapped_column(Integer)
    structure_pending: Mapped[float | None] = mapped_column(Float)


class Title(Base):
    __tablename__ = "titles"

    rank: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str | None] = mapped_column(String(10), unique=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)


DATAFRAME_TO_MODEL = {
    "gen": "gen",
    "Id": "id",
    "Name": "name",
    "ParentId": "parent_id",
    "Rank": "rank",
    "Pending": "pending",
    "Personal": "personal",
    "Overall": "overall",
    "GroupVolume": "group_volume",
    "File_Name": "file_name",
    "DateAdded": "date_added",
    "rownum": "rownum",
    "StructurePending": "structure_pending",
}

REPORT_COLUMNS = tuple(
    column for column in DATAFRAME_TO_MODEL if column not in {"File_Name", "DateAdded"}
)
UPSERT_COLUMNS = tuple(
    column.name
    for column in DailyStat.__table__.columns
    if column.name not in {"id", "date_added"}
)
TITLE_ROWS = [
    {"rank": 10, "code": "M", "name": "Consumer"},
    {"rank": 20, "code": "PM", "name": "PremiumConsumer"},
    {"rank": 30, "code": "jA", "name": "JuniorAssistant"},
    {"rank": 40, "code": "A", "name": "Assistant"},
    {"rank": 50, "code": "D", "name": "Director"},
    {"rank": 60, "code": "SD", "name": "SilverDirector"},
    {"rank": 70, "code": "GD", "name": "GoldenDirector"},
    {"rank": 80, "code": "ED", "name": "EmeraldDirector"},
    {"rank": 90, "code": "DD", "name": "DiamondDirector"},
    {"rank": 100, "code": "E", "name": "Master"},
    {"rank": 110, "code": "SE", "name": "SilverMaster"},
    {"rank": 120, "code": None, "name": "DoubleSilverMaster"},
    {"rank": 130, "code": None, "name": "GoldenMaster"},
    {"rank": 140, "code": None, "name": "PlatinumMaster"},
]


def create_local_engine():
    url = URL.create(
        "postgresql+psycopg",
        username=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        host=os.environ.get("POSTGRES_HOST", "localhost"),
        port=int(os.environ.get("POSTGRES_PORT", "5432")),
        database=os.environ["POSTGRES_DB"],
    )
    return create_engine(url, pool_pre_ping=True)


def create_schema(engine) -> None:
    Base.metadata.create_all(engine)
    inspector = inspect(engine)
    primary_key = inspector.get_pk_constraint("titles", schema="public")
    unique_constraints = inspector.get_unique_constraints("titles", schema="public")
    unique_indexes = inspector.get_indexes("titles", schema="public")
    rank_is_unique = "rank" in (primary_key.get("constrained_columns") or []) or any(
        constraint.get("column_names") == ["rank"] for constraint in unique_constraints
    ) or any(
        index.get("unique") and index.get("column_names") == ["rank"]
        for index in unique_indexes
    )
    if not rank_is_unique:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                "CREATE UNIQUE INDEX IF NOT EXISTS titles_rank_uq "
                "ON public.titles (rank)"
            )

    statement = insert(Title).values(TITLE_ROWS)
    statement = statement.on_conflict_do_update(
        index_elements=[Title.rank],
        set_={"code": statement.excluded.code, "name": statement.excluded.name},
    )
    view_sql = Path(__file__).with_name("coralview.sql").read_text(encoding="utf-8")
    with engine.begin() as connection:
        connection.execute(statement)
        connection.exec_driver_sql(view_sql)


def reset_schema(engine) -> None:
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP VIEW IF EXISTS public.coralview CASCADE")
    Base.metadata.drop_all(engine)
    create_schema(engine)


def dataframe_to_records(
    dataframe: pd.DataFrame, file_name: str, report_date: date
) -> list[dict]:
    missing_columns = set(REPORT_COLUMNS).difference(dataframe.columns)
    if missing_columns:
        raise ValueError(f"Report DataFrame is missing columns: {sorted(missing_columns)}")

    records = dataframe.loc[:, REPORT_COLUMNS].rename(columns=DATAFRAME_TO_MODEL).copy()
    records["file_name"] = file_name
    records["date_added"] = report_date
    records = records.astype(object).where(pd.notna(records), None)
    return records.to_dict(orient="records")


def upsert_report(engine, dataframe: pd.DataFrame, file_name: str, report_date: date) -> int:
    records = dataframe_to_records(dataframe, file_name, report_date)
    if not records:
        return 0

    statement = insert(DailyStat).values(records)
    statement = statement.on_conflict_do_update(
        index_elements=[DailyStat.date_added, DailyStat.id],
        set_={column: getattr(statement.excluded, column) for column in UPSERT_COLUMNS},
    )
    with engine.begin() as connection:
        connection.execute(statement)
    return len(records)


def process_report_bytes(engine, report_contents: bytes, file_name: str, report_date: date) -> int:
    dataframe = report_to_table(report_contents)
    return upsert_report(engine, dataframe, file_name, report_date)