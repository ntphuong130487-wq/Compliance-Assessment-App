import fs from "node:fs";
import path from "node:path";
import { extractDocumentText } from "../lib/document-intelligence.js";

function assert(ok,msg){if(!ok)throw new Error(msg)}
delete process.env.OCR_ENDPOINT;
delete process.env.OCR_API_KEY;

const root=path.resolve("tests/fixtures/ocr");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));

for(const fixture of manifest.fixtures){
  const filePath=path.join(root,fixture.file);
  assert(fs.existsSync(filePath),"Missing fixture "+fixture.file);
  const buffer=fs.readFileSync(filePath);
  const ext=path.extname(fixture.file).toLowerCase();
  const mime=ext===".pdf"?"application/pdf":ext===".docx"?"application/vnd.openxmlformats-officedocument.wordprocessingml.document":ext===".png"?"image/png":"application/octet-stream";
  const out=await extractDocumentText(buffer,{name:fixture.file,type:mime,minTextLength:20});
  if(fixture.ocrRequired){
    assert(out.ocrRequired===true,fixture.file+" should route to OCR");
    assert(out.ocrUsed===false,fixture.file+" must not claim OCR without provider");
  }else{
    assert(out.ocrRequired===false,fixture.file+" unexpectedly requires OCR");
    assert(out.text.length>=20,fixture.file+" text extraction too short");
    assert(out.text.toLowerCase().includes("don vi phai"),fixture.file+" expected text not found");
  }
}
console.log("PASS - real PDF/DOCX/scan OCR routing fixtures");
