import Member from './member.js';

export default async function parseReport(file) {

    let [summary, data] = await parseExcel(file);

    let memberlist = await _rawexcelToMembers(data);
    _populate_children(memberlist);
    // Assuming calculate_group_total() is a function in each member
    for (let m of memberlist) {
        m.calculate_group_total();
    }

    return [summary, memberlist];
}

const columnHeaders = [
    "rownum",
    "level",
    "id",
    "name",
    "title",
    "personalvolume",
    "nso",
    "maxzr",
    "monthNoVolume",
    "status",
]

async function parseExcel(file) {
    if (file) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());

        const worksheet = workbook.worksheets[0];
        const data = [];
        let summary = "";

        worksheet.unMergeCells('A7:Z7');

        let isInHeader = true;
        let isInBlankRow = false;
        let isInData = false;

        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
            if (isInHeader) {
                worksheet.unMergeCells('A' + rowNumber + ':Z' + rowNumber);
                if (!worksheet.getCell('A' + rowNumber).value) {
                    isInHeader = false;
                    isInBlankRow = true;
                    return;
                }
                summary += row.values[1] + '\n';
            } else if (isInBlankRow) {
                // Switch to data mode when we find a non-empty row after blank rows
                if (worksheet.getCell('A' + rowNumber).value) {
                    isInBlankRow = false;
                    isInData = true;
                }
            } else if (isInData) {
                // table parsed, prevent reading the footer
                if (!worksheet.getCell('A' + rowNumber).value) {
                    isInData = false;
                    return;
                }
                const rowData = {};
                row.values.slice(1, row.values.length).forEach((col, colIndex) => {
                    rowData[columnHeaders[colIndex]] = col && col.toString().trim();
                });
                data.push(rowData);
            }
        });



        return [summary, data];
    }
}

function _rawexcelToMembers(df) {
    let parent_child = {};
    let flat_list = [];

    for (let row of df) {
        let m = new Member(row); // Assuming Member is a predefined class
        let member_id = m.id;
        let level = parseInt(m.level.split('.')[1]); // Get the number after the dot in 'level'

        if (level !== 0) {
            let parent_id = parent_child[level - 1].id;
            m.parent = parent_id;
        }

        parent_child[level] = m;
        flat_list.push(m);
    }

    return flat_list;
}

function _populate_children(members) {
    let id_member = {};
    for (let m of members) {
        id_member[m.id] = m;
    }

    for (let m of members) {
        if (m.parent) {
            id_member[m.parent].children.push(m);
        }
    }
}