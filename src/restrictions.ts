/// <reference path="../typings/main.d.ts" />
import ts=require("./typesystem");
var messageRegistry = ts.messageRegistry;
import su=require("./schemaUtil")
import _= require("underscore");
import {AndRestriction} from "./typesystem";
import {Constraint} from "./typesystem";
import {AbstractType} from "./typesystem";
import {Status} from "./typesystem";
export type IValidationPath=ts.IValidationPath;
/**
 * this class is an abstract super type for every constraint that can select properties from objects
 */
export abstract class MatchesProperty extends ts.Constraint{
     matches(s:string):boolean{
         return false;
     }

    constructor(private _type:ts.AbstractType){super()}

    abstract path():string;

    check(i:any,p:ts.IValidationPath):ts.Status{
        throw new Error("Should be never called");
    }

    patchPath(p:ts.IValidationPath):IValidationPath{
        if (!p){
            return { name: this.propId()};
        }
        else{
            var c=p;
            var r:IValidationPath=null;
            var cp:IValidationPath=null;
            while (c){
                if (!r){
                    r={name: c.name};
                    cp=r;
                }
                else{
                    var news= {name: c.name};
                    cp.child=news;
                    c= c.child;
                    cp=news;
                }
            }
            r.child={name:this.propId()};
            return r;
        }
    }

    validateProp(i: any,n:string, t:ts.AbstractType,q:ts.IValidationPath){
        var vl=i[n];

            var st=t.validate(vl,false,false);
            if (!st.isOk()){
                if (t.isUnknown()|| t.isRecurrent()){
                    var s=ts.error(messageRegistry.VALIDATING_AGAINS_UNKNOWN,
                        this,{typeName:t.name()});
                    ts.setValidationPath(s,this.patchPath(q));
                    return s;
                }
                var s=new Status(Status.OK,"","",this);
                st.getErrors().forEach(x=>s.addSubStatus(x));
                ts.setValidationPath(s,this.patchPath(q));
                return s;
            }
        return ts.ok();
    }

    abstract propId():string


    validateSelf(registry:ts.TypeRegistry):ts.Status {
        if (this._type.isExternal()){
            var p=ts.error(messageRegistry.EXTERNAL_IN_PROPERTY_DEFINITION, this);
            ts.setValidationPath(p,{name: this.propId()})
            return p;
        }
        if (this._type.isSubTypeOf(ts.UNKNOWN)||this._type.isSubTypeOf(ts.RECURRENT)){
            var actualUnknown = actualUnknownType(this._type);
            var p= ts.error(messageRegistry.UNKNOWN_IN_PROPERTY_DEFINITION,this,{
                propName: this.propId(),
                typeName: actualUnknown.name()
            });
            ts.setValidationPath(p,{name: this.propId(), child: { name: "type"}})
            return p;
        }
        if (this._type.isAnonymous()){
            var st=this._type.validateType(registry);
            if (!st.isOk()){
                var p= ts.error(messageRegistry.ERROR_IN_RANGE,this, {
                    propName: this.propId(),
                    msg: st.getMessage()
                });
                st.getErrors().forEach(y=>{p.addSubStatus(y)});

                ts.setValidationPath(p,{name: this.propId()});
                return p;
            }
            return st;
        }

        if (this._type.isUnion()){
           var ui= _.find(this._type.typeFamily(),x=>x.isSubTypeOf(ts.UNKNOWN));
           if (ui){
               var p= ts.error(messageRegistry.UNKNOWN_IN_PROPERTY_DEFINITION,this,{
                   propName: this.propId(),
                   typeName: ui.name()
               });
               ts.setValidationPath(p,{name: this.propId()})
               return p;
           }
        }
        return ts.ok();
    }
}

export class MatchToSchema extends  ts.Constraint{

    constructor(private _value:string, private provider: su.IContentProvider){
        super();
    }
    value(){
        return this._value;
    }
    check(i:any):ts.Status{
        var so:su.Schema=null;
        var strVal=this.value();
        if (strVal.charAt(0)=="{"){
            try {
                so = su.getJSONSchema(strVal, this.provider);
            } catch (e){
                return ts.error(messageRegistry.INCORRECT_SCHEMA,this,{msg: e.message});
            }
        }
        if (strVal.charAt(0)=="<"){
            try {
                so = su.getXMLSchema(strVal, this.provider);
            } catch (e){
                return ts.ok();
            }
        }
        if(so){
            try {
                so.validateObject(i);
            }catch(e){
                if (e.message=="!_PERF_!"){
                    return ts.error(messageRegistry.UNABLE_TO_VALIDATE_XML,this,{},ts.Status.WARNING);
                }
                if (e.message=="Cannot assign to read only property '__$validated' of object"){
                    return ts.ok();
                }
                if (e.message=="Object.keys called on non-object"){
                    return ts.ok();
                }
                if (e.message == "Maximum call stack size exceeded"){
                    return ts.error(messageRegistry.CIRCULAR_REFS_IN_JSON_SCHEMA,this);
                }
                return ts.error(messageRegistry.EXAMPLE_SCHEMA_FAILURE,
                    this, { msg : e.message });
            }
            //validate using classical schema;
        }
        return ts.ok();
    }


