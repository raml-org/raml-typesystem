/// <reference path="../typings/main.d.ts" />
import _=require("underscore")

export class Status {

    public static CODE_CONFLICTING_TYPE_KIND = 4;

    public static ERROR = 3;

    public static INFO = 1;


    public static OK = 0;

    public static WARNING = 2;

    protected code:number;
    protected message: string;
    protected severity:number;
    protected source:any;

    protected subStatus:Status[] = [];

    public constructor(severity:number, code:number, message:string) {
        this.severity = severity;
        this.code = code;
        this.message = message;
    }

    addSubStatus(st:Status) {
        this.subStatus.push(st);
        if (this.severity < st.severity) {
            this.severity = st.severity;
            this.message = st.message;
        }
    }
    getMessage() {
        return this.message;
    }
    getSource(){
        return this.source;
    }
    isOk(){
        return this.severity===Status.OK;
    }
    setSource(s:any){
        this.source=s;
    }
    toString():string{
        if (this.isOk()){
            return "OK";
        }
        return this.message;
    }
}
export const OK_STATUS=new Status(Status.OK,Status.OK,"");

export function error(message:string){
    return new Status(Status.ERROR,0,message);
}

export abstract class TypeInformation{

    constructor(private _inheritable:boolean){}

    _owner:AbstractType;

    owner():AbstractType{
        return this._owner;
    }

    isInheritable(){
        return this._inheritable;
    }

    validateSelf(registry:TypeRegistry):Status{
        return OK_STATUS;
    }
    abstract facetName():string
    abstract requiredType():AbstractType
}
var stack:RestrictionStackEntry=null;

export abstract class Constraint extends TypeInformation{
    constructor(){super(true)}



    abstract check(i:any):Status


    nothing(c:Constraint,message:string="Conflicting restrictions"):NothingRestrictionWithLocation{
        return new NothingRestrictionWithLocation(stack,message,c);
    }
    /**
     * inner implementation of  compute composed restriction from this and parameter restriction
     * @param restriction
     * @return  composed restriction or null;
     */
    composeWith(r: Constraint):Constraint {return null;}


    /**
     * returns optimized restiction or this
     * @returns {Constraint}
     */
    preoptimize():Constraint{
        if (stack===null){
            stack=new RestrictionStackEntry(null,null,"top");
        }
        stack=stack.push(this);
        try{
            return this.innerOptimize();
        }finally {
            stack=stack.pop();
        }
    }

    protected innerOptimize():Constraint{
        return this;
    }
    /**
     * performs attempt to compute composed restriction from this and parameter restriction
     * @param restriction
     * @return  composed restriction or null;
     */
    tryCompose(r: Constraint):Constraint{
        if (stack===null){
            stack=new RestrictionStackEntry(null,null,"top");
        }
        stack=stack.push(this);
        try{
            return this.composeWith(r);
        }finally {
            stack=stack.pop();
        }
    }
}


import restr=require("./restrictions")
import {KnownPropertyRestriction} from "./restrictions";

/**
 * Registry of the types
 */
export class TypeRegistry{
  private types:{[name:string]: AbstractType}={};

  private typeList:AbstractType[]=[]



  addType(t:AbstractType){
     this.types[t.name()]=t;
     this.typeList.push(t);
  }

  get(name: string ):AbstractType{
      if (this.types.hasOwnProperty(name)){
          return this.types[name];
      }
      if (this._parent!=null){
          return this._parent.get(name);
      }
      return null;
  }

  constructor(private _parent:TypeRegistry=null){

  }

    allTypes(){
        return this.typeList;
    }
}

export class RestrictionsConflict extends Status{
    constructor(protected _conflicting:Constraint,protected _stack:RestrictionStackEntry){
        super(Status.ERROR,0,"Restrictions conflict");
    }
    getConflictDescription():string{
        var rs="";
        rs+="Restrictions coflict:\n";
        rs+=this._stack.getRestriction()+" conflicts with "+this._conflicting+"\n";
        rs+="at\n";
        rs+=this._stack.pop();
        return rs;
    }

