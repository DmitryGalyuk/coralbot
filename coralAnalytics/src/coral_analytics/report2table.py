import io

from pandas import DataFrame, isna, read_excel


def report_to_table(report: bytes) -> DataFrame:
    df_raw = read_excel(io.BytesIO(report), skiprows=6, na_values=[" "])

    excel_to_field = {
        "#": "rownum",
        "Number of Generations": "gen",
        "Club Member (First name/Last name)": "Id",
        "Unnamed: 3": "Name",
        "CNV (Cumulated Network Volume)": "cnv",
        "Rank": "Rank",
        "P": "Pending",
        "PV (Personal Volume)": "Personal",
        "PVG": "GroupVolume",
        "MCR (Maximum Confirmed Rank)": "maxrank",
        "Number of months with zero Volume Points accrued": "zeroMonths",
        "Club Member Status": "status",
    }

    df_renamed = df_raw.rename(columns=excel_to_field)
    df_needed_columns = df_renamed.drop(
        columns=["cnv", "status", "maxrank", "zeroMonths"], errors="ignore"
    )
    df_no_na = df_needed_columns.dropna(subset=["Id"])
    df_recast = df_no_na.convert_dtypes(convert_floating=True, convert_integer=True)
    df_recast["Personal"] = df_recast["Personal"].astype(float)
    df_recast["Pending"] = df_recast["Pending"].astype(float)
    df_recast["Id"] = df_recast["Id"].astype(int)
    df_recast["gen"] = df_recast["gen"].apply(lambda value: int(str(value).split(".")[-1]))

    level_ids = {}

    def parent_id_for(member_id, generation):
        level_ids[generation] = member_id
        return level_ids[generation - 1] if generation > 0 else -1

    df_recast.insert(
        loc=3,
        column="ParentId",
        value=df_recast.apply(lambda row: parent_id_for(row.Id, row.gen), axis=1),
    )
    df_recast["ParentId"] = df_recast["ParentId"].astype(int)
    df_recast["Overall"] = 0.0
    df_recast["StructurePending"] = 0.0

    members = {row["Id"]: row for row in df_recast.to_dict(orient="records")}
    children_by_parent = {}
    for member in members.values():
        children_by_parent.setdefault(member["ParentId"], []).append(member["Id"])

    def calculate_totals(member_id):
        member = members[member_id]
        personal = member["Personal"]
        pending = member["Pending"]
        member["Overall"] += 0 if isna(personal) else personal
        member["StructurePending"] += 0 if isna(pending) else pending
        for child_id in children_by_parent.get(member_id, []):
            child = calculate_totals(child_id)
            member["Overall"] += child["Overall"]
            member["StructurePending"] += child["StructurePending"]
        return member

    roots = children_by_parent.get(-1, [])
    for root_id in roots:
        calculate_totals(root_id)

    overall_by_id = {member_id: member["Overall"] for member_id, member in members.items()}
    pending_by_id = {
        member_id: member["StructurePending"] for member_id, member in members.items()
    }
    df_recast["Overall"] = df_recast["Id"].map(overall_by_id)
    df_recast["StructurePending"] = df_recast["Id"].map(pending_by_id)
    return df_recast