    facetName(){
        return "schema";
    }

    requiredType(){
        return ts.EXTERNAL;
    }
}
/**
 * this is a constraint which checks that object has no unknown properties if at has not additional properties
 */
export class KnownPropertyRestriction extends ts.Constraint{

    facetName(){
        return "closed"
    }

    requiredType(){
        return ts.OBJECT;
    }

    value(){
        return this._value;
    }

    constructor(private _value: boolean){
        super();
    }

    patchOwner(t:AbstractType){
        this._owner=t;
    }

    check(i:any):ts.Status{

        if (this._value===false) {
            if (i&&typeof  i == 'object'&&!Array.isArray(i)) {
                var nm:{ [name:string]:boolean} = {};
                Object.getOwnPropertyNames(i).forEach(n=>nm[n] = true);
                var mp:MatchesProperty[] = <MatchesProperty[]>this.owner().knownProperties();
                Object.getOwnPropertyNames(i).forEach(p=> {
                    mp.forEach(v=> {
                        if (v.matches(p)) {
                            delete nm[p];
                        }
                    });
                });
                var unknownPropertyNames = Object.keys(nm);
                if ((this.owner().hasPropertiesFacet()||mp.length>0) && unknownPropertyNames.length > 0) {
                    var s=new ts.Status(ts.Status.OK,"","",this);
                    unknownPropertyNames.forEach(x=>{
                        var err=ts.error(messageRegistry.UNKNOWN_PROPERTY,this,{propName:x});
                        ts.setValidationPath(err,{name:x});
                        s.addSubStatus(err)}
                    );
                    return s;
                }
            }
        }
        return ts.ok();
    }
    composeWith(restriction:Constraint):Constraint{
        if (!this._value){
            return null;
        }
        if (restriction instanceof KnownPropertyRestriction) {
            var  mm = <KnownPropertyRestriction> restriction;
            if (_.isEqual(this.owner().propertySet(),mm.owner().propertySet())) {
                return mm;
            }
        }
        if (restriction instanceof HasProperty) {
            var  ps = <HasProperty> restriction;
            var name = ps.value();
            var allowedPropertySet = this.owner().propertySet();
            if (allowedPropertySet.indexOf(name)==-1) {
                return this.nothing(ps);
            }
        }
    }
}
/**
 * this constaint checks that object has a particular property
 */
export class HasProperty extends ts.Constraint{

    constructor(private name: string){
        super();
    }
    check(i:any):ts.Status{
        if (i&&typeof i=='object'&&!Array.isArray(i)) {
            if (i.hasOwnProperty(this.name)) {
                return ts.ok();
            }
            return ts.error(messageRegistry.REQUIRED_PROPERTY_MISSING,
                this,{propName:this.name});
        }
        return ts.ok();
    }

    requiredType(){
        return ts.OBJECT;
    }

    facetName(){
        return "hasProperty"
    }

    value(){
        return this.name;
    }

    composeWith(r:Constraint):Constraint{
        if (r instanceof  HasProperty){
            var hp:HasProperty=r;
            if (hp.name===this.name){
                return this;
            }
        }
        return null;
    }
}

/**
 * this constraint checks that property has a particular tyoe if exists
 */
export class PropertyIs extends MatchesProperty{

    constructor(private name: string,private type:ts.AbstractType, private optional:boolean=false){
        super(type);
    }
    matches(s:string):boolean{
        return s===this.name;
    }

    path(){
        return this.name;
    }

    check(i:any,p:ts.IValidationPath):ts.Status{
        if (i && typeof i==="object") {
            if (i.hasOwnProperty(this.name)) {
                var st = this.validateProp(i, this.name, this.type,p);
                if(!st.isOk()&&this.optional&&i[this.name]==null){
                    return ts.ok();
                }
                return st;
            }
        }
        return ts.ok();
    }
    requiredType(){
        return ts.OBJECT;
    }
    propId(): string{
        return this.name;
    }

    propertyName(){
        return this.name;
    }

    facetName(){
        return "propertyIs"
    }
    value(){
        return this.type;
    }

