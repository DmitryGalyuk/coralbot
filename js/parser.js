import Member from './member.js';

export default class ReportParses {
    constructor(file, language) {
        this._rawData = [];
        this.summary = "";
        this._memberList = undefined;
        this.language = language;

        this.column2field = 
        {
            "ru": {
                '': 'name',
                '№': 'rownum',
                'Уровень': 'level',
                'Член клуба': 'id',
                'Ранг/нД': 'rawtitle',
                'P': 'unpayedOrders',
                'ЛО': 'personalvolume',
                'ЛГО': 'lgo',
                'НСО': 'nso',
                'Max. 3Р': 'maxzr',
                '#': 'monthNoVolume',
                'S': 'status'
            }
        };
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
            headers[colNumber] = this.column2field[this.language][cell.value ?? ""];
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