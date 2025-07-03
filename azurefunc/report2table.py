from pandas import *
import io

def report_to_table(report: bytes):
    df_raw: DataFrame = read_excel(io.BytesIO(report), skiprows=6, na_values=[' '])

    excel2Field = {}
    excel2Field["#"] = "rownum"
    excel2Field["Number of Generations"] = "gen"
    excel2Field["Club Member (First name/Last name)"] = "Id"
    excel2Field["Unnamed: 3"] = "Name"
    excel2Field["CNV (Cumulated Network Volume)"] = "cnv"
    excel2Field["Rank"] = "Rank"
    excel2Field["P"] = "Pending"
    excel2Field["PV (Personal Volume)"] = "Personal"
    excel2Field["PVG"] = "GroupVolume"
    excel2Field["MCR (Maximum Confirmed Rank)"] = "maxrank"
    excel2Field["Number of months with zero Volume Points accrued"] = "zeroMonths"
    excel2Field["Club Member Status"] = "status"

    df_renamed = df_raw.rename(columns=excel2Field)

    df_neededColumns = df_renamed.drop(columns=["cnv", "status", "maxrank", "zeroMonths"], errors="ignore")

    df_noNA = df_neededColumns.dropna(subset=['Id'])

    df_recast = df_noNA.convert_dtypes(convert_floating=True, convert_integer=True)
    df_recast["Personal"].astype(float)
    df_recast["Pending"].astype(float)
    df_recast["Id"].astype(int)

    df_gen = df_recast
    df_gen.gen = df_gen.gen.apply(lambda x: int(str(x).split(".")[-1]) )

    levelId = {}
    def id_gen_2_parent(id, gen) -> int:
        levelId[gen] = id
        return levelId[gen-1] if gen > 0 else -1

    df_gen.insert(loc=3, column="ParentId", value=df_gen.apply(lambda x: id_gen_2_parent(x.Id, x.gen), axis=1))
    df_gen.ParentId = df_gen.ParentId.astype(int)


    members = {}
    parents = {}

    def calculate_structure_totals(id):
        member = members[id]
        member["Overall"] += member["Personal"] or 0
        member["StructurePending"] += member["Pending"] or 0
        if id in parents:
            children = [c for c in members.values() if c["ParentId"] == member["Id"]]
            for c in children:
                calculate_structure_totals(c["Id"])
                members[c["ParentId"]]["Overall"] += c["Overall"] or 0
                members[c["ParentId"]]["StructurePending"] += c["StructurePending"] or 0


    df_gen["Overall"] = 0
    df_gen["StructurePending"] = 0
    d = df_gen.to_dict(orient="index")
    members = {r["Id"] : r for r in d.values()}
    parents = {r["ParentId"] : r["Id"] for r in d.values()}
    calculate_structure_totals(parents[-1])
    memberOverall = {x["Id"]: x["Overall"] for x in members.values()}
    memberStructurePending = {x["Id"]: x["StructurePending"] for x in members.values()}
    df_gen["Overall"] = df_gen["Id"].map(memberOverall)
    df_gen["StructurePending"] = df_gen["Id"].map(memberStructurePending)

    return df_gen

def test():
    from pathlib import Path
    test_file_path = Path(__file__).parent.parent / "data" / "2025-07-03.xlsx"
    report = open(test_file_path.resolve(), "rb").read()
    df = report_to_table(report)
    options.display.float_format = "{:,.2f}".format
    print(df)
    df.to_csv("result.csv", index=False, encoding="utf-8-sig")


if __name__ == "__main__":
    test()