    composeWith(t:ts.Constraint):ts.Constraint{
        if (t instanceof PropertyIs){
            var pi:PropertyIs=t;
            if (pi.name===this.name){
                if (this.type.typeFamily().indexOf(pi.type)!=-1){
                    return pi;
                }
                if (pi.type.typeFamily().indexOf(this.type)!=-1){
                    return this;
                }
                setAnotherRestrictionComponent(t);
                var intersectionType = this.intersect(this.type, pi.type);
                try {
                    var is:ts.Status = intersectionType.checkConfluent();
                    if (!is.isOk()) {
                        var rc=<ts.RestrictionsConflict>is;
                        return rc.toRestriction();
                    }
                    return new PropertyIs(this.name, intersectionType);
                }finally {
                    this.release(intersectionType);
                }
            }
        }
        return null;
    }
}

var anotherSource:any[] = [];

export function anotherRestrictionComponent():any{
    return anotherSource.length > 0 ? anotherSource[anotherSource.length-1] : null;
}

function setAnotherRestrictionComponent(src:Constraint){
    var owner:AbstractType;
    while(src){
        owner = src.owner();
        if(owner instanceof ts.InheritedType) {
            src = (<ts.InheritedType>owner).contextMeta();
        }
        else{
            src = null;
        }
    }
    anotherSource.push(owner);
}

export function releaseAnotherRestrictionComponent(l:number=0){
    while(anotherSource.length>l) {
        anotherSource.pop();
    }
}

export function anotherRestrictionComponentsCount():number{
    return anotherSource.length;
}
/**
 * this cosnstraint checks that map property values passes to particular type if exists
 */
export class MapPropertyIs extends MatchesProperty{

    constructor(private regexp: string,private type:ts.AbstractType){
        super(type);
    }
    path(){
        return `/${this.regexp}/`;
    }
    matches(s:string):boolean{
       if (s.match(this.regexp)){
           return true;
       }
        return false;
    }

    requiredType(){
        return ts.OBJECT;
    }
     propId():string{
         return '['+this.regexp+']'
     }

    facetName(){
        return "mapPropertyIs"
    }

    value(){
        return this.type;
    }
    regexpValue(){
        return this.regexp;
    }
    validateSelf(t:ts.TypeRegistry):ts.Status{
        var m=this.checkValue();
        if (m){
            return ts.error(messageRegistry.INVALID_REGEXP,this,{ msg: m });
        }
        return super.validateSelf(t);
    }
    checkValue(){
        try{
            new RegExp(this.regexp);
        }
        catch (e){
            return e.message;
        }
        return null;
    }
    composeWith(t:ts.Constraint):ts.Constraint{
        if (t instanceof MapPropertyIs){
            var pi:MapPropertyIs=t;
            if (pi.regexp===this.regexp){
                if (this.type.typeFamily().indexOf(pi.type)!=-1){
                    return pi;
                }
                if (pi.type.typeFamily().indexOf(this.type)!=-1){
                    return this;
                }
                var intersectionType = this.intersect(this.type, pi.type);
                try {
                    var is:ts.Status = intersectionType.checkConfluent();
                    if (!is.isOk()) {
                        var rc=<ts.RestrictionsConflict>is;
                        return rc.toRestriction();
                    }
                    return new MapPropertyIs(this.regexp, intersectionType);
                }finally {
                    this.release(intersectionType);
                }
            }
        }
        return null;
    }

    check(i:any,p:ts.IValidationPath):ts.Status{
        if (i) {
            if (typeof i == 'object') {
                var fixedProperties:any = {};
                if(this._owner!=null) {
                    this._owner.meta().filter(x=>x instanceof PropertyIs).forEach(x=> {
                        fixedProperties[(<PropertyIs>x).propertyName()] = true;
                    });
                }
                var rs:ts.Status = new ts.Status(ts.Status.OK, "", "",this);
                for(var n of Object.getOwnPropertyNames(i)){
                    if(fixedProperties[n]){
                        continue;
                    }
                    if (n.match(this.regexp)) {
                        var stat = this.validateProp(i, n, this.type,p);
                        if (!stat.isOk()) {
                            rs.addSubStatus(stat);
                        }
                    }
                }
                return rs;
            }
        }
        return ts.ok();
    }
}
/**
 * this constraint tests that additional property
 */
export class AdditionalPropertyIs extends MatchesProperty{

    constructor(private type:ts.AbstractType){
        super(type);
    }
    path(){
        return this.facetName();
    }
    matches(s:string):boolean{
        return true;
    }

    requiredType(){
        return ts.OBJECT;
    }
    propId():string{
        return '[]'
    }


