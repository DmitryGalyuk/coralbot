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

    df_neededColumns = df_renamed.drop(columns=["rownum", "cnv", "status", "maxrank", "zeroMonths"], errors="ignore")

    df_noNA = df_neededColumns.dropna(subset=['Id'])

    df_recast = df_noNA.convert_dtypes(convert_floating=True, convert_integer=True)
    df_recast["Personal"].astype(float)
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

    def calculate_overallstructure_total(id):
        member = members[id]
        member["Overall"] += member["Personal"] or 0
        if id in parents:
            children = [c for c in members.values() if c["ParentId"] == member["Id"]]
            for c in children:
                member["Overall"] += calculate_overallstructure_total(c["Id"])
        return member["Overall"]

    df_gen["Overall"] = 0
    d = df_gen.to_dict(orient="index")
    members = {r["Id"] : r for r in d.values()}
    parents = {r["ParentId"] : r["Id"] for r in d.values()}
    calculate_overallstructure_total(parents[-1])
    memberOverall = {x["Id"]: x["Overall"] for x in members.values()}
    df_gen["Overall"] = df_gen["Id"].map(memberOverall)

    return df_gen