    getConflicting():Constraint{
        return this._conflicting;
    }

    getStack():RestrictionStackEntry{
        return this._stack;
    }
    toRestriction(){
        return new NothingRestrictionWithLocation(this._stack,this.message,this._conflicting);
    }
}

export abstract class AbstractType{

    protected computeConfluent: boolean

    protected metaInfo: TypeInformation[]=[];

    _subTypes: AbstractType[]=[]

    abstract kind():string;

    protected _locked:boolean=false;

    lock(){
        this._locked=true;
    }

    isLocked(){
        return this._locked;
    }

    constructor(protected _name:string){

    }

    isSubTypeOf(t:AbstractType):boolean{
        return this===t|| this.allSuperTypes().indexOf(t)!=-1
    }
    isSuperTypeOf(t:AbstractType):boolean{
        return this===t|| this.allSubTypes().indexOf(t)!=-1
    }
    public addMeta(info:TypeInformation){
        this.metaInfo.push(info);
        info._owner=this;
    }

    name(){
        return this._name;
    }

    /**
     * @return directly known sub types of a given type
     */
    subTypes():AbstractType[]{
        return this._subTypes;
    }
    /**
     * @return directly known super types of a given type
     */
    superTypes():AbstractType[]{
        return [];
    }


    public allSuperTypes():AbstractType[]{
        var rs:AbstractType[]=[];
        this.fillSuperTypes(rs);
        return rs;
    }
    private fillSuperTypes(r:AbstractType[]){
        this.superTypes().forEach(x=>{
            if (!_.contains(r,x)) {
                r.push(x);
                x.fillSuperTypes(r);
            }
        })
    }
    public allSubTypes():AbstractType[]{
        var rs:AbstractType[]=[];
        this.fillSubTypes(rs);
        return rs;
    }
    private fillSubTypes(r:AbstractType[]){
        this.subTypes().forEach(x=>{
            if (!_.contains(r,x)) {
                r.push(x);
                x.fillSubTypes(r);
            }
        })
    }

    public inherit(name: string): InheritedType{
        var rs=new InheritedType(name);
        rs.addSuper(this);
        return rs;
    }
    /**
     *
     * @return true if type is an inplace type and has no name
     */
    isAnonymous():boolean{
        return this.name===null||this.name.length==0;
    }
    /**
     *
     * @return true if type has no associated meta information of restrictions
     */
    isEmpty():boolean{
        return this.metaInfo.length===0;
    }

    /**
     *
     * @return true if type is an array or extends from an array
     */
    isArray():boolean{
        return this===<AbstractType>ARRAY||this.allSuperTypes().indexOf(ARRAY)!=-1;
    }


    checkConfluent():Status{
        if (this.computeConfluent){
            return OK_STATUS;
        }
        this.computeConfluent=true;
        try {
            var os = restr.optimize(this.restrictions());
            var ns=_.find(os,x=>x instanceof NothingRestriction);
            if (ns){
                var lstack:RestrictionStackEntry=null;
                var another:Constraint=null;
                if (ns instanceof NothingRestrictionWithLocation){
                    var nswl:NothingRestrictionWithLocation=ns;
                    lstack=nswl.getStack();
                    another=nswl.another();
                }
                var status=new RestrictionsConflict(another,lstack);
                return status;
            }
            return OK_STATUS;
        }finally {
            this.computeConfluent=false;
        }
    }
    /**
     *
     * @return true if type is object or inherited from object
     */
    isObject():boolean{
        return this==<AbstractType>OBJECT||this.allSuperTypes().indexOf(OBJECT)!=-1;
    }


    /**
     *
     * @return true if type is an boolean type or extends from boolean
     */
    isBoolean():boolean{
        return this==<AbstractType>BOOLEAN||this.allSuperTypes().indexOf(BOOLEAN)!=-1;
    }