    facetName(){
        return "additionalProperties"
    }
    value(){
        return this.type;
    }
    match(n:string):boolean{
        var all:PropertyIs[]=<any>this.owner().metaOfType(<any>PropertyIs);
        var map:MapPropertyIs[]=<any>this.owner().metaOfType(<any>MapPropertyIs);
        for (var i=0;i<all.length;i++){
            if (all[i].matches(n)){
                return true;
            }
        }
        for (var i=0;i<map.length;i++){
            if (map[i].matches(n)){
                return true;
            }
        }
        return false;
    }
    composeWith(t:ts.Constraint):ts.Constraint{
        if (t instanceof AdditionalPropertyIs){
            var pi:AdditionalPropertyIs=t;

            if (this.type.typeFamily().indexOf(pi.type)!=-1){
                return pi;
            }
            if (pi.type.typeFamily().indexOf(this.type)!=-1){
                return this;
            }
            var intersectionType = this.intersect(this.type, pi.type);
            try {
                var is:ts.Status = intersectionType.checkConfluent();
                if (!is.isOk()) {
                    var rc=<ts.RestrictionsConflict>is;
                    return rc.toRestriction();
                }
                return new AdditionalPropertyIs( intersectionType);
            }finally {
                this.release(intersectionType);
            }

        }
        return null;
    }
    check(i:any,p:ts.IValidationPath):ts.Status{
        var t=this.type;
        var res=new ts.Status(ts.Status.OK,"","",this);
        if (i&&typeof i==="object") {
            Object.getOwnPropertyNames(i).forEach(n=> {
                if (!this.match(n)) {
                    var stat = this.validateProp(i, n, t,p);
                    if (!stat.isOk()) {
                        res.addSubStatus(stat);
                    }
                }
            });
        }
        return res;
    }
}
/**
 * common super type for a simple restrictions
 */
export abstract class FacetRestriction<T> extends ts.Constraint{

    abstract facetName():string
    abstract requiredType():ts.AbstractType;

    abstract checkValue():ts.Status
    abstract value():T;

    /**
     * Extension of requiredType() method for the case when there are more than a single type
     * hierarchy roots to cover.
     * requiredType() should return the common superclass for the list.
     *
     * @returns {Array} of types or empty list of there is only a single type set by requiredType() method
     */
    requiredTypes():ts.AbstractType[] {
        return [];
    }

    private checkOwner(requiredType : ts.AbstractType) : boolean {
        var ownerIsCorrect = false;

        if(requiredType.isUnion()){
            var family = (<ts.UnionType>requiredType).typeFamily();
            for(var tp of family){
                if(this.owner().isSubTypeOf(tp)){
                    ownerIsCorrect = true;
                    break;
                }
            }
        }
        else{
            ownerIsCorrect = this.owner().isSubTypeOf(requiredType);
        }

        return ownerIsCorrect;
    }

    validateSelf(registry:ts.TypeRegistry):ts.Status{
        
        var superStatus = super.validateSelf(registry);
        var ownerIsCorrect = false;
        if (this.checkOwner(this.requiredType())) {
            if (this.requiredTypes() && this.requiredTypes().length > 0) {
                var owner = this.owner();
                var correctRequiredSuperType = _.find(this.requiredTypes(), requiredType=>this.checkOwner(requiredType));
                if (correctRequiredSuperType) {
                    ownerIsCorrect = true;
                }
            } else {
                ownerIsCorrect = true;
            }
        }

        var rs:ts.Status;
        if (!ownerIsCorrect){

            var typeNames = this.requiredType().name();
            if (this.requiredTypes() && this.requiredTypes().length > 0) {
                typeNames = "[" + this.requiredTypes().map(requiredType=>requiredType.name()).join() + "]"
            }

            var rs= ts.error(messageRegistry.FACET_USAGE_RESTRICTION,this,{
                facetName: this.facetName(),
                typeNames: typeNames
            });

        }
        else {
            rs = this.checkValue();
        }
        if (rs&&!rs.isOk()) {
            ts.setValidationPath(rs,{name: this.facetName()});
            return rs;
        }
        var statuses = [superStatus,rs].filter(x=>x&&!x.isOk());
        if(statuses.length==0) {
            return ts.ok();
        }
        else if(statuses.length==1){
            return statuses[0];
        }
        else{
            var result = ts.ok();
            for(var status of statuses){
                result.addSubStatus(status);
            }
            return result;
        }
    }

}
function is_int(value:any){
    if((parseFloat(value) == parseInt(value)) && !isNaN(value)){
        return true;
    } else {
        return false;
    }
}
/**
 * abstract super type for every min max restriction
 */
export abstract class MinMaxRestriction extends FacetRestriction<Number>{

    constructor(private _facetName:string,private _value:number,private _max:boolean,private _opposite:string,
                private _requiredType:ts.AbstractType,private _isInt:boolean){
        super();
    }


    facetName():string {
        return this._facetName;
    }

    isIntConstraint(){
        return this._isInt;
    }
    isMax(){
        return this._max;
    }
    abstract extractValue(i:any): number;
    value(){
        return this._value;
    }

    check(i:any):ts.Status{
        var o=this.extractValue(i);
        if (typeof  o=='number'){
            if (this.isMax()){
                if (this.value()<o){
                    return this.createError();
                }
            }
            else{
                if (this.value()>o){
                    return this.createError();
                }
            }
        }
        return ts.ok();
    }
    createError():ts.Status{
        return new Status(Status.ERROR, messageRegistry.MINMAX_RESTRICTION_VIOLATION.code, this.toString(),this);
    }

