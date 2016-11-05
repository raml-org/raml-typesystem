import rt=require("./typesystem")
import meta=require("./metainfo")
import {ComponentShouldBeOfType} from "./restrictions";
import {PropertyIs} from "./restrictions";
import nm=require("./nominal-types")
const exCalcFlag="exampleCalculation";
export function example(t:rt.AbstractType):any{
    var ms=t.oneMeta(meta.Example);
    if (ms){
        return ms.example();
    }
    if (t.getExtra(exCalcFlag)){
        return null;
    }
    t.putExtra(exCalcFlag,true)
    try {
        var ms1 = t.oneMeta(meta.Examples);
        if (ms1) {
            var examples = ms1.examples();
            if (examples && examples.length > 0) {
                return examples[0];
            }
        }
        var d = t.oneMeta(meta.Default);
        if (d) {
            return d.value();
        }
        if (t.isObject()) {
            var result:any = {};
            t.meta().forEach(x=> {
                if (x instanceof PropertyIs) {
                    var p:PropertyIs = x;
                    var ex = example(p.value());
                    result[p.propertyName()] = ex;
                }
            })
            t.superTypes().forEach(x=> {
                if (x.oneMeta(meta.Example) || x.oneMeta(meta.Examples)) {
                    var ex = example(x);
                    if (ex && typeof ex === "object") {
                        Object.keys(ex).forEach(key=> {
                            result[key] = ex[key]
                        })
                    }
                }
            })
            return result;
        }
        if (t.isArray()) {
            var c = t.oneMeta(ComponentShouldBeOfType);
            var resultArray:any[] = [];
            if (c) {
                resultArray.push(example(c.value()));
            }
            return resultArray;
        }
        if (t.isUnion()) {
            return example(t.typeFamily()[0]);
        }
        if (t.isNumber()) {
            return 1;
        }

        if (t.isBoolean()) {
            return true;
        }
        return "some value";
    } finally{
        t.putExtra(exCalcFlag,false)
    }
}
class Example implements nm.IExpandableExample{
    _owner: any;

    constructor(
        private _value:any,
        private _name:string = undefined,
        private _displayName:string=undefined,
        private _description:string=undefined,
        private _strict:boolean=true,
        private _annotations:{[key:string]:meta.Annotation}={},
        private _isSingle:boolean=false,
        private _empty:boolean=false){

    }

    private _scalarsAnnotations:
        {[pName:string]:{[aName:string]:meta.Annotation}} = {};

    isEmpty():boolean {
        return this._empty;
    }

    isJSONString():boolean {
        return typeof this._value==="string"&&((this._value+"").trim().indexOf("{")==0||(this._value+"").trim().indexOf("[")==0);
    }

    isXMLString():boolean {
        return typeof this._value==="string"&&(this._value+"").trim().indexOf("<")==0;
    }
    
    asXMLString(): string {
        if(this.isXMLString()) {
            return this._value;
        }
        
        if(this._owner) {
            return (<any>this)._owner.asXMLString();
        }

        return null;
    }

    isYAML():boolean {
        if (typeof this._value==="string") {
            return !(this.isJSONString() || this.isXMLString());
        }
        return true;
    }

    asString():string {
        if (typeof this._value==="string"){
            return ""+this._value;
        }
        return this.expandAsString();
    }

    asJSON():any {
        if (this.isJSONString()){
            try {
                return JSON.parse(this._value);
            } catch (e){
                return null;
            }
        }
        if (this.isYAML()){
            return this._value;
        }
        return this.expandAsString();
    }

    original():any {
        return this._value;
    }

    expandAsString():string {
        return JSON.stringify(this.expandAsJSON(), null, 2);
    }

    expandAsJSON():any {
        return this._value;
    }

    isSingle():boolean{
        return this._isSingle;
    }

    strict():boolean{
        return this._strict;
    }

    description():string{
        return this._description;
    }

    displayName():string{
        return this._displayName;
    }

    annotations():{[key:string]:meta.Annotation}{
        return this._annotations;
    }

    name():string{
        return this._name;
    }

    scalarsAnnotations():{[pName:string]:{[aName:string]:meta.Annotation}}{
        return this._scalarsAnnotations;
    }

