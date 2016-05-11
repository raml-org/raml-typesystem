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
        private _annotations:any=undefined,
        private _isSingle:boolean=false,
        private _empty:boolean=false){

    }

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

    annotations():any{
        return this._annotations;
    }

    name():string{
        return this._name;
    }

}
var toExample = function (owner: any, exampleObj:any, name:string=null,isSingle:boolean=false) {
    var example:Example;
    if (exampleObj) {
        var val = exampleObj.value;
        if (!val) {
            val = exampleObj
            example = new Example(val, name, undefined, undefined, true, undefined, isSingle);
        }
        else {
            var displayName = exampleObj.displayName;
            var description = exampleObj.description;
            var strict:boolean = exampleObj.strict;
            var aObj:any = null;
            var annotationNames = Object.keys(exampleObj).filter(x=>x.charAt(0) == "(");
            if (annotationNames.length > 0) {
                aObj = {};
                for (var aName of annotationNames) {
                    var aVal = exampleObj[aName];
                    aName = aName.substring(1, aName.length - 1);
                    aObj[aName] = aVal;
                }
            }
            example = new Example(val, name, displayName, description, strict, aObj, isSingle);
        }
    }
    
    if(example) {
        example._owner = owner;
    }
    
    return example;
};
export function exampleFromNominal(n:nm.ITypeDefinition):nm.IExpandableExample[]{
    var tp=n.getAdapter(rt.InheritedType);
    if (tp){
        var result:nm.IExpandableExample[]=[]
        var ms1=tp.oneMeta(meta.Examples);
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
        var ms=tp.oneMeta(meta.Example);
        if (ms){

            var exampleV=ms.example();
            if (exampleV){
                result.push(toExample(ms, ms.value(), undefined, true));
            }
        }
        if(result.length>0) {
            return result;
        }
    }
    if (tp) {
        return [new Example(example(tp),undefined,undefined,undefined,false,undefined,undefined,true)];
    }
    return [];
}