    minValue(){
        if (this._isInt){
            return 0;
        }
        return Number.NEGATIVE_INFINITY;
    }
    requiredType():ts.AbstractType{
        return this._requiredType;
    }

    checkValue():ts.Status{
        if (typeof this._value !="number"){
            return ts.error(messageRegistry.FACET_REQUIRE_NUMBER,
                this,{ facetName: this.facetName()},ts.Status.ERROR,true);
        }
        if (this.isIntConstraint()){
            if (!is_int(this.value())){
                return ts.error(messageRegistry.FACET_REQUIRE_INTEGER,
                    this,{ facetName: this.facetName()},ts.Status.ERROR,true);
            }
        }
        if (this.value()<this.minValue()){
            return ts.error(messageRegistry.MIN_VALUE,this,{
                facetName: this.facetName(),
                minValue: this.minValue()
            },ts.Status.ERROR,true);
        }
    }

    composeWith(t:ts.Constraint):ts.Constraint{
        if (t instanceof MinMaxRestriction) {
            var mx = <MinMaxRestriction>t;
            if (mx.facetName() == this.facetName()) {
                if (mx.isMax() == this.isMax()) {
                    if (this.isMax()){
                        if (this.value()<mx.value()){
                            return mx;
                        }
                        else{
                            return this;
                        }
                    }
                    else{
                        if (this.value()>mx.value()){
                            return mx;
                        }
                        else{
                            return this;
                        }
                    }
                }
            }
            if (mx.facetName()===this._opposite){
                if (this.isMax()) {
                    if (mx.value() > this.value()) {
                        return this.nothing(t);
                    }
                }
                else{
                    if (mx.value() < this.value()) {
                        return this.nothing(t);
                    }
                }
            }
        }
        return null;
    }

    abstract textMessagePart():string;

    facetPath():string{
        var arr:string[] = [this.facetName()];
        var owner = this._owner;
        if(owner != null){
            if (owner instanceof ts.InheritedType) {
                var it = <ts.InheritedType>owner;
                arr = ts.typePath(it).concat(arr);
            }
        }
        return arr.join(".");
    }

    toString(){
        return `'${this.facetPath()}=${this.value()}' i.e. ${this.textMessagePart()} ${this.value()}`;
    }

    conflictMessage(otherPath:string, otherValue:any):string{
        var arr = this.isMax() ? ["less", "higher"] : ["higher", "less"];
        return `['${this.facetPath()}=${this.value()}' is ${arr[0]} than '${otherPath}=${otherValue}'. The ${this._opposite} cannot be ${arr[1]} than the ${this.facetName()}.]`
    }
}

export class MultipleOf extends FacetRestriction<Number>{

    constructor(private _value:number){
        super()
    }
    value(){
        return this._value;
    }
    check(o:any):ts.Status{
        if (typeof  o=='number'){
            var q=o/this.value();
            if (!is_int(q)){
                return ts.error(messageRegistry.EVEN_RATIO, this, { val1: o, val2 : this.value() });
            }
        }
        return ts.ok();
    }

    composeWith(t:ts.Constraint):ts.Constraint{
        return null;
    }
    facetName(){
        return "multipleOf"
    }

    checkValue():ts.Status{
        if (typeof this._value !="number"){
            return ts.error(messageRegistry.FACET_REQUIRE_NUMBER,
                this,{ facetName: this.facetName()},ts.Status.ERROR,true);
        }
        return null;
    }


    requiredType():ts.AbstractType{
        return ts.NUMBER;
    }
}
/**
 * maximum  constraint
 */
export class Maximum extends  MinMaxRestriction{
    constructor(val: number){
        super("maximum",val,true,"minimum",ts.NUMBER,false);
    }


    extractValue(i:any):number {
        return i;
    }

    textMessagePart():string{
        return "value should not be more than";
    }
}
/**
 * minimum constraint
 */
export class Minimum extends  MinMaxRestriction{
    constructor(val: number){
        super("minimum",val,false,"maximum",ts.NUMBER,false);
    }


    extractValue(i:any):number {
        return i;
    }

    textMessagePart():string{
        return "value should not be less than";
    }
}
/**
 * max items cosntraint
 */
export class MaxItems extends  MinMaxRestriction{
    constructor(val: number){
        super("maxItems",val,true,"minItems",ts.ARRAY,true);
    }


    extractValue(i:any):number {
        if (Array.isArray(i)) {
            return i.length;
        }
    }

    textMessagePart():string{
        return "array items count should not be more than";
    }
}
/**
 * min items cosntraint
 */