    /**
     *
     * @return true if type is string or inherited from string
     */
    isString():boolean{
        return this==<AbstractType>STRING||this.allSuperTypes().indexOf(STRING)!=-1;
    }

    /**
     *
     * @return true if type is number or inherited from number
     */
    isNumber():boolean{
        return this==<AbstractType>NUMBER||this.allSuperTypes().indexOf(NUMBER)!=-1;
    }

    /**
     *
     * @return true if type is scalar or inherited from scalar
     */
    isScalar():boolean{
        return this==<AbstractType>SCALAR||this.allSuperTypes().indexOf(SCALAR)!=-1;
    }

    /**
     *
     * @return true if type is an built-in type
     */
    isBuiltin():boolean{
        return this.metaInfo.indexOf(BUILT_IN)!=-1;
    }

    /**
     *
     * @return true if type is an polymorphic type
     */
    isPolymorphic():boolean{
        return this.metaInfo.some(x=>x instanceof Polymorphic)!=null;
    }

    /**
     * @return all restrictions associated with type
     */
    restrictions():Constraint[]{
        return <Constraint[]>this.meta().filter(x=>x instanceof Constraint);
    }

    isUnion():boolean{
        var rs=false;
        this.superTypes().forEach(x=>rs=rs|| x.isUnion());
        return rs;
    }

    /**
     * return all type information associated with type
     */
    meta():TypeInformation[]{
        return [].concat(this.metaInfo);
    }
    /**
     * validates object against this type without performing AC
     */
    validateDirect(i:any):Status{
        var result=new Status(Status.OK,0,"");
        this.restrictions().forEach(x=>result.addSubStatus(x.check(i)));
        return  result;
    }
    validate(i:any):Status{
        return this.ac(i).validateDirect(i);
    }


    /**
     * declares a pattern property on this type,
     * note if type is not inherited from an object type this will move
     * type to inconsistent state
     * @param name - regexp
     * @param type - type of the property
     * @return
     */
    declareMapProperty( name:string, type: AbstractType) {
        if (type != null) {
            this.addMeta(new restr.MapPropertyIs( name,type));
        }
        return type;
    }

    /**
     * make this type closed type (no unknown properties any more)
     */
    closeUnknownProperties(){
        this.addMeta(new KnownPropertyRestriction())
    }

    /**
     * performs automatic classification of the instance
     * @param obj
     * @returns {AbstractType}
     */
    ac(obj:any):AbstractType{
        if (!this.isPolymorphic()&&!this.isUnion()){
            return this;
        }
        var tf:AbstractType[]=this.typeFamily();
        if(tf.length==0){
            return NOTHING;
        }
        if (this.isScalar()) {
            if (this.isNumber()) {
                if (typeof obj =="number") {
                    return this;
                }
                return NOTHING;
            }

            if (this.isString()) {
                if (typeof obj =="string") {
                    return this;
                }
                return NOTHING;
            }

            if (this.isBoolean()) {
                if (typeof obj =="boolean") {
                    return this;
                }
                return NOTHING;
            }
            return this;
        }
        if (tf.length===1){
            return tf[0];
        }
        var options:AbstractType[]=[];
        tf.forEach(x=>{
            if (x.validateDirect(obj).isOk()){
                options.push(x);
            }
        })
        var t= this.discriminate(obj,options);
        if (!t){
            return NOTHING;
        }
        return t;
    }
    /**
     * adds new property declaration to this type, note if type is not inherited from an object type this will move
     * type to inconsistent state
     * @param name - name of the property
     * @param type - type of the property
     * @param optional true if property is optinal
     * @return the type with property (this)
     */
    declareProperty(name:string , t:AbstractType,optional: boolean):AbstractType{
        if (!optional){
            this.addMeta(new restr.HasProperty(name));
        }
        if (t!=null){
            this.addMeta(new restr.PropertyIs(name,t));
        }
        return this;
    }

