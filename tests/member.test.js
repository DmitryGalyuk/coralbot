import { test, expect, beforeAll, beforeEach } from '@jest/globals'
import Member from "../src/js/member"
import ReportParses from "../src/js/parser"
import ExcelJS from 'exceljs';
import * as utils from "../src/js/utils"

import fs from "fs";
import exp from 'constants';

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
  let clone = Member.cloneTree(root);
  expect(root.overallstructuretotal == clone.overallstructuretotal).toBeTruthy();

  let directors = Member.query(root, n=>n.isDirector());
  utils.traverse(directors, (d)=>{
    expect(clone.findChild(d.id).overallstructuretotal == d.overallstructuretotal).toBeTruthy();
  });
});

test("cloneTree updates grouptotal total", () => {
  let clone = Member.cloneTree(root);
  expect(root.grouptotal == clone.grouptotal).toBeTruthy();

  let directors = Member.query(root, n=>n.isDirector());
  utils.traverse(directors, (d)=>{
    expect(clone.findChild(d.id).grouptotal == d.grouptotal).toBeTruthy();
  });
});

test("utils.flattenTree preserves same links", () => {
  let flatten = utils.flattenTree(root);
  expect(flatten[0] === root).toBeTruthy();
});