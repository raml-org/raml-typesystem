/// <reference path="../typings/main.d.ts" />
import ts=require("./typesystem");
var messageRegistry = ts.messageRegistry;
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
export class Annotation extends MetaInfo implements tsInterfaces.IAnnotation{

    constructor(name: string,value:any){
        super(name,value)
    }

    private _ownerFacet:tsInterfaces.ITypeFacet;

    validateSelf(registry:ts.TypeRegistry,ofExample:boolean=false):ts.Status {
        var tp=registry.get(this.facetName());
        if (!tp){
            return ts.error(messageRegistry.UNKNOWN_ANNOTATION,this,{facetName: this.facetName()});
        }
        var result = ts.ok();
        var q=this.value();
        if (!q){
            if (tp.isString()){
                q="";
            }
        }
        var aTargets = tp.metaOfType(AllowedTargets);
        var contextTarget = ofExample ? "Example" : "TypeDeclaration";
        if(aTargets.length>0) {
            var arr:string[] = [];
            var at = aTargets.filter(x=> {
                var val = x.value();
                if (Array.isArray(val)) {
                    arr = arr.concat(val);
                    return val.indexOf(contextTarget) >= 0;
                }
                arr.push(val);
                return val == contextTarget;
            });
            if (at.length == 0) {
                var list = arr.map(x=>`'${x}'`).join(", ");
                var targetStatus = ts.error(messageRegistry.INVALID_ANNOTATION_LOCATION, this, { aName: super.facetName(), aValues: list });                
                result.addSubStatus(targetStatus);
            }
        }
        var valOwner=tp.validateDirect(q,true,false);
        if (!valOwner.isOk()){
            var res = ts.error(messageRegistry.INVALID_ANNOTATION_VALUE, this, { msg: valOwner.getMessage() });
            res.addSubStatus(valOwner);
            result.addSubStatus(res);
        }
        ts.setValidationPath(result,{name:`(${this.facetName()})`});
        return result;
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Annotation;
    }

    ownerFacet(){
        return this._ownerFacet;
    }

    setOwnerFacet(ownerFacet:tsInterfaces.ITypeFacet){
        this._ownerFacet = ownerFacet;
    }
}
export class FacetDeclaration extends MetaInfo{

