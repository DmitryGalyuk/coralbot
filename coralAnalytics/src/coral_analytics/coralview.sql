CREATE OR REPLACE VIEW public.coralview AS
WITH RECURSIVE structure AS (
    SELECT
        s.date_added,
        s.id,
        s.parent_id,
        ARRAY[s.id] AS id_path
    FROM public.dailystats AS s
    WHERE s.parent_id IS NULL OR s.parent_id = -1

    UNION ALL

    SELECT
        child.date_added,
        child.id,
        child.parent_id,
        parent.id_path || child.id
    FROM public.dailystats AS child
    JOIN structure AS parent
      ON parent.date_added = child.date_added
     AND parent.id = child.parent_id
    WHERE NOT child.id = ANY(parent.id_path)
)
SELECT
    t.name AS "TitleName",
    t.rank AS "TitleRank",
    CASE
        WHEN t.rank >= (SELECT rank FROM public.titles WHERE name = 'Director') THEN 1
        ELSE 0
    END AS "IsDirector",
    CASE
        WHEN s.date_added = (SELECT max(date_added) FROM public.dailystats) THEN 1
        ELSE 0
    END AS "IsLatestDate",
    EXTRACT(YEAR FROM s.date_added)::integer AS "Year",
    EXTRACT(MONTH FROM s.date_added)::integer AS "Month",
    EXTRACT(DAY FROM s.date_added)::integer AS "Day",
    array_to_string(structure.id_path, '/') AS "Path",
    s.gen,
    s.id AS "Id",
    s.parent_id AS "ParentId",
    s.name AS "Name",
    s.pending AS "Pending",
    s.personal AS "Personal",
    s.overall AS "Overall",
    s.structure_pending AS "StructurePending",
    s.group_volume AS "GroupVolume",
    s.file_name AS "File_Name",
    s.date_added AS "DateAdded",
    s.rownum
FROM public.dailystats AS s
LEFT JOIN public.titles AS t
  ON t.code = btrim(s.rank, '1on')
LEFT JOIN structure
  ON structure.date_added = s.date_added
 AND structure.id = s.id;