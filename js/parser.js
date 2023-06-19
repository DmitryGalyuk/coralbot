import Member from './member.js';

export default class ReportParses {
    constructor(file) {
        this._rawData = [];
        this.summary = "";
        this._memberList = undefined;

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

        return Member.fromRawData(this._rawData);

    }



}