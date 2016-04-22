/// <reference path="../typings/main.d.ts" />
import xml2js=require("xml2js");
import ts=require("./typesystem");
import _=require("underscore");

import {PropertyIs} from "./restrictions";

export function readObject(content:string,t:ts.AbstractType):any{
    var result:any=null;
    var opts:xml2js.Options={};
    opts.explicitChildren=false;
    opts.explicitArray=false;
    opts.explicitRoot= isSchema(t);
    xml2js.parseString(content,opts,function (err,res){
        result=res;
        if (err){
            throw new Error();
        }
    });
    result=postProcess(result,t);
    return result;
}

function isSchema(t: ts.AbstractType): boolean {
    if(isXmlContent(t)) {
        return true;
    }

    return _.find(t.allSuperTypes(), supertype => isXmlContent(supertype)) ? true : false;
}

function isXmlContent(t: ts.AbstractType): boolean {
    if(t.isExternal() && (<any>t)._content && typeof (<any>t)._content === 'string' && (<any>t)._content.trim().indexOf('<') === 0) {
        return true;
    }
    
    return false;
}

function postProcess(result:any,t:ts.AbstractType):any{
    t.meta().forEach(x=>{
        if (x instanceof PropertyIs){
            var pi:PropertyIs=x;
            if (pi.value().isNumber()){
                if (result.hasOwnProperty(pi.propertyName())){
                    var vl=parseFloat(result[pi.propertyName()]);
                    if (!isNaN(vl)){
                        result[pi.propertyName()]=vl;
                    }
                }
            }
            if (pi.value().isBoolean()){
                if (result.hasOwnProperty(pi.propertyName())){
                    var bvl=result[pi.propertyName()];
                    if (bvl=="true"){
                        result[pi.propertyName()]=true;
                    }
                    if (bvl=="false"){
                        result[pi.propertyName()]=false;
                    }
                }
            }
        }
    });
    return result;
}