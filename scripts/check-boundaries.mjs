import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { ownerOf } from "./ownership.mjs";
const shared=/^src\/(contracts\/|components\/ui\/|lib\/(api-client|api-response|mock-data|prisma|llm)\.ts$)/;
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.tsx?$/.test(p))files.push(p.replaceAll("\\","/"));}}
walk("src");
const failures=[];
for(const file of files){
 const ast=ts.createSourceFile(file,fs.readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);
 function check(node){
  let spec;
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)) spec=node.moduleSpecifier.text;
  if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])) spec=node.arguments[0].text;
  if(spec&&(spec.startsWith("@/")||spec.startsWith("."))){
   const raw=spec.startsWith("@/")?"src/"+spec.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(file),spec));
   const target=[raw,raw+".ts",raw+".tsx",raw+"/index.ts",raw+"/index.tsx"].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
   const matchCanReadDemand = (file.startsWith("src/lib/match/") || file.startsWith("src/app/api/match/")) && target === "src/lib/demand.ts";
   if(target&&ownerOf(file)!==ownerOf(target)&&!shared.test(target)&&!matchCanReadDemand) failures.push(file+" -> "+target);
  }
  ts.forEachChild(node,check);
 }
 check(ast);
}
if(failures.length){console.error("跨模块业务导入：\n"+failures.join("\n"));process.exit(1);}
console.log("业务模块导入边界检查通过（静态 import/export 和字符串动态 import）。");