    private discriminate(obj:any, opt:AbstractType[]):AbstractType{
        var newOpts:AbstractType[]=[].concat(opt);
        var opts:AbstractType[]=[].concat(opt);
        while (newOpts.length>1){
            var found=false;
            l2: for (var i=0;i<opts.length;i++){
                for (var j=0;j<opts.length;j++){
                    var t0=opts[i];
                    var t1=opts[j];
                    if (t0!=t1){
                        var nt=select(obj,t0,t1);
                        if (nt===t0){
                            opts=opts.filter(x=>x!=t1);
                            found=true;
                            break l2;
                        }
                        else if (nt===t1){
                            opts=opts.filter(x=>x!=t0);
                            found=true;
                            break l2;
                        }
                        else{
                            opts=opts.filter(x=>x!=t0&&x!=t1);
                            found=true;
                            break l2;
                        }
                    }
                }
            }
            newOpts=opts;
        }
        if (newOpts.length==1){
            return newOpts[0];
        }
        return null;
    }

    /**
     * return instance of type information of particular class
     * @param clazz
     * @returns {any}
     */
    oneMeta<T>(clazz:{ new(v:any):T } ):T{
        return <T>_.find(<any>this.meta(),x=>x instanceof clazz);
    }

    /**
     * return all instances of meta information of particular class
     * @param clazz
     * @returns {any}
     */
    metaOfType<T>(clazz:{ new(v:any):T } ):T[]{
        return <any>this.meta().filter(x=>x instanceof clazz);
    }


    descValue():any{
        var dv=this.oneMeta(DiscriminatorValue);
        if (dv){
            return dv.value;
        }
        return this.name();
    }

    isAbstractOrInternal():boolean{
        return this.metaInfo.some(x=>x instanceof Abstract||x instanceof Internal)
    }

    public  typeFamily():AbstractType[] {
        if (this.isUnion()){
            this.allSuperTypes().forEach(x=>{
                if (x instanceof UnionType){
                    var opts=x.allOptions();
                    var rs:AbstractType[]=[];
                    for (var i=0;i<opts.length;i++){
                        rs=rs.concat(opts[i].typeFamily());
                    }
                    return _.unique(rs);
                }
            })
        }
        var rs:AbstractType[]=[];
        if (!this.isAbstractOrInternal()){
            rs.push(this);
        }
        this.allSubTypes().forEach(x=>{
            if (!x.isAbstractOrInternal()){
                rs.push(x);
            }
        })
        return _.unique(rs);
    }
}
export class Discriminator extends TypeInformation{

    constructor(public property: string){
        super(true);
    }

    requiredType(){
        return OBJECT;
    }

    facetName(){return "discriminator"}
}

export class DiscriminatorValue extends TypeInformation{
    constructor(public value: string){
        super(false);
    }
    facetName(){return "discriminatorValue"}

    requiredType(){
        return OBJECT;
    }
}
abstract class Modifier extends TypeInformation{

    requiredType(){
        return ANY;
    }
}
export class Polymorphic extends Modifier{

    constructor(){super(true)}
    facetName(){
        return "polymorhic";
    }
}
export class Abstract extends Modifier{

    constructor(){super(false)}

    facetName(){
        return "abstract"
    }
}
export class Internal extends Modifier{
    constructor(){super(false)}


    facetName(){
        return "abstract"
    }
}

class BuiltIn extends Modifier{

    constructor(){super(false)}

    facetName(){
        return "builtIn"
    }
}

const BUILT_IN=new BuiltIn();


export class RootType extends AbstractType{

    kind(){
        return "root";
    }
}

export class InheritedType extends AbstractType{

    protected _superTypes: AbstractType[]=[]

    superTypes(){
        return this._superTypes;
    }

    kind(){
        return "inherited"
    }
    meta():TypeInformation[]{
        var rs=super.meta();
        this.superTypes().forEach(x=>{
            x.meta().forEach(m=>{
                if (m.isInheritable()){
                    rs.push(m);
                }
            })
        })
        return rs;
    }

