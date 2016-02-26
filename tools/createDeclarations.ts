declare function require(name:string):any
declare var __dirname:string;
var fs=require("fs")
var ps=require("path")
var content=fs.readFileSync(ps.resolve(__dirname,"../src/index.d.ts")).toString()+"";
var rs=content;
do{
 rs=content;
 content=content.replace("declare","");
}while (rs!=content);
var res="declare module 'raml-typesystem'{\n"+content+"}";
fs.writeFileSync(ps.resolve(__dirname,"../src/indexAmbient.d.ts"),res);