/// <reference path="../typings/main.d.ts" />
import ts=require("./typesystem")
import nt=require("./nominal-types")
import {ComponentShouldBeOfType} from "./restrictions";
import {FacetDeclaration} from "./metainfo";

const NOMINAL="nominal"
export function toNominal(t:ts.AbstractType,registry:{ [name:string]:nt.AbstractType}={}): nt.AbstractType{
    var vs:nt.AbstractType=null;
    if (!t){
        return toNominal(ts.ANY);
    }
    if (t.getExtra(NOMINAL)){
        return t.getExtra(NOMINAL);
    }
    if (t.isBuiltin()&&registry[t.name()]){
        return registry[t.name()];
    }
    if (t.isObject()){
        vs=new nt.StructuredType(t.name(), null);
        t.putExtra(NOMINAL,vs);
    }
    else if (t.isArray()){
        var ar=new nt.Array(t.name(),null);
        vs=ar;
        t.putExtra(NOMINAL,vs);
        var cm=t.oneMeta(ComponentShouldBeOfType);
        var r=cm?cm.value():ts.ANY;
        ar.setComponent(toNominal(r,registry));
    }
    else if (t.isUnion()){
        vs=new nt.Union(t.name(),null);
        t.putExtra(NOMINAL,vs);
    }
    else if (t.isScalar()){
        vs=new nt.ValueType(t.name(),null);
        t.putExtra(NOMINAL,vs);

    }
    t.superTypes().forEach(x=>{
        vs.addSuperType(toNominal(x,registry));
    })
    t.declaredMeta().forEach(x=>{
        if (x instanceof FacetDeclaration){
            var fd=x;
        }
    });
    return vs;
}

export function typeFromNode(t:ts.AbstractType,registry:{ [name:string]:nt.AbstractType}={}):nt.AbstractType{
    if (!t){
        return toNominal(ts.ANY);
    }
    if (t.getExtra(NOMINAL)){
        return t.getExtra(NOMINAL);
    }
    if (t.isBuiltin()&&registry[t.name()]){
        return registry[t.name()];
    }
    var result=new nt.StructuredType(t.name(),null,"");
    t.declaredMeta().forEach(x=>{
        if (x instanceof FacetDeclaration){
            //we should create property;
        }
    });
    t.superTypes().forEach(x=>{
        result.addSuperType(typeFromNode(x,registry));
    })


    return result;
}
