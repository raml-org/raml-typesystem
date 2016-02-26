/// <reference path="../typings/main.d.ts" />
import ts=require("./typesystem")
import ps=require("./parse")
import {TypeCollection} from "./parse";
import js=require("./jsonSchemaWriter")
export function renderType(t:ts.AbstractType,tc:ps.TypeCollection){
    var mm=t.validateType(tc.getAnnotationTypeRegistry());
    var res="<h4>"+ t.name()+"</h4>";

    if (mm.isOk()){
        res=res+"<div style='color: green'>Type validation passed</div>"
    }
    else{
        res=res+"<div style='color: red'>Type validation failed: "+mm.getMessage()+" (top message)</div>"
    }
    var wr=new js.SchemaWriter();
    try {
        res += "<code><pre>" + JSON.stringify(wr.store(t), [], 2) + "</pre></code>"
    }catch (e){

    }
    res+="<hr/>";
    return res;
}
export function renderCollection(tc:TypeCollection){
    return tc.types().map(x=>renderType(x,tc)).join("");
}