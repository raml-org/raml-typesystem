/// <reference path="../typings/main.d.ts" />
import ts=require("./typesystem")
import {Status} from "./typesystem";
import {PropertyIs} from "./restrictions";
import _=require("underscore")
import xmlio=require("./xmlio")
import tsInterfaces=require("./typesystem-interfaces")

export class MetaInfo extends ts.TypeInformation {


    constructor(private _name: string,private _value: any,inhertitable:boolean=false){
        super(inhertitable)
    }

    value(){
        return this._value;
    }

    requiredType(){
        return ts.ANY;
    }
    facetName(){
        return this._name;
    }

    kind() : tsInterfaces.MetaInformationKind {
        //to be overriden in subtypes
        return null;
    }
}
export class Description extends MetaInfo{

    constructor(value:string){
        super("description",value)
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Description;
    }
}
export  class NotScalar extends MetaInfo{
    constructor(){
        super("notScalar",true)
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.NotScalar;
    }
}
export class DisplayName extends MetaInfo{


    constructor(value:string){
        super("displayName",value)
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.DisplayName;
    }
}
export class Usage extends MetaInfo{


    constructor(value:string){
        super("usage",value)
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Usage;
    }
}
export class Annotation extends MetaInfo{

    constructor(name: string,value:any){
        super(name,value)
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        var tp=registry.get(this.facetName());
        if (!tp){
            return new Status(Status.ERROR,0,"using unknown annotation type:"+this.facetName(),this);
        }
        var q=this.value();
        if (!q){
            if (tp.isString()){
                q="";
            }
        }
        var valOwner=tp.validateDirect(q,true,false);
        if (!valOwner.isOk()){
            var res=new Status(Status.OK,0,"invalid annotation value"+valOwner.getMessage(),this);
            res.addSubStatus(valOwner);
            return res;
        }
        return ts.ok();
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Annotation;
    }
}
export class FacetDeclaration extends MetaInfo{

    constructor(private name: string,private _type:ts.AbstractType,private optional:boolean){
        super(name,_type,true)
    }
    actualName(){
        if (this.name.charAt(this.name.length-1)=='?'){
            return this.name.substr(0,this.name.length-1);
        }
        return this.name;
    }

    isOptional(){
        return this.optional;
    }
    type():ts.AbstractType{
        return this._type;
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.FacetDeclaration;
    }
}
export class CustomFacet extends MetaInfo{

    constructor(name: string,value:any){
        super(name,value,true)
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.CustomFacet;
    }
}

function serializeToXml(value: any, type: ts.AbstractType): string {
    return xmlio.serializeToXML(value, type);
}

function parseExampleIfNeeded(val:any,type:ts.AbstractType):any{
    if (typeof val==='string'){
        if (type.isObject() || type.isArray() || type.isExternal() || type.isUnion()){
            var exampleString:string=val;
            var firstChar = exampleString.trim().charAt(0);
            if ((firstChar=="{" || firstChar=="[") ){
                try {
                    return JSON.parse(exampleString);
                } catch (e) {
                    if (type.isObject()||type.isArray()){
                        var c= new Status(Status.ERROR,0,"Can not parse JSON example:"+e.message,this);
                        return c;
                    }
                }
            }
            if (firstChar=="<") {
                try {
                    var jsonFromXml = xmlio.readObject(exampleString,type);

                    var errors: Status[] = xmlio.getXmlErrors(jsonFromXml);

                    if(errors) {
                        var error = new Status(Status.ERROR, 0, 'Invalid XML.', {});

                        errors.forEach(child => error.addSubStatus(child));
                        
                        return error;
                    }

                    return jsonFromXml;
                } catch (e) {

                }
            }
        }
    }
    if (type.getExtra(tsInterfaces.REPEAT)){
        val=[val];
    }
    return val;
}
export class Example extends MetaInfo{
    constructor(value:any){
        super("example",value)
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        var status = ts.ok();
        status.addSubStatus(this.validateValue(registry));
        status.addSubStatus(this.validateAnnotations(registry));
        return status;
    }