    addSuper(t: AbstractType){
        this._superTypes.push(t);
        if (!t.isLocked()) {
            t._subTypes.push(this);
        }
    }

}
export abstract class DerivedType extends AbstractType{

    constructor(name: string,private _options:AbstractType[]){
        super(name);
    }

    /**
     *
     * @returns all possible options
     */
    allOptions():AbstractType[]{
        var rs:AbstractType[]=[];
        this._options.forEach(x=>{
            if (x.kind()==this.kind()){
                rs=rs.concat((<DerivedType>x).allOptions());
            }
            else{
                rs.push(x);
            }
        });
        return _.unique(rs);
    }

}
export class UnionType extends DerivedType{

    kind(){
        return "union"
    }


    public typeFamily():AbstractType[] {
        var res:AbstractType[]=[];
        this.allOptions().forEach(x=>{
            res=res.concat(x.typeFamily());
        });
        return res;
    }

    isUnion(){
        return true;
    }

    restrictions(){
        return [new OrRestriction(this.allOptions().map(x=>new AndRestriction(x.restrictions())))]
    }
}
export class IntersectionType extends DerivedType{

    kind(){
        return "intersection";
    }

    restrictions(){
        var rs:Constraint[]=[];
        this.allOptions().forEach(x=>rs=rs.concat(x.restrictions()));
        return [new AndRestriction(rs)]
    }
}

const registry=new TypeRegistry();
export function builtInRegistry():TypeRegistry{
    return registry;
}


export function union(name:string, t:AbstractType[]):UnionType{
    return new UnionType(name,t);
}
export function intersect(name:string, t:AbstractType[]):IntersectionType{
    return new IntersectionType(name,t);
}
/**
 * allows you to extend a type from other types
 * @param name
 * @param t
 * @returns {InheritedType}
 */
export function derive(name: string,t:AbstractType[]):InheritedType{
    var r=new InheritedType(name);
    t.forEach(x=>r.addSuper(x));
    return r;
}
/**
 * this function allows you to quickly derive a new type from object;
 * @param name
 * @returns {InheritedType}
 */
export function deriveObjectType(name: string):InheritedType{
    return derive(name,[OBJECT]);
}


function select(obj:any,t0:AbstractType,t1:AbstractType):AbstractType{
    if (t0.isScalar()&&t1.isScalar()){
        if (t0.allSubTypes().indexOf(t1)!=-1){
            return t0;
        }
        if (t1.allSubTypes().indexOf(t0)!=-1){
            return t1;
        }
    }
    var d0=t0.oneMeta(Discriminator);
    var d1=t1.oneMeta(Discriminator);
    if (d0&&d1){
        if (d0.property===d1.property){
            var v0=t0.descValue();
            var v1=t1.descValue();
            if (v0!==v1){
                var val=obj[d0.property];
                if (val===v0){
                    return t0;
                }
                if (val===v1){
                    return t1;
                }
            }
        }
    }
    return null;
}

export class NothingRestriction extends Constraint{
    check(i:any):Status {
        if (i===null||i===undefined){
            return OK_STATUS;
        }
        return error("nothing ");
    }


    requiredType(){
        return ANY;
    }

    facetName(){
        return "nothing";
    }

}
export class RestrictionStackEntry{

    constructor(private _previous:RestrictionStackEntry,private _restriction:Constraint,private id:string){

    }

    getRestriction(){return this._restriction}

    pop(){return this._previous;}

    push(r:Constraint){
        return new RestrictionStackEntry(this,r, r.toString());
    }
}
export  class NothingRestrictionWithLocation extends NothingRestriction{


    constructor(private _entry:RestrictionStackEntry,private _message:string,private _another:Constraint){
        super();
    }
    getMessage(){return this._message;}

    getStack(){return this._entry;}

    another(){return this._another;}
}

export class TypeOfRestriction extends Constraint{