export class MinItems extends  MinMaxRestriction{
    constructor(val: number){
        super("minItems",val,false,"maxItems",ts.ARRAY,true);
    }


    extractValue(i:any):number {
        if (Array.isArray(i)) {
            return i.length;
        }
    }

    textMessagePart():string{
        return "array items count should not be less than";
    }
}
/**
 * max length
 */
export class MaxLength extends  MinMaxRestriction{
    constructor(val: number){
        super("maxLength",val,true,"minLength",new ts.UnionType("string and file",[ts.STRING,ts.FILE]),true);
    }


    extractValue(i:any):number {
        if (typeof i=='string') {
            return i.length;
        }
        return 0;
    }

    textMessagePart():string{
        return "string length should not be more than";
    }
}

/**
 * min length
 */
export class MinLength extends  MinMaxRestriction{
    constructor(val: number){
        super("minLength",val,false,"maxLength",new ts.UnionType("string and file",[ts.STRING,ts.FILE]),true);
    }

    extractValue(i:any):number {
        if (typeof i=='string') {
            return i.length;
        }
        return 0;
    }

    textMessagePart():string{
        return "string length should not be less than";
    }
}
/**
 * max properties constraint
 */
export class MaxProperties extends  MinMaxRestriction{
    constructor(val: number){
        super("maxProperties",val,true,"minProperties",ts.OBJECT,true);
    }


    extractValue(i:any):number {
        return Object.keys(i).length;
    }

    textMessagePart():string{
        return "object properties count should not be more than";
    }
}
/**
 * min properties constraint
 */
export class MinProperties extends  MinMaxRestriction{
    constructor(val: number){
        super("minProperties",val,false,"maxProperties",ts.OBJECT,true);
    }


    extractValue(i:any):number {
        return Object.keys(i).length;
    }

    textMessagePart():string{
        return "object properties count should not be less than";
    }
}
/**
 * unique items constraint
 */
export class UniqueItems extends FacetRestriction<boolean>{

    constructor(private _value:boolean){
        super();
    }
    facetName(){return "uniqueItems"}
    requiredType(){return ts.ARRAY}

    check(i:any):ts.Status{
        if(!this._value) {
            return ts.ok();
        }
        
        if (Array.isArray(i)){
            var r:any[]=i;
            if (_.unique(r).length!= r.length){
                return ts.error(messageRegistry.MUST_BE_UNIQUE,this);
            }
        }
        return ts.ok()
    }
    
    composeWith(r:ts.Constraint):ts.Constraint{
        if (r instanceof UniqueItems){
            var mm:UniqueItems=r;
            if (mm._value==this._value){
                return this;
            }
        }
        return null;
    }

    value(){
        return this._value;
    }
    checkValue():ts.Status{
        if(typeof(this._value) != "boolean" ){
            return ts.error(messageRegistry.UNIQUE_ITEMS_BOOLEAN,this);
        }
        return null;
    }
    toString(){
        return "items should be unique";
    }
}
/**
 * components of array should be of type
 */
export class ComponentShouldBeOfType extends FacetRestriction<ts.AbstractType>{
    facetName(){return "items"}
    requiredType(){return ts.ARRAY}

    constructor(private type:ts.AbstractType){
        super();
    }

    public toString() {
        return "items should be of type " + this.type;
    }
    check(i:any):ts.Status{

        var rs=new ts.Status(ts.Status.OK,"","",this);
        if (Array.isArray(i)){
            var ar:any[]=i;
            for (var j=0;j<ar.length;j++){
                var ss=this.type.validate(ar[j],false,false);
                if (!ss.isOk()){
                    var t=this.type;
                    if (t.isUnknown()|| t.isRecurrent()){
                        var s=ts.error(messageRegistry.ARRAY_AGAINST_UNKNOWN,
                            this,{typeName:t.name()});
                        return s;
                    }
                }
                ts.setValidationPath(ss,{ name:""+j});
                rs.addSubStatus(ss);
            }
        }
        return rs;
    }
    validateSelf(registry:ts.TypeRegistry):ts.Status {
        var st = super.validateSelf(registry);
        if (this.type.isAnonymous()) {
            var typeStatus = this.type.validateType(registry);
            if (!typeStatus.isOk()) {
                st.addSubStatus(ts.error(messageRegistry.INVALID_COMPONENT_TYPE,
                    this,{msg: st.getMessage()}));
            }
            return st;
        }
        if (this.type.isExternal()){
            st.addSubStatus(ts.error(messageRegistry.EXTERNAL_AS_COMPONENT,this));
        }
        else if (this.type.isSubTypeOf(ts.UNKNOWN) || this.type.isSubTypeOf(ts.RECURRENT)) {
            st.addSubStatus(ts.error(messageRegistry.UNKNOWN_AS_COMPONENT,this,{ typeName: this.type.name()}));
        }
        else if (this.type.isUnion()) {
            var ui = _.find(this.type.typeFamily(), x=>x.isSubTypeOf(ts.UNKNOWN));
            if (ui) {
                st.addSubStatus(
                    ts.error(messageRegistry.UNKNOWN_AS_COMPONENT,this,{ typeName: ui.name()}));
            }
        }
        return st;
    }
    composeWith(t:ts.Constraint):ts.Constraint{
        if (t instanceof ComponentShouldBeOfType){
            var pi:ComponentShouldBeOfType=t;

                if (this.type.typeFamily().indexOf(pi.type)!=-1){
                    return pi;
                }
                if (pi.type.typeFamily().indexOf(this.type)!=-1){
                    return this;
                }
                var intersectionType = this.intersect(this.type, pi.type);
                try {
                    var is:ts.Status = intersectionType.checkConfluent();
                    if (!is.isOk()) {
                        var rc=<ts.RestrictionsConflict>is;
                        return rc.toRestriction();
                    }
                    return new ComponentShouldBeOfType( intersectionType);
                }finally {
                    this.release(intersectionType);
                }

        }
        return null;
    }
    checkValue():ts.Status{
        return null;
    }