    constructor(
        private name: string,
        private _type:ts.AbstractType,
        private optional:boolean,
        private builtIn = false){
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
    
    isBuiltIn():boolean{
        return this.builtIn;
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
            if (firstChar=="{" || firstChar=="[" || exampleString.trim()=="null" ){
                try {
                    return JSON.parse(exampleString);
                } catch (e) {
                    if (type.isObject()||type.isArray()){
                        var c = ts.error(messageRegistry.CAN_NOT_PARSE_JSON, this, { msg: e.message });
                        return c;
                    }
                }
            }
            if (firstChar=="<") {
                try {
                    var jsonFromXml = xmlio.readObject(exampleString,type);

                    var errors: Status[] = xmlio.getXmlErrors(jsonFromXml);

                    if(errors) {
                        var error = ts.error(messageRegistry.INVALID_XML, null);

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

var exampleScalarProperties = [
    {propName: "strict", propType: "boolean", messageEntry:messageRegistry.STRICT_BOOLEAN},
    {propName: "displayName", propType: "string", messageEntry:messageRegistry.DISPLAY_NAME_STRING},
    {propName: "description", propType: "string", messageEntry:messageRegistry.DESCRIPTION_STRING}
];

export class Example extends MetaInfo{
    constructor(value:any){
        super("example",value)
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        var status = ts.ok();
        status.addSubStatus(this.validateValue(registry));
        var aStatus = this.validateAnnotations(registry);
        ts.setValidationPath(aStatus,{name:this.facetName()});
        status.addSubStatus(aStatus);
        return status;
    }

    validateValue(registry:ts.TypeRegistry):ts.Status {
        var val=this.value();
        var isVal=false;
        var result = ts.ok();
        if (typeof val==="object"&&val){
            if (val.value){
                

                for(var y of exampleScalarProperties) {
                    var propName = y.propName;
                    var propType = y.propType;
                    var propObj = val[propName];
                    if (propObj&&typeof propObj!=propType){
                        if(typeof(propObj)=="object") {
                            Object.keys(propObj).forEach(key=> {
                                if (key.charAt(0) == '(' && key.charAt(key.length - 1) == ')') {
                                    var a = new Annotation(key.substring(1, key.length - 1), propObj[key]);
                                    var aRes = a.validateSelf(registry, true);
                                    ts.setValidationPath(aRes,{
                                            name: "example",
                                            child: {name: propName, child: {name: key}}
                                        });
                                    result.addSubStatus(aRes);
                                }
                            });
                        }

                        if(!propObj.value&&typeof propObj.value!=propType) {
                            var s = ts.error(y.messageEntry, this);
                            var vp = propObj.value ? {name: "value"} : null;
                            ts.setValidationPath(s,{name: "example", child: {name: propName, child: vp}});
                            result.addSubStatus(s);
                        }
                    }
                    
                }
                
                if (val.strict===false||(typeof(val.strict)=="object"&&val.strict.value===false)){
                    return result;
                }
                val=val.value;
                isVal=true;

            }
        }
        var rr=parseExampleIfNeeded(val,this.owner());
        if (rr instanceof ts.Status && !rr.isOk()){
            ts.setValidationPath(rr,{name: "example"});
            result.addSubStatus(rr);
            return result;
        }
        var valOwner=this.owner().validateDirect(rr,true,false);
        if (!valOwner.isOk()){
            if (typeof this.value()==="string"){

            }
            var c = ts.error(messageRegistry.INVALID_EXMAPLE, this, { msg : valOwner.getMessage() });
            valOwner.getErrors().forEach(x=>{c.addSubStatus(x);
                if (isVal) {
                    ts.setValidationPath(x,{name: "example", child: {name: "value"}});
                }
                else{
                    ts.setValidationPath(x,{name: "example"});
                }
            });

            result.addSubStatus(c);
        }
        return result;
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
                    status.addSubStatus(aInstance.validateSelf(registry,true));
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
        var result = super.validateSelf(registry);
        if (typeof this.value()!=="boolean"){
            result =  ts.error(messageRegistry.REQUIRED_BOOLEAN,this);
            ts.setValidationPath(result,{name:this.facetName()});
        }
        return result;
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Required;
    }
}

export class HasPropertiesFacet extends MetaInfo{
    constructor(){
        super("hasPropertiesFacet",null);
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.HasPropertiesFacet;
    }
}
export class AllowedTargets extends MetaInfo{
    constructor(value:any){
        super("allowedTargets",value)
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
            var rs=new Status(Status.OK,"","",this);
            var v=this.value();
            if (v) {
                Object.keys(v).forEach(x=> {
                    var exampleObj = v[x];
                    if (exampleObj) {
                        if (typeof exampleObj=="object"&&exampleObj.value) {
                            Object.keys(exampleObj).forEach(key=> {
                                if (key.charAt(0) == '(' && key.charAt(key.length - 1) == ')') {
                                    var a = new Annotation(key.substring(1, key.length - 1), v[x][key]);
                                    var aRes = a.validateSelf(registry,true);
                                    ts.setValidationPath(aRes,
                                        {name:"examples",child:{name: x, child: {name: key}}});
                                    rs.addSubStatus(aRes);
                                }
                            });
                        }
                        var val=exampleObj.value;
                        var noVal=!val;
                        if (noVal){
                            val=exampleObj;
                        }
                        else{
                            for(var y of exampleScalarProperties) {
                                this.checkScalarProperty(exampleObj, x, y, registry,rs);
                            }
                            if (exampleObj.strict===false||(
                                typeof(exampleObj.strict)=="object" && exampleObj.strict.value === false)){
                                return ;
                            }
                        }
                        var example = parseExampleIfNeeded(val, this.owner());
                        if (example instanceof ts.Status) {
                            examplesPatchPath(example,noVal,x)
                            rs.addSubStatus(example);
                            return;
                        }
                        var res = this.owner().validate(example, true, false);
                        res.getErrors().forEach(ex=> {
                            rs.addSubStatus(ex);
                            examplesPatchPath(ex,noVal,x)
                        });
                    }
                });
            }
            return rs;
        }
        else{
            return ts.error(messageRegistry.EXMAPLES_MAP,this);
        }
    }

    private checkScalarProperty(
        exampleObj:any,
        exampleName:string,
        y:any,
        registry:ts.TypeRegistry,
        status:Status) {
        
        var propName = y.propName;
        var propType = y.propType;
        var propObj = exampleObj[propName];

        if (propObj && typeof propObj != propType) {
            var vp:tsInterfaces.IValidationPath = null;
            if (typeof(propObj) == "object") {
                vp = {name: "value"};
                Object.keys(propObj).forEach(key=> {
                    if (key.charAt(0) == '(' && key.charAt(key.length - 1) == ')') {
                        var a = new Annotation(key.substring(1, key.length - 1), exampleObj[propName][key]);
                        var aRes = a.validateSelf(registry, true);
                        ts.setValidationPath(aRes,
                            {
                                name: "examples",
                                child: {name: exampleName, child: {name: propName, child: {name: key}}}
                            });
                        status.addSubStatus(aRes);
                    }
                });
            }
            if (!propObj.value && typeof(propObj.value) != propType) {
                var s = ts.error(y.messageEntry, this);
                ts.setValidationPath(s,{
                    name: "examples",
                    child: {name: exampleName, child: {name: propName, child: vp}}
                });
                status.addSubStatus(s);
            }
        }
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Examples;
    }
}
function examplesPatchPath(example:tsInterfaces.IStatus,noVal:boolean,x: string):void{
    if (noVal){
        ts.setValidationPath(example,{ name: "examples",child:{name: x}});
    }
    else {
        ts.setValidationPath(example,{ name: "examples",child:{name: x, child: {name: "value"}}});
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
        var result = super.validateSelf(registry);
        var valOwner=this.owner().validateDirect(this.value(),true);
        if (!valOwner.isOk()){
            var c = ts.error(messageRegistry.INVALID_DEFAULT_VALUE, this, { msg : valOwner.getMessage() });
            valOwner.getErrors().forEach(x=>{c.addSubStatus(x);
                ts.setValidationPath(x,{name:this.facetName()});
            });
            result.addSubStatus(c);
        }
        return result;
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
        var result = super.validateSelf(registry);
        if (this.owner().isUnion()){
            result = ts.error(messageRegistry.DISCRIMINATOR_FOR_UNION, this);
        }
        else if (!this.owner().isSubTypeOf(ts.OBJECT)){
            result = ts.error(messageRegistry.DISCRIMINATOR_FOR_OBJECT, this)
        }
        else if (this.owner().getExtra(ts.GLOBAL)===false){
            result = ts.error(messageRegistry.DISCRIMINATOR_FOR_INLINE, this)
        }
        else {
            var prop = _.find(this.owner().meta(), x=>x instanceof PropertyIs && (<PropertyIs>x).propertyName() == this.value());
            if (!prop) {
                result = ts.error(messageRegistry.UNKNOWN_FOR_DISCRIMINATOR,
                    this, {value: this.value()}, ts.Status.WARNING);
            }
            else if (!prop.value().isScalar()) {
                result = ts.error(messageRegistry.SCALAR_FOR_DISCRIMINATOR, this);
            }
        }
        if(!result.getValidationPath()) {
            ts.setValidationPath(result,{name: this.facetName()});
        }
        return result;
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Discriminator;
    }
}

export class DiscriminatorValue extends ts.Constraint{
    constructor(public _value: any, protected strict:boolean=true){
        super(false);
    }

    check(i:any,path:tsInterfaces.IValidationPath):Status{
        var owner = this.owner();//_.find([t].concat(t.allSuperTypes()),x=>x.getExtra(TOPLEVEL));
        var dVal:string = this.value();
        var discriminator = owner.metaOfType(Discriminator);
        if(discriminator.length==0){
            return ts.ok();
        }
        var dName = discriminator[0].value();
        // if(owner) {
        //     dVal = owner.name();
        // }
        // var discriminatorValue = t.metaOfType(metaInfo.DiscriminatorValue);
        // if(discriminatorValue.length!=0){
        //     dVal = discriminatorValue[0].value();
        // }
        if(dVal) {
            if (i.hasOwnProperty(dName)) {
                var queue = this.owner().allSubTypes().concat(this.owner());
                var knownDiscriminatorValues:any = {};
                for(var t of queue){
                    let dvArr = t.metaOfType(DiscriminatorValue);
                    if(dvArr && dvArr.length >0){
                       dvArr.forEach(dv=>knownDiscriminatorValues[dv.value()] = true);
                    }
                }
                var adVal = i[dName];
                if (!knownDiscriminatorValues[adVal]) {
                    var wrng = ts.error(Status.CODE_INCORRECT_DISCRIMINATOR, this, {
                        rootType : owner.name(),
                        value: adVal,
                        propName: dName
                    }, Status.WARNING );
                    //var wrng = new Status(Status.WARNING, Status.CODE_INCORRECT_DISCRIMINATOR, dVal, this);
                    ts.setValidationPath(wrng,{name: dName, child: path});
                    return wrng;
                }
                return ts.ok();
            }
            else {
                var err = ts.error(Status.CODE_MISSING_DISCRIMINATOR, this, {
                    rootType: owner.name(),
                    propName: dName
                });
                //var err = new Status(Status.ERROR, Status.CODE_MISSING_DISCRIMINATOR, dVal, this);
                ts.setValidationPath(err,path);
                return err;
            }
        }
    }
    facetName(){return "discriminatorValue"}

    validateSelf(registry:ts.TypeRegistry):ts.Status {
        var st = super.validateSelf(registry);
        if(this.strict) {
            var ds = this.owner().oneMeta(Discriminator);
            if (!this.owner().isSubTypeOf(ts.OBJECT)) {
                st.addSubStatus(ts.error(messageRegistry.DISCRIMINATOR_FOR_OBJECT, this));
            }
            else if (this.owner().getExtra(ts.GLOBAL) === false) {
                st.addSubStatus(ts.error(messageRegistry.DISCRIMINATOR_FOR_INLINE, this));
            }
            else if (!ds) {
                st.addSubStatus(ts.error(messageRegistry.DISCRIMINATOR_VALUE_WITHOUT_DISCRIMINATOR, this));
            }
            else {
                var prop = _.find(this.owner().meta(), x=>
                x instanceof PropertyIs && (<PropertyIs>x).propertyName() == ds.value());
                if (prop) {
                    var sm = prop.value().validate(this.value());
                    if (!sm.isOk()) {
                        st.addSubStatus(ts.error(messageRegistry.INVALID_DISCRIMINATOR_VALUE,
                            this, {msg: sm.getMessage()}));
                    }
                }
            }
        }
        if(!st.getValidationPath()) {
            ts.setValidationPath(st,{name: this.facetName()});
        }
        return st;
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
    
    isStrict():boolean{ return this.strict; }
}