    constructor(private val: string){
        super();
    }
    check(i:any):Status {
        var to=typeof i;
        if (Array.isArray(i)){
            to="array";
        }
        if (to===this.val){
            return OK_STATUS;
        }
        return error("should be "+this.val);
    }


    requiredType(){
        return ANY;
    }

    facetName(){
        return "typeOf"
    }

    composeWith(r:Constraint):Constraint{
        if (r instanceof TypeOfRestriction){
            var to:TypeOfRestriction=r;
            if (to.val==this.val){
                return this;
            }
            return this.nothing(r);
        }
        return null;
    }
}
function is_int(value:any){
    if((parseFloat(value) == parseInt(value)) && !isNaN(value)){
        return true;
    } else {
        return false;
    }
}
export class IntegerRestriction extends Constraint{

    constructor(){
        super();
    }
    check(i:any):Status {
        if (is_int(i)){
            return OK_STATUS;
        }
        return error("should be integer");
    }

    requiredType(){
        return ANY;
    }
    facetName(){
        return "should be integer"
    }
}

export class OrRestriction extends Constraint{

    constructor(private val: Constraint[]){
        super();
    }
    check(i:any):Status {
        for (var j=0;j<this.val.length;j++){
            if (this.val[j].check(i).isOk()){
                return OK_STATUS;
            }
        }
        return error("all options failed");
    }

    requiredType(){
        return ANY;
    }
    facetName(){
        return "or"
    }
}
export class AndRestriction extends Constraint{

    constructor(private val: Constraint[]){
        super();
    }

    options(){
        return this.val;
    }
    check(i:any):Status {
        for (var j=0;j<this.val.length;j++){
            var st=this.val[j].check(i);
            if (!st.isOk()){
                return st;
            }
        }
        return OK_STATUS;
    }
    requiredType(){
        return ANY;
    }

    facetName(){
        return "and";
    }
}
/***
 *
 * lets declare built in types
 */

export const ANY=new RootType("any");
export const SCALAR=ANY.inherit("scalar");
export const OBJECT=ANY.inherit("object");
export const ARRAY=ANY.inherit("array");
export const NUMBER=SCALAR.inherit("number");
export const INTEGER=NUMBER.inherit("integer");
export const BOOLEAN=SCALAR.inherit("boolean");
export const STRING=SCALAR.inherit("string");
export const DATE=SCALAR.inherit("date");
export const FILE=SCALAR.inherit("file");
export const NOTHING=new RootType("nothing");

///

ANY.addMeta(BUILT_IN);
SCALAR.addMeta(BUILT_IN);
OBJECT.addMeta(BUILT_IN);
ARRAY.addMeta(BUILT_IN);
NUMBER.addMeta(BUILT_IN);
INTEGER.addMeta(BUILT_IN);
BOOLEAN.addMeta(BUILT_IN);
STRING.addMeta(BUILT_IN);
DATE.addMeta(BUILT_IN);
FILE.addMeta(BUILT_IN);

///lets register all types in registry

registry.addType(ANY);
registry.addType(SCALAR);
registry.addType(OBJECT);
registry.addType(ARRAY);
registry.addType(NUMBER);
registry.addType(INTEGER);
registry.addType(BOOLEAN);
registry.addType(STRING);
registry.addType(DATE);
registry.addType(FILE);

NOTHING.addMeta(new NothingRestriction());
NUMBER.addMeta(new TypeOfRestriction("number"));
BOOLEAN.addMeta(new TypeOfRestriction("boolean"));
OBJECT.addMeta(new TypeOfRestriction("object"));
ARRAY.addMeta(new TypeOfRestriction("array"));
STRING.addMeta(new TypeOfRestriction("string"));
INTEGER.addMeta(new IntegerRestriction());
DATE.addMeta(new TypeOfRestriction("string"));
FILE.addMeta(new TypeOfRestriction("string"));
SCALAR.addMeta(new OrRestriction([new TypeOfRestriction("string"), new TypeOfRestriction("boolean"), new TypeOfRestriction("number")]));
registry.allTypes().forEach(x=>x.lock())