    value(){
        return this.type;
    }


}
/**
 * regular expression (pattern) constraint
 */
export class Pattern extends FacetRestriction<string>{

    constructor(private _value:string){
        super();
    }
    facetName(){return "pattern"}
    requiredType(){return ts.STRING}

    check(i:any):ts.Status{
        if (typeof i=='string'){
            var st:string=i;
            try {
                var matches=st.match(this._value);
                var gotMatch = false;
                if (matches){
                    for(var m of matches){
                        if(m.length == st.length){
                            gotMatch = true;
                            break;
                        }
                    }
                }
                if(!gotMatch){
                    return ts.error(messageRegistry.PATTERN_VIOLATION,
                        this,{value:this.value()});
                }
            }catch (e){

            }
        }
        return ts.ok()
    }


    composeWith(r:ts.Constraint):ts.Constraint{
        if (r instanceof Pattern){
            var v=<Pattern>r;
            if (v._value===this._value){
                return this;
            }
            return  this.nothing(r,"pattern restrictions can not be composed at one type");
        }
        return null;
    }

    value(){
        return this._value;
    }
    checkValue():ts.Status{
        try{
            new RegExp(this._value);
        }
        catch (e){
            return ts.error(messageRegistry.INVALID_REGEXP,
                this,{msg: e.message},ts.Status.ERROR,true);
        }
        return null;
    }
    toString(){
        return "should pass reg exp:"+this.value;
    }
}

export class FileTypes extends FacetRestriction<string[]>{

    constructor(private _value:string[]){
        super();
    }
    facetName(){return "fileTypes"}
    requiredType(){return ts.FILE}

    check(i:any):ts.Status{
        if (!Array.isArray(i)) {
            return ts.error(messageRegistry.FILE_TYPES_SHOULD_BE_AN_ARRAY,this);
        }
        for(var s of i){
            if(typeof(s) != "string"){
                return ts.error(messageRegistry.FILE_TYPES_SHOULD_BE_AN_ARRAY,this);
            }
        }
        return ts.ok()
    }


    composeWith(r:ts.Constraint):ts.Constraint{
        if (r instanceof FileTypes){
            var v=<FileTypes>r;
            var arr = _.intersection(this._value, v._value);
            if(arr.length>0){
                return new FileTypes(arr);
            }
            return this.nothing(r,"no common file types");
        }
        return null;
    }

    value(){
        return this._value;
    }
    checkValue():ts.Status{
        return ts.ok();
    }
    toString(){
        return "supported file types: " + this._value.join(", ");
    }
}


/**
 * regular expression (pattern) constraint
 */
export class Format extends FacetRestriction<string>{

    constructor(private _value:string){
        super();
    }
    facetName(){return "format"}

    requiredType(){
        return ts.SCALAR
    }

    requiredTypes() {
        return [ts.NUMBER, ts.INTEGER, ts.DATETIME];
    }

    check(i:any):ts.Status{
        return ts.ok()
    }

    composeWith(r:ts.Constraint):ts.Constraint{
        if (r instanceof Format){
            var v=<Format>r;
            if (v._value===this._value){
                return this;
            }
            return  this.nothing(r,"Format restrictions can not be composed at one type");
        }
        return null;
    }

