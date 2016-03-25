import ts=require("./typesystem")
import nt=require("./nominal-types")
import parse=require("./parse")
import {ComponentShouldBeOfType} from "./restrictions";
import {FacetDeclaration} from "./metainfo";
import {Description} from "./metainfo";
import {DisplayName} from "./metainfo";

const NOMINAL="nominal"

export  interface StringToBuiltIn{

    (name:string):nt.ITypeDefinition
}
export interface PropertyConstructor{
    (name:string):nt.Property;
}

var pc:PropertyConstructor;

export function setPropertyConstructor(p:PropertyConstructor){
    pc=p;
}

export interface TypeCustomizer{

    constructProperty(n:string):nt.Property;
    findCustomizer(t:ts.AbstractType):TypeCustomizer;
}

export function toNominal(t:ts.AbstractType,callback:StringToBuiltIn,customizer:TypeCustomizer=null): nt.ITypeDefinition{
    var vs:nt.AbstractType=null;
    if (t.getExtra(NOMINAL)){
        return t.getExtra(NOMINAL);
    }
    //if (t.isEmpty()){
    //    if (t.superTypes().length==1){
    //        return toNominal(t.superTypes()[0],callback);
    //    }
    //}
    if (!t){
        var res= callback("any");
        if (!res){
            vs= new nt.StructuredType(t.name());
        }
    }

    if (t.isBuiltin()){
        var s= callback(t.name());
        if (!s){
            if (t.isScalar()){
                vs=new nt.ValueType(t.name(),null);
            }
            else{
                vs= new nt.StructuredType(t.name());
            }

        }
        else {
            vs = <nt.AbstractType>s;
        }
    }
    else {
        if (t.isObject()) {
            vs = new nt.StructuredType(t.name(), null);
        }
        else if (t.isArray()) {
            var ar = new nt.Array(t.name(), null);
            vs = ar;
            t.putExtra(NOMINAL, vs);
            var cm = t.oneMeta(ComponentShouldBeOfType);
            var r = cm ? cm.value() : ts.ANY;
            ar.setComponent(toNominal(r, callback));
        }
        else if (t.isUnion()) {
            var ut = new nt.Union(t.name(), null);
            t.typeFamily().forEach(x=>{
                if (ut.left==null){
                    ut.left=toNominal(x,callback);
                }
                else if (ut.right==null){
                    ut.right=toNominal(x,callback);
                }
                else{
                    var nu=new nt.Union(t.name(),null);
                    nu.left=ut.right;
                    nu.right=toNominal(x,callback);
                    ut.right=nu;
                }
            })
            vs=ut;
        }
        else if (t.isScalar()) {
            vs = new nt.ValueType(t.name(), null);

        }
    }
    if (!vs){
        vs=new nt.StructuredType(t.name());
    }
    t.putExtra(NOMINAL, vs);
    t.superTypes().forEach(x=>{
        var mn=<nt.AbstractType>toNominal(x,callback);
        if (x.isBuiltin()){
            vs._superTypes.push(mn);
        }
        else {
            vs.addSuperType(mn);
        }
    })

    var proto=parse.toProto(t);
    proto.properties.forEach(x=>{
        var prop=pc?pc(x.id):new nt.Property(x.id);
        prop.withDomain(<nt.StructuredType>vs);
        prop.withRange(toNominal(x.type,callback));
        if (!x.optional){
            prop.withRequired(true);
        }
    });
    proto.facetDeclarations.forEach(x=>{
        var prop=pc?pc(x.facetName()):new nt.Property(x.facetName());
        prop.withRange(toNominal(x.type(),callback));
        vs.addFacet(prop);

    })
    vs.addAdapter(t);
    if (t.isEmpty()){
        vs.addAdapter(new nt.Empty());
    }
    return vs;
}

