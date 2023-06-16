import Member from './member.js';

export default class ReportParses {
    constructor(file) {
        this._rawData = [];
        this.summary = "";
        this._memberList = undefined;
        this._root = undefined;

        this.columnHeaders = [
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
        this._file = file;

    }

    rawData() {
        return this._rawData;
    }

    memberFlatList() {
        if (this._memberList) return this._memberList;
        this._memberList = [];
        let that = this;
        
        function traverse(node) {
            that._memberList.push(node);
            
            if (node.children) {
                for (let child of node.children) {
                    traverse(child);
                }
            }
        }
        
        traverse(this.memberTree());
        return this._memberList;
    }

    memberTree() {
        if (this._root) return root;

        let flat = this._rawexcelToMembers(this._rawData);
        this._root = this._populate_children(flat);
        return this._root;
    }

    async parseExcel() {

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await this._file.arrayBuffer());

        const worksheet = workbook.worksheets[0];

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
                this.summary += row.values[1] + '\n';
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
                    rowData[this.columnHeaders[colIndex]] = col && col.toString().trim();
                });
                this._rawData.push(rowData);
            }
        });

    }

    _rawexcelToMembers(df) {
        let parent_child = {};
        let flat_list = [];

        for (let row of df) {
            let m = new Member(row); // Assuming Member is a predefined class
            if (!m.id) continue;
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

    _populate_children(members) {
        let id_member = {};
        for (let m of members) {
            id_member[m.id] = m;
        }

        for (let m of members) {
            if (m.parent) {
                id_member[m.parent].children.push(m);
            }
        }
        return members[0];
    }
}