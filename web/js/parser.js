import Member from './member.js';
import { getTranslator } from "./translator.js";

let ExcelJS;
if (typeof window !== 'undefined' && window.ExcelJS) {
    ExcelJS = window.ExcelJS; // Use the global ExcelJS in the browser
} else {
    // Dynamic import for Node.js environment
    import('exceljs').then((module) => {
        ExcelJS = module.default;
    });
}

const T = await getTranslator();

export default class ReportParses {
    constructor(file, language) {
        this._rawData = [];
        this.summary = "";
        this._memberList = undefined;
        this.language = language;

        this.column2field = {};
        this.column2field[T.name] = "name";
        this.column2field[T.rownum] = "rownum";
        this.column2field[T.level] = "level";
        this.column2field[T.id] = "id";
        this.column2field[T.rawtitle] = "rawtitle";
        this.column2field[T.unpayedOrders] = "unpayedOrders";
        this.column2field[T.personalvolume] = "personalvolume";
        this.column2field[T.lgo] = "lgo";
        this.column2field[T.nso] = "nso";
        this.column2field[T.maxzr] = "maxzr";
        this.column2field[T.monthNoVolume] = "monthNoVolume";
        this.column2field[T.status] = "status";
        this._file = file;

    }


    async parseExcel() {

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(this._file);

        const worksheet = workbook.worksheets[0];
        let row = worksheet.getRow(1);
        let rownum = 1;

        // Skip the summary   
        while (row.getCell(1).value) {
            rownum++;
            row = worksheet.getRow(rownum);
        }

        // skip the empty lines and first pseudo header row
        while (!row.getCell(1).value) {
            rownum++;
            row = worksheet.getRow(rownum);
        }

        // Unmerge cells in the header row
        const headerRowIndex = rownum;
        worksheet.unMergeCells(`A${headerRowIndex}:Z${headerRowIndex}`);

        // Process the next row as a header row
       const headers = {};
        row = worksheet.getRow(rownum);
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            headers[colNumber] = this.column2field[cell.value ?? ""];
        });

        // Process the remaining rows as data
        rownum++;
        let dataRow = worksheet.getRow(rownum);
        while (dataRow.hasValues) {
            const memberData = {};
            dataRow.eachCell((cell, colNumber) => {
                const header = headers[colNumber];
                if (header !== null) {
                    memberData[header] = cell.value;
                }
            });
            this._rawData.push(memberData);

            rownum++;
            dataRow = worksheet.getRow(rownum);
        }


        return Member.fromRawData(this._rawData, this.language);

    }



}