    value(){
        return this._value;
    }
    checkValue():ts.Status{
        try{
            var allowedValues : string[] = [];

            if (this.owner().isSubTypeOf(ts.INTEGER)) {
                allowedValues = ["int32", "int64", "int", "int16", "int8"];
            } else if (this.owner().isSubTypeOf(ts.NUMBER)) {
                allowedValues = ["int32", "int64", "int", "long", "float", "double", "int16", "int8"];
            } else if (this.owner().isSubTypeOf(ts.DATETIME)) {
                allowedValues = ["rfc3339", "rfc2616"];
            } else return null;

            var found = _.find(allowedValues, allowedValue=>allowedValue==this.value());
            if (!found) {
                return ts.error(messageRegistry.ALLOWED_FORMAT_VALUES,this,{
                    allowedValues : allowedValues.map(x=>`'${x}'`).join(", ")
                }, ts.Status.ERROR, true);
            }
        }
        catch (e){
            return new Status(Status.ERROR, "", e.message,this);
        }
        return null;
    }
    toString(){
        return "should have format:"+this.value;
    }
}
/**
 * enum constraint
 */
export class Enum extends FacetRestriction<string[]>{

    constructor(private _value:string[]){
        super();
    }
    facetName(){return "enum"}
    requiredType(){return ts.SCALAR}


    checkStatus:boolean
    check(i:any):ts.Status{
        if (!this.checkStatus) {
            var opts = this.value();
            if (!Array.isArray(opts)){
                opts=[<string><any>opts];
            }
            if (!opts.some(x=>x == i)) {
                var valStr = Array.isArray(this._value) ? this._value.map(x=>`'${x}'`).join(", ") : `'${this._value}'`;
                return ts.error(messageRegistry.ENUM_RESTRICTION,this, {values: valStr});
            }
        }
        return ts.ok()
    }


    composeWith(r:ts.Constraint):ts.Constraint{
        if (r instanceof Enum){
            var v=<Enum>r;
            var sss= _.intersection(this._value, v._value);
            if (sss.length==0){
                return this.nothing(r);
            }
            return new Enum(sss);
        }
        return null;
    }

    value(){
        return this._value;
    }
    checkValue():ts.Status{
        if (!this.owner().isSubTypeOf(this.requiredType())){
            return ts.error(messageRegistry.ENUM_OWNER_TYPES,this,{
                typeNames : this.requiredType().name()
            }, ts.Status.ERROR, true);
        }
        if (this.requiredTypes() && this.requiredTypes().length > 0) {
            var owner = this.owner();
            var requiredSuperType = _.find(this.requiredTypes(), requiredType=>owner.isSubTypeOf(requiredType));
            if (!requiredSuperType) {
                var typeNames = "[" + this.requiredTypes().map(requiredType=>`'${requiredType.name()}'`).join(", ") + "]";
                return ts.error(messageRegistry.ENUM_OWNER_TYPES,this,{
                    typeNames : typeNames
                }, ts.Status.ERROR, true);
            }
        }
        if(!Array.isArray(this._value)){
            return ts.error(messageRegistry.ENUM_ARRAY,this,{}, ts.Status.ERROR, true);
        }
        // if (_.uniq(this._value).length<this._value.length){
        //     return "enum facet can only contain unique items";
        // }
        var result:ts.Status=null;
        this.checkStatus=true;
        try {
            this._value.forEach(x=> {
                var res = this.owner().validate(x);
                if (!res.isOk()) {
                    result= res;
                }
            })
        }finally {
            this.checkStatus=false;
        }
        return result;
    }
    toString(){
        var valStr = Array.isArray(this._value) ? this._value.map(x=>`'${x}'`).join(", ") : `'${this._value}'`;
        return "value should be one of: " + valStr;
    }
}
/**
 * this function attempts to optimize to set of restrictions
 * @param r
 * @returns {ts.Constraint[]}
 */
export function optimize(r:ts.Constraint[]){
    r= r.map(x=>x.preoptimize());
    var optimized:ts.Constraint[]=[];
    r.forEach(x=>{
        if (x instanceof  AndRestriction){
            var ar:AndRestriction=x;
            ar.options().forEach(y=>{optimized.push(y)})
        }
        else{
            optimized.push(x);
        }
    })
    var transformed=true;
    while (transformed){
        transformed=false;
        for (var i=0;i<optimized.length;i++){
            for (var j=0;j<optimized.length;j++){
                var rs0=optimized[i];
                var rs1=optimized[j];
                if (rs0!==rs1){
                    var compose=rs0.tryCompose(rs1);
                    if (compose) {
                        var newOptimized = optimized.filter(x=>x !== rs0 && x !== rs1);
                        newOptimized.push(compose);
                        transformed = true;
                        optimized = newOptimized;
                        break;
                    }
                }
            }
            if (transformed){
                break;
            }
        }
    }
    return optimized;
}

function actualUnknownType(t:AbstractType):AbstractType{
    
    if(!t.isSubTypeOf(ts.UNKNOWN)){
        return null;
    }
    if(t.name()!=null){
        return t;
    }
    for(var st of t.superTypes()){
        var ust = actualUnknownType(st);
        if(ust!=null){
            return ust;
        }
    }
    return t;
}