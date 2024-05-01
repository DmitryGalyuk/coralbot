import { test, expect, beforeAll, beforeEach } from '@jest/globals'
import Member from "../web/js/member"
import ReportParses from "../web/js/parser"
import ExcelJS from 'exceljs';
import * as utils from "../web/js/utils"
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
    expect(root instanceof Member).toBeTruthy();
});

test("cloneTree creates new objects", () => {
  let clone = Member.cloneTree(root);
  utils.traverse(clone, (c)=> {
    let original = root.findChild(c.id);
    expect(original.id == c.id).toBeTruthy();
    expect(original !== c).toBeTruthy();
  });  
});

test("cloneTree updates overallstructure total", () => {
  utils.traverse(Member.cloneTree(root), (c)=>{
    expect(c.overallstructure == root.findChild(c.id).overallstructure).toBeTruthy();
  });
});

test("cloneTree updates grouptotal total", () => {
  utils.traverse(Member.cloneTree(root), (c)=>{
    expect(c.grouptotal == root.findChild(c.id).grouptotal).toBeTruthy();
  });
});

test("Member.flattenTree preserves same links", () => {
  for (let n of Member.flattenTree(root)) {
    expect(n === root.findChild(n.id)).toBeTruthy();
  }
});