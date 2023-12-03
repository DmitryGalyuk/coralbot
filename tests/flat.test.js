import { test, expect, beforeAll, beforeEach } from '@jest/globals'
import Member from "../src/js/member"
import ReportParses from "../src/js/parser"
import ExcelJS from 'exceljs';

import fs from "fs";

let root = [];

beforeEach(async () => {
  new ExcelJS.Workbook();
  let file;
  file = fs.readFileSync("sample-en.xlsx")
  let parser = new ReportParses(file, "en")
  root = await parser.parseExcel();
});


test("parser returns Member instance", () => {
    expect(root instanceof Member).toBe(true);
})