    registerScalarAnnotatoion(a:meta.Annotation,pName:string){
        var aMap = this._scalarsAnnotations[pName];
        if(!aMap){
            aMap = {};
            this._scalarsAnnotations[pName] = aMap;
        }
        aMap[a.facetName()] = a;
    }

}
var toExample = function (owner: any, exampleObj:any, name:string=null,isSingle:boolean=false) {
    var example:Example;
    if (exampleObj!=null) {
        var val = exampleObj.value;
        if (!val) {
            val = exampleObj
            example = new Example(val, name, undefined, undefined, true, undefined, isSingle);
        }
        else {
            var displayName = scalarValue(exampleObj, "displayName");
            var description = scalarValue(exampleObj, "description");
            var strict:boolean = scalarValue(exampleObj, "strict");
            var aObj:{[key:string]:meta.Annotation} = {};
            scalarAnnotaitons(exampleObj).forEach(x=>{
                aObj[x.facetName()] = x;
            });
            example = new Example(val, name, displayName, description, strict, aObj, isSingle);
            for(var a of scalarAnnotaitons(exampleObj["displayName"])){
                example.registerScalarAnnotatoion(a,"displayName");
            }
            for(var a of scalarAnnotaitons(exampleObj["description"])){
                example.registerScalarAnnotatoion(a,"description");
            }
            for(var a of scalarAnnotaitons(exampleObj["strict"])){
                example.registerScalarAnnotatoion(a,"strict");
            }
        }
    }
    
    if(example) {
        example._owner = owner;
    }
    
    return example;
};

function scalarValue(obj:any,propName:string):any{
    var pVal = obj[propName];
    if(pVal !=null && typeof(pVal)=="object"){
        return pVal["value"];
    }
    return pVal;
}
function scalarAnnotaitons(obj:any):meta.Annotation[]{
    var result:meta.Annotation[] = [];
    if(!obj || typeof(obj)!="object"){
        return result;
    }
    for(var aKey of Object.keys(obj).filter(
        x=>x.length>0&&x.charAt(0)=="("&&x.charAt(x.length-1)==")")){
        var aName = aKey.substring(1,aKey.length-1);
        var aVal = obj[aKey];
        var a = new meta.Annotation(aName,aVal);
        result.push(a);
    }
    return result;
}

function exampleFromInheritedType(inheritedType:rt.InheritedType) : nm.IExpandableExample[] {
    var result:nm.IExpandableExample[]=[]
    var ms1=inheritedType.oneMeta(meta.Examples);
    if (ms1){
        var vl=ms1.value();
        if (vl && typeof vl === "object") {
            var xmlValues: any;

            Object.keys(vl).forEach(key=> {
                var name = Array.isArray(vl) ? null : key;
                var exampleObj = vl[key];
                var example = toExample({asXMLString: () => {
                    if(!xmlValues) {
                        xmlValues = ms1.asXMLStrings();
                    }

                    return xmlValues[key];
                }}, exampleObj, name);
                result.push(example);
            })
        }

    }
    var ms=inheritedType.oneMeta(meta.Example);
    if (ms){

        var exampleV=ms.example();
        if (exampleV!=null){
            result.push(toExample(ms, ms.value(), undefined, true));
        }
    }

    return result;
}

export function exampleFromNominal(nominalType:nm.ITypeDefinition,collectFromSupertype?:boolean):nm.IExpandableExample[]{
    var originalInherited=nominalType.getAdapter(rt.InheritedType);
    if (originalInherited){
        var originalTypeExamples = exampleFromInheritedType(originalInherited);
        if (originalTypeExamples && originalTypeExamples.length > 0) {
            return originalTypeExamples;
        }

        if (collectFromSupertype && nominalType.isUserDefined() && !nominalType.isGenuineUserDefinedType()
            && nominalType.genuineUserDefinedTypeInHierarchy()) {

            var genuineNominal = nominalType.genuineUserDefinedTypeInHierarchy();
            var genuineInherited = genuineNominal.getAdapter(rt.InheritedType)

            if (genuineInherited) {
                var genuineTypeExamples = exampleFromInheritedType(genuineInherited);
                if (genuineTypeExamples && genuineTypeExamples.length > 0) {
                    return genuineTypeExamples;
                }
            }
        }
    }
    if (originalInherited) {
        return [new Example(example(originalInherited),undefined,undefined,undefined,false,undefined,undefined,true)];
    }
    return [];
}