    validateValue(registry:ts.TypeRegistry):ts.Status {
        var val=this.value();
        var isVal=false;
        if (typeof val==="object"&&val){
            if (val.value){
                if (val.strict===false){
                    return ts.ok();
                }
                if (val.strict&&typeof val.strict!="boolean"){
                    var s= new Status(Status.ERROR,0,"strict should be boolean",this);
                    s.setValidationPath({name: "example", child: {name: "strict"}})
                    return s;
                }
                val=val.value;
                isVal=true;

            }
        }
        var rr=parseExampleIfNeeded(val,this.owner());
        if (rr instanceof ts.Status){
            rr.setValidationPath({name: "example"})
            return rr;
        }
        var valOwner=this.owner().validateDirect(rr,true,false);
        if (!valOwner.isOk()){
            if (typeof this.value()==="string"){

            }
            var c= new Status(Status.ERROR,0,"using invalid `example`:"+valOwner.getMessage(),this);
            valOwner.getErrors().forEach(x=>{c.addSubStatus(x);
                if (isVal) {
                    x.setValidationPath({name: "example", child: {name: "value"}});
                }
                else{
                    x.setValidationPath({name: "example"});
                }
            });

            return c;
        }
        return ts.ok();
    }

    validateAnnotations(registry:ts.TypeRegistry):ts.Status {
        var status = ts.ok();
        var val=this.value();
        if (typeof val==="object"&&val){
            if (val.value){
                var usedAnnotations = Object.keys(val).filter(x=>
                x.length>2 && x.charAt(0)=="(" && x.charAt(x.length-1)==")");

                for(var ua of usedAnnotations) {
                    var aValue = val[ua];
                    var aName = ua.substring(1,ua.length-1);
                    var aInstance = new Annotation(aName,aValue);
                    status.addSubStatus(aInstance.validateSelf(registry));
                }
            }
        }
        return status;
    }
    
    example():any{
        var val=this.value();
        if (typeof val==="object"&&val){
            if (val.value){
                val=val.value;
            }
        }
        return parseExampleIfNeeded(val, this.owner());
    }

    asXMLString(): string {
        var value = this.value();

        if(typeof value === 'string' && value.trim().indexOf('<') === 0) {
            return value;
        }

        var parsedValue: any = parseExampleIfNeeded(value, this.owner());

        return serializeToXml(parsedValue, this.owner());
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Example;
    }
}
export class Required extends MetaInfo{
    constructor(value:any){
        super("required",value)
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        if (typeof this.value()!=="boolean"){
            return new Status(Status.ERROR,0,"value of required facet should be boolean",this);
        }
        return ts.ok();
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Required;
    }
}
export class AllowedTargets extends MetaInfo{
    constructor(value:any){
        super("allowedTargets",value)
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status {

        return ts.ok();
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.AllowedTargets;
    }
}

export class Examples extends MetaInfo{
    constructor(value:any){
        super("examples",value)
    }

    examples():any[]{
        var v=this.value();
        var result:any[]=[];
        Object.keys(v).forEach(x=>{
            if (typeof v[x]=='object'&&v[x]) {
                var val=v[x].value;
                if (!val){
                    val=v[x];
                }
                var example = parseExampleIfNeeded(val, this.owner());
                result.push(example);
            }
        });
        return result;
    }

    asXMLStrings(): string[] {
        var value = this.value();

        var result: any = {};

        Object.keys(value).forEach(key => {
            var childValue: any = value[key];

            if(typeof childValue === 'string' && childValue.trim().indexOf('<') === 0) {
                result[key] = childValue;

                return;
            }

            var parsedValue: any = parseExampleIfNeeded(childValue, this.owner());

            result[key] = serializeToXml(parsedValue, this.owner());
        });

        return result;
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        if (typeof this.value()==='object'){
            var rs=new Status(Status.OK,0,"",this);
            var v=this.value();
            if (v) {
                Object.keys(v).forEach(x=> {
                    if (v[x]) {
                        var val=v[x].value;
                        var noVal=!val;
                        if (noVal){
                            val=v[x];
                        }
                        else{
                            if (v[x].strict===false){
                                return ;
                            }
                            if (v[x].strict&&typeof v[x].strict!="boolean"){
                                var s= new Status(Status.ERROR,0,"strict should be boolean",this);
                                s.setValidationPath({name: x, child: {name: "strict", child: {name: "strict"}}});
                                return s;
                            }
                        }
                        var example = parseExampleIfNeeded(val, this.owner());
                        if (example instanceof ts.Status) {
                            examplesPatchPath(example,noVal,x)
                            rs.addSubStatus(example);
                            return;
                        }
                        var res = this.owner().validateDirect(example, true, false);
                        res.getErrors().forEach(ex=> {
                            rs.addSubStatus(ex);
                            examplesPatchPath(ex,noVal,x)
                        });
                        if (typeof v[x]=="object"&&v[x].value) {
                            Object.keys(v[x]).forEach(key=> {
                                if (key.charAt(0) == '(' && key.charAt(key.length - 1) == ')') {
                                    var a = new Annotation(key.substring(1, key.length - 1), v[x][key]);
                                    rs.addSubStatus(a.validateSelf(registry));
                                }
                            });
                        }
                    }
                });
            }
            return rs;
        }
        else{
            return new Status(Status.ERROR,0,"examples should be a map",this);
        }
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Examples;
    }
}
function examplesPatchPath(example:ts.Status,noVal:boolean,x: string):void{
    if (noVal){
        example.setValidationPath({ name: "examples",child:{name: x}});
    }
    else {
        example.setValidationPath({ name: "examples",child:{name: x, child: {name: "value"}}});
    }
}

export class XMLInfo extends MetaInfo{
    constructor(o:any){
        super("xml",o)
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.XMLInfo;
    }
}

export class Default extends MetaInfo{

    constructor(value:any){
        super("default",value)
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        var valOwner=this.owner().validateDirect(this.value(),true);
        if (!valOwner.isOk()){
            return new Status(Status.ERROR,0,"using invalid `defaultValue`:"+valOwner.getMessage(),this);
        }
        return ts.ok();
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Default;
    }
}
export class Discriminator extends ts.TypeInformation{

    constructor(public property: string){
        super(true);
    }

    requiredType(){
        return ts.OBJECT;
    }

    value(){
        return this.property;
    }
    facetName(){return "discriminator"}

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        if (!this.owner().isSubTypeOf(ts.OBJECT)){
            return new Status(Status.ERROR,0,"you only can use `discriminator` with object types",this)
        }
        if (this.owner().getExtra(ts.GLOBAL)===false){
            return new Status(Status.ERROR,0,"you only can use `discriminator` with top level type definitions",this)
        }
        var prop=_.find(this.owner().meta(),x=>x instanceof PropertyIs&& (<PropertyIs>x).propertyName()==this.value());
        if (!prop){
            return new Status(Status.ERROR,0,"Using unknown property '"+this.value()+"' as discriminator",this,true);
        }
        if (!prop.value().isScalar()){
            return new Status(Status.ERROR,0,"It is only allowed to use scalar properties as discriminators",this);
        }
        return ts.ok();
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Discriminator;
    }
}

export class DiscriminatorValue extends ts.TypeInformation{
    constructor(public _value: any){
        super(false);
    }
    facetName(){return "discriminatorValue"}

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        if (!this.owner().isSubTypeOf(ts.OBJECT)){
            return new Status(Status.ERROR,0,"you only can use `discriminator` with object types",this)
        }
        if (this.owner().getExtra(ts.GLOBAL)===false){
            return new Status(Status.ERROR,0,"you only can use `discriminator` with top level type definitions",this)
        }
        var ds=this.owner().oneMeta(Discriminator);
        if (!ds){
            return new Status(Status.ERROR,0,"you can not use `discriminatorValue` without declaring `discriminator`",this)
        }
        var prop=_.find(this.owner().meta(),x=>x instanceof PropertyIs&& (<PropertyIs>x).propertyName()==ds.value());
        if (prop){
            var sm=prop.value().validate(this.value());
            if (!sm.isOk()){
                return new Status(Status.ERROR,0,"using invalid `disciminatorValue`:"+sm.getMessage(),this);
            }
        }
        return ts.ok();
    }

    requiredType(){
        return ts.OBJECT;
    }
    value(){
        return this._value;
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.DiscriminatorValue;
    }
}