import _=require("underscore")
import su=require("./schemaUtil")
import tsInterfaces = require("./typesystem-interfaces")

export let messageRegistry = require("../../resources/errorMessages");

export type IValidationPath = tsInterfaces.IValidationPath;

export class Status implements tsInterfaces.IStatus {

    public static CODE_CONFLICTING_TYPE_KIND = 4;

    public static CODE_INCORRECT_DISCRIMINATOR = messageRegistry.INCORRECT_DISCRIMINATOR;

    public static CODE_MISSING_DISCRIMINATOR = messageRegistry.MISSING_DISCRIMINATOR;

    public static ERROR = 3;

    public static INFO = 1;


    public static OK = 0;

    public static WARNING = 2;

    protected code:string;
    protected message: string;
    protected severity:number;
    protected source:any;
    protected filePath:string;

    protected internalRange:tsInterfaces.RangeObject;

    protected subStatus:tsInterfaces.IStatus[] = [];

    protected vp:tsInterfaces.IValidationPath

    protected internalPath:tsInterfaces.IValidationPath

    getValidationPath():tsInterfaces.IValidationPath{
        return this.vp;
    }

    getValidationPathAsString():string{
        if (!this.vp){
            return "";
        }
        var s="";
        var c=this.vp;
        while (c){
            s+= c.name;
            if (c.child){
                s+='/'
            }
            c= c.child
        }
        return s;
    }

    setValidationPath(_c:tsInterfaces.IValidationPath){
        this.vp = _c;
    }

    public constructor(severity:number, code:string, message:string,source:any,private takeNodeFromSource:boolean=false) {
        this.severity = severity;
        this.code = code;
        this.message = message;
        this.source=source;

    }

    addSubStatus(st:tsInterfaces.IStatus,pathName:string=null) {
        if(!st){
            return;
        }
        if (pathName){
            setValidationPath(st,{name: pathName})
        }
        this.subStatus.push(st);
        var otherSeverity = Status.OK;
        if(!st.isOk()) {
            if (st.isError()) {
                otherSeverity = Status.ERROR;
            }
            else if(st.isWarning()){
                otherSeverity = Status.WARNING;
            }
            else if(st.isInfo()){
                otherSeverity = Status.INFO;
            }
        }
        if (this.severity < otherSeverity) {
            this.severity = otherSeverity;
            this.message = st.getMessage();
        }
    }
    getErrors():tsInterfaces.IStatus[]{
        if (this.isError()||this.isWarning()){
            if (this.subStatus.length>0){
                var rs:tsInterfaces.IStatus[]=[];
                this.subStatus.forEach(x=>rs=rs.concat(x.getErrors()));
                return rs;
            }
            return [this];
        }
        return [];
    }

    getSubStatuses():tsInterfaces.IStatus[]{
        return this.subStatus;
    }
    getSeverity(){
        return this.severity;
    }
    getMessage() {
        return this.message;
    }
    setMessage(message:string) {
        this.message = message;
    }
    getSource(){
        return this.source;
    }
    getCode(){
        return this.code;
    }
    setCode(code:string){
        this.code = code;
    }
    isWarning(){
        return this.severity==Status.WARNING;
    }
    isError(){
        return this.severity==Status.ERROR;
    }
    isOk(){
        return this.severity===Status.OK;
    }
    isInfo(){
        return this.severity===Status.INFO;
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

    getExtra(name:string):any{
        if(this.takeNodeFromSource&&name == tsInterfaces.SOURCE_EXTRA) {
            if (this.source instanceof TypeInformation) {
                return this.source.node();
            }
        }
        return null;
    }

    putExtra(name:string,value:any):void{}

    setInternalRange(range:tsInterfaces.RangeObject){
        this.internalRange = range;
    }

    getInternalRange():tsInterfaces.RangeObject{ return this.internalRange }

    getInternalPath():tsInterfaces.IValidationPath{
        return this.internalPath;
    }

    setInternalPath(ip:tsInterfaces.IValidationPath){
        this.internalPath = ip;
    }

    getFilePath():string{
        return this.filePath;
    }

    setFilePath(filePath:string){
        this.filePath = filePath;
    }
}

export function ok(){ return new Status(Status.OK,"","",null)};
export const SCHEMA_AND_TYPE=tsInterfaces.SCHEMA_AND_TYPE_EXTRA;
export const GLOBAL=tsInterfaces.GLOBAL_EXTRA;
export const TOPLEVEL=tsInterfaces.TOP_LEVEL_EXTRA;
export const SOURCE_EXTRA = tsInterfaces.SOURCE_EXTRA;

var messageText = function (messageEntry:any, params:any) {
    var result = "";
    var msg = messageEntry.message;
    var prev = 0;
    for(var ind = msg.indexOf("{{"); ind >= 0 ; ind = msg.indexOf("{{",prev)){
        result += msg.substring(prev,ind);
        prev = msg.indexOf("}}",ind);
        if(prev<0){
            prev = ind;
            break;
        }
        ind += "{{".length;
        var paramName = msg.substring(ind,prev);
        prev += "}}".length;
        var paramValue = params[paramName];
        if(paramValue===undefined){
            throw new Error(messageText(messageRegistry.MESSAGE_PARAMETER_NO_VALUE,{paramName: paramName}));
        }
        result += paramValue;
    }
    result += msg.substring(prev,msg.length);
    return result;
};
export function error(
    messageEntry:any,
    source:any,
    params:any={},
    severity:number = Status.ERROR,
    takeNodeFromSource:boolean=false){

    var message = messageText(messageEntry, params);
    return new Status(severity,messageEntry.code,message,source,takeNodeFromSource);
}

export abstract class TypeInformation implements tsInterfaces.ITypeFacet {

    constructor(private _inheritable:boolean){}

    _owner:AbstractType;

    _node:parse.ParseNode;

    _annotations:tsInterfaces.IAnnotation[] = [];

    private static CLASS_IDENTIFIER_TypeInformation = "typesystem.TypeInformation";

    public getClassIdentifier() : string[] {
        var superIdentifiers:string[] = [];
        return superIdentifiers.concat(TypeInformation.CLASS_IDENTIFIER_TypeInformation);
    }

    public static isInstance(instance: any): instance is TypeInformation {
        return instance != null && instance.getClassIdentifier
            && typeof(instance.getClassIdentifier) == "function"
            && _.contains(instance.getClassIdentifier(), TypeInformation.CLASS_IDENTIFIER_TypeInformation);
    }

    node(){
        return this._node;
    }

    setNode(node:parse.ParseNode){
        this._node = node;
    }

    owner():AbstractType{
        return this._owner;
    }

    isInheritable(){
        return this._inheritable;
    }

    validateSelf(registry:TypeRegistry):Status{
        var result = ok();
        if(this.node()&&this.node().getMeta("skipValidation")){
            return result;
        }
        for(var a of this._annotations){
            var aStatus = <Status>a.validateSelf(registry);
            if(!aStatus.isOk()) {
                result.addSubStatus(aStatus);
            }
        }
        var facetEntry = new AnnotatedFacet(this,registry);
        var aPluginStatuses = applyAnnotationValidationPlugins(facetEntry);
        for(let ps of aPluginStatuses){
            if(!ps.isOk()) {
                result.addSubStatus(ps);
            }
        }
        setValidationPath(result,{name:this.facetName()});
        return this.validateSelfIndividual(result,registry);
    }

    protected validateSelfIndividual(parentStatus:Status,registry:TypeRegistry):Status{
        return parentStatus;
    }

    abstract facetName():string
    abstract value():any;
    abstract requiredType():AbstractType

    /**
     * Extension of requiredType() method for the case when there are more than a single type
     * hierarchy roots to cover.
     * requiredType() should return the common superclass for the list.
     *
     * @returns {Array} of types or empty list of there is only a single type set by requiredType() method
     */
    requiredTypes():AbstractType[] {
        return [];
    }

    abstract kind() : tsInterfaces.MetaInformationKind

    annotations():tsInterfaces.IAnnotation[]{
        return this._annotations;
    }

    addAnnotation(a:tsInterfaces.IAnnotation){
        this._annotations.push(a);
    }

    isConstraint(){
        return false;
    }
}
var stack:RestrictionStackEntry=null;

export abstract class Constraint extends TypeInformation implements tsInterfaces.IConstraint{
    constructor(_inheritable=true){super(_inheritable)}

    private static CLASS_IDENTIFIER_Constraint = "typesystem.TypeInformation";

    public getClassIdentifier() : string[] {
        var superIdentifiers:string[] = super.getClassIdentifier();
        return superIdentifiers.concat(Constraint.CLASS_IDENTIFIER_Constraint);
    }

    public static isInstance(instance: any): instance is Constraint {
        return instance != null && instance.getClassIdentifier
            && typeof(instance.getClassIdentifier) == "function"
            && _.contains(instance.getClassIdentifier(), Constraint.CLASS_IDENTIFIER_Constraint);
    }



    abstract check(i:any,parentPath:tsInterfaces.IValidationPath):Status


    private static intersections:{ [id:string]:AbstractType}={}

    protected intersect(t0: AbstractType,t1:AbstractType):AbstractType{
        var nm=t0.id()+""+t1.id();
        if (Constraint.intersections.hasOwnProperty(nm)){
            return Constraint.intersections[nm];
        }
        var is=intersect(nm,[t0,t1]);
        Constraint.intersections[nm]=is;
        return is;
    }

    protected release(t:AbstractType){
        delete Constraint.intersections[t.name()];
    }

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

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Constraint;
    }

    conflictMessage(otherPath:string, otherValue:any):string{ return null; }

    isConstraint(){
        return true;
    }
}


import restr=require("./restrictions")
import metaInfo=require("./metainfo")
import fr=require("./facetRegistry")

import {KnownPropertyRestriction} from "./restrictions";
import {FacetDeclaration} from "./metainfo";
import {CustomFacet} from "./metainfo";
import {PropertyIs} from "./restrictions";
import {ComponentShouldBeOfType} from "./restrictions";
import exO=require("./exampleBuilder")
import {NotScalar} from "./metainfo";
import {MapPropertyIs} from "./restrictions";
import {MatchesProperty} from "./restrictions";

export var autoCloseFlag=false;
/**
 * Registry of the types
 */
export class TypeRegistry implements tsInterfaces.ITypeRegistry {
  private _types:{[name:string]: AbstractType}={};

  private typeList:AbstractType[]=[]

  private static CLASS_IDENTIFIER_TypeRegistry = "typesystem.TypeRegistry";

  public getClassIdentifier() : string[] {
    var superIdentifiers:string[] = [];
    return superIdentifiers.concat(TypeRegistry.CLASS_IDENTIFIER_TypeRegistry);
  }

  public static isInstance(instance: any): instance is TypeRegistry {
    return instance != null && instance.getClassIdentifier
           && typeof(instance.getClassIdentifier) == "function"
            && _.contains(instance.getClassIdentifier(), TypeRegistry.CLASS_IDENTIFIER_TypeRegistry);
  }

  put(alias:string, t:AbstractType){
      this._types[alias]=t;
  }

  addType(t:AbstractType){
     if (t.isAnonymous()){
         return;
     }
     this._types[t.name()]=t;
     this.typeList.push(t);
  }

  get(name: string ):AbstractType{
      if (this._types.hasOwnProperty(name)){
          return this._types[name];
      }
      if (this._parent!=null){
          return this._parent.get(name);
      }
      return null;
  }

  private chainedTypes:{[key:string]:AbstractType} = {};

  getByChain(name:string):AbstractType{
      let result = this.get(name);
      if(!result){
          result = this.chainedTypes[name];
      }
      if(result){
          return result;
      }
      result = this.getTypeByChainFromCollection(name,this._c);
      if(result){
          this.chainedTypes[name] = result;
      }
      return result;
  }

  private getTypeByChainFromCollection(name:string,collection:parse.TypeCollection):AbstractType{

      let result = this.isAnnotationsReg ? collection.getAnnotationType(name) : collection.getType(name);
      if(result){
          return result;
      }
      for(let dt = name.indexOf('.'); dt >= 0 ; dt = name.indexOf('.',dt+1) ) {
          let namespace = name.substring(0, dt);
          let typeName = name.substr(dt + 1);
          let lib = collection.library(namespace);
          if (lib) {
              result = this.getTypeByChainFromCollection(typeName,lib);
              if (result) {
                  return result;
              }
          }
      }
      return null;
  }

  constructor(private _parent:TypeRegistry=null,
              protected _c?:parse.TypeCollection,
              protected isAnnotationsReg=false){}

    types():AbstractType[]{
        return this.typeList;
    }

    typeMap():{[name:string]: AbstractType}{
        return this._types;
    }
    
    parent():TypeRegistry{
        return this._parent;
    }
}
interface PropertyInfoHandle{
    name:string
    type: AbstractType;
}

interface PropertyInfos{

    [name: string]: PropertyInfoHandle;
}

class PropertyCyclesValidator{


    getInfos(t:AbstractType):PropertyInfos{
        if (t.getExtra("PInfos")){
            return t.getExtra("PInfos");
        }
        var m:PropertyInfos={};

        t.meta().forEach(x=>{
            if (x instanceof restr.HasProperty){
                var id=(<restr.HasProperty>x).value();
                m[id]={ name: id, type: null};
            }
        })
        t.meta().forEach(x=>{
            if (x instanceof restr.PropertyIs){
                var id=(<restr.PropertyIs>x).propertyName();
                if (m[id]){
                    m[id].type=(<restr.PropertyIs>x).value();
                }
            }
        })
        t.putExtra("PInfos",m);

        return m;
    }


    validate(t:AbstractType,visited:PropertyInfoHandle[]):boolean{
        var i=this.getInfos(t);
        var result=false;
        Object.keys(i).forEach(x=>{
            result=result||this.validateInfo(i[x],visited);
        })
        return result;
    }

    validateInfo(t:PropertyInfoHandle,visited:PropertyInfoHandle[]):boolean{
        if (visited.some(y=>y==t)){
            return true;
        }
        else{
            if (t.type instanceof UnionType){
                var ut=<UnionType>t.type;
                var passing=true;
                ut.options().forEach(o=>{
                    if (!this.validate(o, [t].concat(visited))){
                        passing=false;
                    }
                })
                return passing;
            }
            if (t.type.isArray()){

            }
            else {
                return this.validate(t.type, [t].concat(visited));
            }
        }
    }

    validateType(t:AbstractType):string[]{
        var i=this.getInfos(t);
        var result:string[]=[];
        Object.keys(i).forEach(x=>{
            if (this.validateInfo(i[x],[])){
                result.push(x);
            }
        })
        return result;
    }
}

export class RestrictionsConflict extends Status{
    constructor(protected _conflicting:Constraint,protected _stack:RestrictionStackEntry, protected source:any){
        super(Status.ERROR,messageRegistry.RESTRICTIONS_CONFLICT.code,null,source);

        this.computeMessage();
    }

    private computeMessage() {
        var conflictingMessage:string = null;
        if (this._stack != null) {
            if (this._stack.getRestriction() instanceof restr.MinMaxRestriction) {
                var mmr:restr.MinMaxRestriction = <restr.MinMaxRestriction>this._stack.getRestriction();
                conflictingMessage = this._conflicting.conflictMessage(mmr.facetPath(), mmr.value());
            }
        }
        if (conflictingMessage == null) {
            conflictingMessage = this._conflicting + " and " + (this._stack != null ? this._stack.getRestriction().toString() : "");
        }
        var typeInfo:string = "";
        if (this.source instanceof AbstractType) {
            var path:tsInterfaces.IValidationPath[] = [];
            var rse = this._stack;
            while (rse) {
                var restri = rse.getRestriction();
                if (restri instanceof PropertyIs) {
                    var vp:tsInterfaces.IValidationPath = {name: (<PropertyIs>restri).propId()};
                    if (path.length > 0) {
                        vp.child = path[path.length - 1];
                    }
                    path.push(vp);
                }
                rse = rse.pop();
            }
            setValidationPath(this,path.pop());
            var arc = restr.anotherRestrictionComponent();
            if(arc) {
                typeInfo = ` between types '${typePath(<AbstractType>this.source)}' and '${typePath(<AbstractType>arc)}'`;
            }
            else{
                typeInfo = ` in type '${typePath(<AbstractType>this.source)}'`;
            }
        }
        this.message = `Restrictions conflict${typeInfo}: ` + conflictingMessage;
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
var globalId=0;

export var VALIDATED_TYPE:AbstractType=null;

export class PropertyInfo implements tsInterfaces.IPropertyInfo {

    private isMap:boolean;
    private isProp:boolean;
    private isAdditionalProp:boolean;
    private isFacet:boolean;

    private _required:boolean;

    protected _matches:restr.MatchesProperty;
    protected _facetDecl:metaInfo.FacetDeclaration;


    constructor(obj:restr.MatchesProperty|metaInfo.FacetDeclaration){

        if(restr.MatchesProperty.isInstance(obj)) {
            this._matches = <restr.MatchesProperty>obj;
            let fn = this._matches.facetName();
            if (fn == "propertyIs") {
                this.isProp = true;
            }
            else if (fn == "mapPropertyIs") {
                this.isMap = true;
            }
            else if (fn == "additionalProperties") {
                this.isAdditionalProp = true;
            }
        }
        else{
            this.isFacet = true;
            this._facetDecl = <metaInfo.FacetDeclaration>obj;
        }

    }

    name() {
        return this.isFacet ? this._facetDecl.actualName() : this._matches.path();
    }

    isPattern() {
        return this.isMap;
    }

    isAdditional() {
        return this.isAdditionalProp;
    }

    declaredAt() {
        return this.isFacet ? this._facetDecl.owner() : this._matches.owner();
    }

    range() {
        return this.isFacet ? this._facetDecl.type() : this._matches.range();
    }

    required(): boolean{
        if(this._required!==undefined){
            return this._required;
        }
        if(this.isProp){
            return !this.property().isOptional();
        }
        else if(this.isMap){
            return !this.mapProperty().isOptional();
        }
        else if(this.isAdditionalProp){
            return !this.additionalProperty().isOptional();
        }
        return false;
    }

    setRequired(val:boolean){
        this._required = val;
    }

    private property():restr.PropertyIs{
        return this.isProp ? <restr.PropertyIs>this._matches : null;
    }

    private mapProperty():restr.MapPropertyIs{
        return this.isMap ? <restr.MapPropertyIs>this._matches : null;
    }

    private additionalProperty():restr.AdditionalPropertyIs{
        return this.isAdditionalProp ? <restr.AdditionalPropertyIs>this._matches : null;
    }

    annotations(){
        return this._matches ? this._matches.annotations() : [];
    }

}

export abstract class AbstractType implements tsInterfaces.IParsedType, tsInterfaces.IHasExtra, tsInterfaces.HasSource{

    protected computeConfluent: boolean

    protected metaInfo: TypeInformation[]=[];

    _subTypes: AbstractType[]=[]

    protected innerid=globalId++;

    protected extras:{ [name:string]:any}={};

    protected supertypeAnnotations:{[aName:string]:tsInterfaces.IAnnotation}[];


    protected _collection: tsInterfaces.IParsedTypeCollection;

    protected abstract clone(): AbstractType;

    private static CLASS_IDENTIFIER_AbstractType = "typesystem.AbstractType";

    public getClassIdentifier() : string[] {
        var superIdentifiers:string[] = [];
        return superIdentifiers.concat(AbstractType.CLASS_IDENTIFIER_AbstractType);
    }

    public static isInstance(instance: any): instance is AbstractType {
        return instance != null && instance.getClassIdentifier
            && typeof(instance.getClassIdentifier) == "function"
            && _.contains(instance.getClassIdentifier(), AbstractType.CLASS_IDENTIFIER_AbstractType);
    }

    annotation(name: string): any{
        let res:tsInterfaces.IAnnotation = null;
        for(let x of this.annotations()){
            if (x.name() == name) {
                return x.value();
            }
        }
        return null;
    }

    isAssignableFrom(t: tsInterfaces.IParsedType): boolean {
        if (t.allSuperTypes().indexOf(this) != -1) {
            return true;
        }
        //TODO make it better
        var ms = this.restrictions().filter(x => !metaInfo.DiscriminatorValue.isInstance(x));
        var another = t.restrictions();
        var all = true;
        ms.forEach(x => {
            var found = false;
            another.forEach(y => {
                var vm = x.composeWith(<any>y);
                if (vm == y) {
                    found = true;
                }
                if (GenericTypeOf.isInstance(y) && vm != null) {
                    if (vm == x) {
                        found = true;
                    }
                }
            })
            all = all && found;
        });
        return all;
    }

    registry() {
        return this._collection
    }

    cloneWithFilter(x: (y: TypeInformation, transformed?: tsInterfaces.IParsedType) => boolean|TypeInformation, f?: (t: tsInterfaces.IParsedType) => tsInterfaces.IParsedType): AbstractType {
        var c = this.clone();
        var ms: TypeInformation[] = [];
        this.metaInfo.forEach(f => {
            var rs = x(f, c);
            if (typeof rs == "boolean") {
                if (rs) {
                    ms.push(f);
                }
            }
            else {
                if (rs) {
                    ms.push(<TypeInformation>rs);
                }
            }
        })
        c.metaInfo = ms;
        return c;
    }

    options():tsInterfaces.IParsedType[]{
        if (this.isUnion()) {
            var res: tsInterfaces.IParsedType[] = [];
            this.allSuperTypes().forEach(x => {
                if (UnionType.isInstance(x)) {
                    var opts = x.options();
                    res = res.concat(opts);
                }
            })
            return _.unique(res);
        }
        return [this]
    }

    allOptions():tsInterfaces.IParsedType[]{
        if (this.isUnion()) {
            var res: tsInterfaces.IParsedType[] = [];
            this.allSuperTypes().forEach(x => {
                if (UnionType.isInstance(x)) {
                    var opts = x.allOptions();
                    res = res.concat(opts);
                }
            })
            return _.unique(res);
        }
        return [this]
    }

    examples(): tsInterfaces.IExample[]{
        return exO.exampleFromInheritedType2(this);
    }

    collection(): tsInterfaces.IParsedTypeCollection {
        if (!this._collection) {
            if ((<any>this)._contextMeta) {
                var cm: TypeInformation = (<any>this)._contextMeta;
                if (cm) {
                    return cm.owner().collection();
                }
            }
        }
        return this._collection
    }
    getExtra(name:string):any{
        return this.extras[name];
    }
    putExtra(name:string,v:any){
        this.extras[name]=v;
    }

    id():number{
        return this.innerid;
    }


    knownProperties():MatchesProperty[]{
        return <MatchesProperty[]>this.metaOfType(<any>MatchesProperty);
    }

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

    patchName(name: string) {
        this._name = name;
    }

    allFacets():TypeInformation[]{
        return this.meta().filter(x=>{
            if(!metaInfo.DiscriminatorValue.isInstance(x)){
                return true;
            }
            return (<metaInfo.DiscriminatorValue>x).isStrict();
        });
    }

    declaredFacets():TypeInformation[]{
        return this.declaredMeta();
    }

    isSubTypeOf(t:AbstractType):boolean{
        return t===ANY||this===t|| this.superTypes().some(x=>x.isSubTypeOf(t))
    }
    isSuperTypeOf(t:AbstractType):boolean{
        return this===t|| this.allSubTypes().indexOf(t)!=-1
    }
    public addMeta(info:TypeInformation){
        this.metaInfo.push(info);
        info._owner=this;
        this.propertyInfos = null;
        this.propertiesMap = null;
        this.definedFacetInfos = null;
        this.definedFacetInfosMap = null;
    }

    name(){
        return this._name;
    }

    label(){
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
    
    addSupertypeAnnotation(arr:tsInterfaces.IAnnotation[], ind:number){
        if(!arr||arr.length==0){
            return;
        }
        if(!this.supertypeAnnotations){
            this.supertypeAnnotations = [];
        }
        var aMap = this.supertypeAnnotations[ind];
        if(!aMap){
            aMap = {};
            this.supertypeAnnotations[ind] = aMap;
        }
        for(var a of arr) {
            aMap[a.facetName()] = a;
        }
    }

    validateType(tr:TypeRegistry=builtInRegistry()):Status{
        var rs=new Status(Status.OK,"","",this);
        this.validateHierarchy(rs);
        if (this.getExtra(tsInterfaces.PARSE_ERROR)){
            rs.addSubStatus(this.getExtra(tsInterfaces.PARSE_ERROR));
        }
        if (rs.isOk()) {
            rs.addSubStatus(this.checkConfluent());

            if (this.isExternal() && this.kind() == "external") {
                var extType = <ExternalType><any>this;

                if (extType.isJSON()) {
                    try {
                        var sch = su.getJSONSchema(extType.schema(), extType.getContentProvider && extType.getContentProvider());
                        if (sch) {
                            sch.validateSelf();
                        }
                    } catch (e) {
                        if (e.message == "Maximum call stack size exceeded") {
                            return error(messageRegistry.CIRCULAR_REFS_IN_JSON_SCHEMA, this);
                        }
                        else if (ValidationError.isInstance(e)) {
                            var ve = <ValidationError>e;
                            let errorStatus = error(ve.messageEntry, this, ve.parameters,
                                ve.isWarning?Status.WARNING:Status.ERROR);
                            errorStatus.setInternalRange(ve.internalRange);
                            errorStatus.setInternalPath(toValidationPath(ve.internalPath));
                            errorStatus.setFilePath(ve.filePath);
                            rs.addSubStatus(errorStatus);

                        }
                        else {
                            rs.addSubStatus(error(messageRegistry.JSON_SCHEMA_VALIDATION_EXCEPTION,this,{msg:e.message}));
                        }
                    }
                }
            }
            if (rs.isOk()) {
                this.superTypes().forEach(x=> {
                    if (x.isAnonymous()) {
                        var superStatus = x.validateType(tr);
                        if(!superStatus.isOk()) {
                            setValidationPath(superStatus,{name:"type"});
                            rs.addSubStatus(superStatus)
                        }
                    }
                })
            }
        }

        if (this.getExtra(SCHEMA_AND_TYPE)){
            rs.addSubStatus(error(messageRegistry.SCHEMA_AND_TYPE,this));
        }
        if (rs.isOk()) {
            this.validateMeta(tr).getErrors().forEach(x=>rs.addSubStatus(x));
        }
        //if (this.isPolymorphic()||(this.isUnion())) {
        //    rs.addSubStatus(this.canDoAc());
        //}


        if (this.isObject()){
            var required:{ [name:string]:boolean}={};
            this.restrictions().forEach(x=>{
                if (x.owner()!=this){
                    if (x instanceof restr.HasProperty){
                        required[x.value()]=true;
                    }
                }
            });
            this.declaredMeta().forEach(x=>{
                if (x instanceof restr.HasProperty){
                    delete required[x.value()];
                }
            })
            this.declaredMeta().forEach(x=>{
                if (x instanceof restr.PropertyIs){
                    var pr:restr.PropertyIs=x;
                    if (required.hasOwnProperty(pr.propertyName())){
                        rs.addSubStatus(error(messageRegistry.REQUIRED_OVERRIDE_OPTIONAL,
                            this,{ propertyName: pr.propertyName() }));
                    }
                }
            })
            var propertyCycles=new PropertyCyclesValidator().validateType(this);
            if (propertyCycles.length>0){
                propertyCycles.forEach(p=>{
                    var st = error(messageRegistry.CYCLIC_DEPENDENCY, this,{ typeName: p });
                    setValidationPath(st,{name:p})
                    rs.addSubStatus(st);
                })

            }
        }

        if (this.supertypeAnnotations) {
            for (var i = 0 ; i < this.supertypeAnnotations.length ; i++) {
                var aMap = this.supertypeAnnotations[i];
                for (var aName of Object.keys(aMap)) {
                    var a = aMap[aName];
                    var aStatus = <Status>a.validateSelf(tr);
                    if (!aStatus.isOk()) {
                        setValidationPath(aStatus,{name: "type", child: {name: i}});
                        rs.addSubStatus(aStatus);
                    }
                }
            }
        }
        var pluginStatuses = applyTypeValidationPlugins(this,tr);
        for(var ps of pluginStatuses){
            rs.addSubStatus(ps);
        }
        var typeEntry = new AnnotatedType(this,tr);
        var aPluginStatuses = applyAnnotationValidationPlugins(typeEntry);
        for(var ps of aPluginStatuses){
            rs.addSubStatus(ps);
        }
        return rs;
    }





    public validateHierarchy(rs:Status) {
        if (!this.isAnonymous()) {
            if (this.getExtra(tsInterfaces.TOP_LEVEL_EXTRA) && builtInRegistry().get(this.name())) {
                rs.addSubStatus(error(messageRegistry.REDEFINIG_BUILDTIN, this, { typeName: this.name() }));
            }
        }

        if (this.isSubTypeOf(RECURRENT)) {
            rs.addSubStatus(error(messageRegistry.RECURRENT_DEFINITION, this),"type")
        }

        if (isUnknown(this)) {
            let chained = this.metaOfType(metaInfo.ImportedByChain);
            if(chained.length>0){
                let issues:Status[] = [];
                chained.forEach(x=>{
                    issues.push(error(messageRegistry.INHERITING_TYPE_IMPORTED_THROUGH_LIBRARY_CHAIN, this, {
                        typeName: x.value()
                    }));
                });
                issues.forEach(x=>rs.addSubStatus(x,"type"));
            }
            else {
                rs.addSubStatus(error(messageRegistry.INHERITING_UNKNOWN_TYPE, this),"type")
            }

        }
        if (this.isUnion()) {
            var tf = this.typeFamily();
            let chained: metaInfo.ImportedByChain[] = [];
            let isRecurent = false;
            let isUnknown = false;
            for (let t of tf) {
                if (t.isSubTypeOf(RECURRENT)) {
                    isRecurent = true;
                }
                else if (t.isSubTypeOf(UNKNOWN)) {
                    isUnknown = true;
                }
                t.metaOfType(metaInfo.ImportedByChain).forEach(x => chained.push(x));
            }
            if (isRecurent) {
                rs.addSubStatus(error(messageRegistry.RECURRENT_UNION_OPTION, this),"type")
            }
            if (isUnknown) {
                if(chained.length>0){
                    chained = _.unique(chained);
                    if(chained.length>0){
                        chained.forEach(x=>{
                            let typeName = x.value();
                            let messageEntry = messageRegistry.UNION_OPTION_TYPE_DEPENDS_ON_TYPE_IMPORTED_THROUGH_LIBRARY_CHAIN;
                            if(this.options().some(y=>y.name() == typeName)){
                                messageEntry = messageRegistry.UNION_OPTION_TYPE_OPTION_IMPORTED_THROUGH_LIBRARY_CHAIN;
                            }
                            rs.addSubStatus(error(messageEntry,this,{typeName:typeName}), "type");
                        });
                    }
                }
                else {
                    rs.addSubStatus(error(messageRegistry.UNKNOWN_UNION_OPTION, this), "type")
                }
            }
        }
        if (this.isArray()) {
            const fs = this.familyWithArray();
            var ps = this.getExtra(tsInterfaces.HAS_ITEMS) ? "items" : "type";
            let chained: metaInfo.ImportedByChain[] = [];
            let isRecurent = false;
            let isUnknown = false;
            for (let t of fs) {
                if (t == this || t === RECURRENT) {
                    isRecurent = true;
                }
                else if (t == UNKNOWN) {
                    isUnknown = true;
                }
                t.metaOfType(metaInfo.ImportedByChain).forEach(x => chained.push(x));
            }
            if (isRecurent) {
                rs.addSubStatus(error(messageRegistry.RECURRENT_ARRAY_DEFINITION, this), ps)
            }
            else if (isUnknown) {
                var componentTypeName = this.oneMeta(ComponentShouldBeOfType).value().name();
                if(chained.length>0){
                    chained = _.unique(chained);
                    chained.forEach(x=>{
                        let typeName:string = componentTypeName;
                        let messageEntry = messageRegistry.ARRAY_COMPONENT_TYPE_IMPORTED_THROUGH_LIBRARY_CHAIN;
                        if(!typeName){
                            componentTypeName = x.value();
                        }
                        else if(x.value() != typeName){
                            messageEntry = messageRegistry.ARRAY_COMPONENT_TYPE_DEPENDES_ON_TYPE_IMPORTED_THROUGH_LIBRARY_CHAIN;
                            typeName = x.value();
                        }
                        rs.addSubStatus(error(messageEntry,this,{componentTypeName:componentTypeName,typeName:typeName}),ps);
                    });
                }
                else {
                    rs.addSubStatus(error(messageRegistry.UNKNOWN_ARRAY_COMPONENT_TYPE,
                        this, {componentTypeName: componentTypeName}), ps)
                }
            }
        }
        var supers=this.superTypes();
        var hasExternal:boolean=false;
        var hasNotExternal:boolean=false;

        if (supers.length>1){
            supers.forEach(x=>{
                if (x.isExternal()){
                    hasExternal=true;
                }
                else{
                    hasNotExternal=true;
                }
            })
        }
        if (hasExternal&&hasNotExternal){
            rs.addSubStatus(error(messageRegistry.EXTERNALS_MIX, this));
        }
        if (this instanceof UnionType){
            var ut=<UnionType><any>this;
            ut.options().forEach(x=>{
                if (x.isExternal()){
                    rs.addSubStatus(error(messageRegistry.EXTERNALS_MIX, this));
                }
            })
        }
        if (this.isExternal()){
            if (this.getExtra(tsInterfaces.HAS_FACETS)){
                let fArr = this.getExtra(tsInterfaces.HAS_FACETS);
                if(fArr.length) {
                    let f = fArr[fArr.length-1];
                    var fs = error(messageRegistry.EXTERNAL_FACET, this,
                        {name: f});
                    setValidationPath(fs, {name: f});
                    rs.addSubStatus(fs);
                }
            }
        }

    };

    private familyWithArray(){
        if(this.oneMeta(metaInfo.SkipValidation)){
            return [];
        }
        let ts:AbstractType[]=[];
        this.fillSuperTypes(ts,true);
        let mn=this.oneMeta(ComponentShouldBeOfType);
        if (mn){
            var at:AbstractType=mn.value();
            if(!at.oneMeta(metaInfo.SkipValidation)) {
                ts = ts.concat(at.familyWithArray().concat(at));
            }
        }
        return ts;
    }

    validateMeta(tr:TypeRegistry):Status{
        var rs=new Status(Status.OK,"","",this);
        this.declaredMeta().forEach(x=>{
            x.validateSelf(tr).getErrors().forEach(y=>rs.addSubStatus(y))

        })

        this.validateFacets(rs);
        return rs;
    }

    private validateFacets(rs:Status) {
        var fds:{ [name : string ]: FacetDeclaration} = {}
        var super_facets:{ [name : string ]: FacetDeclaration} = {}
        var rfds:{ [name : string ]: FacetDeclaration} = {}

        this.meta().forEach(x=> {
            if (x instanceof FacetDeclaration) {
                var fd:FacetDeclaration = x;

                fds[fd.actualName()] = fd;
                if (!fd.isOptional()) {
                    if (fd.owner()!==this) {
                        rfds[fd.actualName()] = fd;
                    }
                }
                if (fd.owner()!=this){
                    super_facets[fd.actualName()]=fd;
                }

            }
        })
        this.declaredMeta().forEach(x=> {
            if (x instanceof FacetDeclaration) {
                var fd:FacetDeclaration = x;
                if (fd.owner()==this){
                    var an=fd.actualName();
                    if (super_facets.hasOwnProperty(an)){
                        rs.addSubStatus(error(messageRegistry.OVERRIDE_FACET,
                            this, {name: an}));
                    }

                    var fp=fr.getInstance().facetPrototypeWithName(an);
                    if (fp&&fp.isApplicable(this)||an=="type"||
                        fd.facetName()=="properties"||an=="schema"||an=="facets"||an=="uses"){
                        rs.addSubStatus(error(messageRegistry.OVERRIDE_BUILTIN_FACET,
                            this, {name: an}));
                    }

                    if (an.charAt(0)=='('){
                        rs.addSubStatus(error(messageRegistry.FACET_START_BRACKET,
                            this, {name: an}));
                    }
                }
            }
        })
        var knownPropertySet:{ [name:string]:boolean}={}
        this.meta().forEach(x=> {
                if (x instanceof PropertyIs){
                    knownPropertySet[(<PropertyIs>x).propId()]=true;
                }
        });
        for(var x of this.meta()){
            if (x instanceof CustomFacet) {
                var cd:CustomFacet = x;
                if(cd.node()&&cd.node().getMeta("skipValidation")){
                    continue;
                }
                var facetName = cd.facetName();
                if (fds.hasOwnProperty(facetName)) {
                    var facet = fds[facetName];
                    var ft = facet.value();
                    if(facet.owner() == this && cd.owner() == this){
                        let err = error(messageRegistry.FACET_CAN_NOT_BE_FIXED_BY_THE_DECLARING_TYPE,cd);
                        err.setValidationPath({name: facetName});
                        rs.addSubStatus(err);
                    }
                    else {
                        let st = ft.validateDirect(cd.value(), false, false);
                        for(var err of st.getErrors()){
                            setValidationPath(err,{name:facetName});
                            rs.addSubStatus(err);
                        };
                        delete rfds[facetName];
                    }
                }
                else {
                    if(this.isExternal()){
                        rs.addSubStatus(error(messageRegistry.FACET_PROHIBITED_FOR_EXTERNALS,
                            cd, {facetName: facetName}, Status.ERROR, true));
                    }
                    else{
                        rs.addSubStatus(error(messageRegistry.UNKNOWN_FACET,
                            cd, {facetName: facetName}, Status.ERROR, true));
                    }
                }
            }
            // if (x instanceof MapPropertyIs){
            //     var mm:MapPropertyIs=x;
            //     Object.keys(knownPropertySet).forEach(c=>{
            //         try {
            //             if (c.match(mm.regexpValue())) {
            //                 var regexpText = '/' + mm.regexpValue().toString() + '/';
            //                
            //                 rs.addSubStatus(new Status(Status.WARNING, 0, `Pattern property '${regexpText}' conflicts with property: '${c}'`, this));
            //             }
            //         } catch (e){
            //             //ignore incorrect regexps here
            //         }
            //     })
            // }
        }
        if (Object.getOwnPropertyNames(rfds).length > 0) {
            rs.addSubStatus(error(messageRegistry.MISSING_REQUIRED_FACETS,
                this, { facetsList: Object.keys(rfds).map(x=>`'${x}'`).join(",")}))
        }
    };

    public allSuperTypes():AbstractType[]{
        var rs:AbstractType[]=[];
        this.fillSuperTypes(rs);
        return rs;
    }
    private fillSuperTypes(r:AbstractType[],forValidation=false){
        for(let x of this.superTypes()){
            if(forValidation && x.oneMeta(metaInfo.SkipValidation)){
                continue;
            }
            if (!_.contains(r,x)) {
                r.push(x);
                x.fillSuperTypes(r);
            }
        }
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
        return (!this._name)||this._name.length===0;
    }
    /**
     *
     * @return true if type has no associated meta information of restrictions
     */
    isEmpty():boolean{
        if(this.extras != null && this.extras.hasOwnProperty(tsInterfaces.PARSE_ERROR)){
            return false;
        }
        if (this.metaInfo.length>2){
            return false;
        }
        return this.metaInfo.filter(x=>{
                if(NotScalar.isInstance(x)){
                    return false;
                }
                else if(metaInfo.DiscriminatorValue.isInstance(x)){
                    return (<metaInfo.DiscriminatorValue>x).isStrict();
                }
                else if(metaInfo.SourceMap.isInstance(x)){
                    return false;
                }
                else if(metaInfo.ImportedByChain.isInstance(x)){
                    return false;
                }
                return true;
            }).length==0;
    }

    /**
     *
     * @return true if type is an array or extends from an array
     */
    isArray():boolean{
        return this===<AbstractType>ARRAY||this.allSuperTypes().indexOf(ARRAY)!=-1;
    }
    propertySet():string[]{
        var rs:string[]=[]
        this.meta().forEach(x=>{
            if (x instanceof PropertyIs){
                var p=<PropertyIs>x;
                rs.push(p.propertyName());
            }
        });
        return _.uniq(rs);
    }



    checkConfluent():Status{
        if(this.oneMeta(metaInfo.SkipValidation)){
            return ok();
        }
        if (this.computeConfluent){
            return ok();
        }
        this.computeConfluent=true;
        var arcc = restr.anotherRestrictionComponentsCount();
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
                var status=new RestrictionsConflict(another,lstack,this);
                return status;
            }
            return ok();
        }finally {
            this.computeConfluent=false;
            restr.releaseAnotherRestrictionComponent(arcc);
        }
    }
    /**
     *
     * @return true if type is object or inherited from object
     */
    isObject():boolean{
        return this==<AbstractType>OBJECT||_.some(this.allSuperTypes(),x=>x.isObject());
    }

    /**
     *
     * @return true if type is object or inherited from object
     */
    isExternal():boolean{
        return this==<AbstractType>EXTERNAL||this.allSuperTypes().indexOf(EXTERNAL)!=-1;
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
     * @return true if type is number or inherited from number
     */
    isFile():boolean{
        return this==<AbstractType>FILE||this.allSuperTypes().indexOf(FILE)!=-1;
    }

    /**
     *
     * @return true if type is scalar or inherited from scalar
     */
    isScalar():boolean{
        return this==<AbstractType>SCALAR||this.allSuperTypes().indexOf(SCALAR)!=-1;
    }
    /**
     * returns true if this type inherits from one of date related types
     */
    isDateTime():boolean{
        return this==<AbstractType>DATETIME||this.allSuperTypes().indexOf(DATETIME)!=-1;
    }


    /**
     * returns true if this type inherits from one of date related types
     */
    isDateOnly():boolean{
        return this==<AbstractType>DATE_ONLY||this.allSuperTypes().indexOf(DATE_ONLY)!=-1
    }

    /**
     * returns true if this type inherits from one of date related types
     */
    isTimeOnly():boolean{
        return this==<AbstractType>TIME_ONLY||this.allSuperTypes().indexOf(TIME_ONLY)!=-1
    }

    /**
     * returns true if this type inherits from one of date related types
     */
    isInteger():boolean{
        return this==<AbstractType>INTEGER||this.allSuperTypes().indexOf(INTEGER)!=-1
    }
    /**
     * returns true if this type inherits from one of date related types
     */
    isDateTimeOnly():boolean{
        return this==<AbstractType>DATETIME_ONLY||this.allSuperTypes().indexOf(DATETIME_ONLY)!=-1
    }

    /**
     *
     * @return true if type is scalar or inherited from scalar
     */
    isUnknown():boolean{
        return this==<AbstractType>UNKNOWN||this.allSuperTypes().indexOf(UNKNOWN)!=-1;
    }

    /**
     *
     * @return true if type is scalar or inherited from scalar
     */
    isRecurrent():boolean{
        return this==<AbstractType>RECURRENT||this.allSuperTypes().indexOf(RECURRENT)!=-1;
    }

    /**
     *
     * @return true if type is an built-in type
     */
    isBuiltin():boolean{
        return this.metaInfo.indexOf(BUILT_IN)!=-1;
    }
    exampleObject():any{
        return exO.example(this);
    }
    /**
     *
     * @return true if type is an polymorphic type
     */
    isPolymorphic():boolean{
        return this.meta().some(x=>x instanceof Polymorphic);
    }

    /**
     * @return all restrictions associated with type
     */
    restrictions(forValidation:boolean=false):Constraint[]{
        if (this.isUnion()){
            var rs:Constraint[]=[];
            this.superTypes().forEach(x=>{
                rs=rs.concat(x.restrictions());
            });
            rs=rs.concat(<Constraint[]>this.meta().filter(x=>x instanceof Constraint));
            return rs;
        }
        var result:Constraint[]=[];
        var generic:GenericTypeOf=null;
        this.meta().forEach(x=>{
            if (x instanceof Constraint){
                if (x instanceof  GenericTypeOf&&forValidation){
                    if (generic){
                        return;
                    }
                    generic=x;
                }
                result.push(x);
            }

        })
        return result;
    }


    customFacets():TypeInformation[]{
        return this.declaredMeta().filter(x=>x instanceof metaInfo.CustomFacet)
    }
    allCustomFacets():TypeInformation[]{
        return this.meta().filter(x=>x instanceof metaInfo.CustomFacet)
    }

    isUnion():boolean{
        var rs=false;
        if (this.isBuiltin()){
            return false;
        }
        this.allSuperTypes().forEach(x=>rs=rs|| x instanceof UnionType);
        return rs;
    }

    isIntersection():boolean{
        var rs=false;
        if (this.isBuiltin()){
            return false;
        }
        this.allSuperTypes().forEach(x=>rs=rs|| x instanceof IntersectionType);
        return rs;
    }
    
    nullable:boolean
    /**
     * return all type information associated with type
     */
    meta():TypeInformation[]{
        return [].concat(this.metaInfo);
    }
    /**
     * validates object against this type without performing AC
     */
    validateDirect(i:any,autoClose:boolean=false,nullAllowed:boolean=true,path:tsInterfaces.IValidationPath=null):Status{
        var prevValidated=VALIDATED_TYPE;
        try {
            var g = autoCloseFlag;
            if(autoClose){
                autoCloseFlag = true;
            }
            VALIDATED_TYPE = this;
            var result = new Status(Status.OK, "", "", this);
            if (!nullAllowed && (i === null || i === undefined)) {
                if (!this.nullable) {
                    var typeRestriction: TypeOfRestriction = null;

                    this.restrictions(true).forEach(restriction => {
                        if(restriction instanceof TypeOfRestriction) {
                            if(typeRestriction) {
                                return;
                            }

                            typeRestriction = restriction;
                        }
                    });

                    if (typeRestriction) {
                        return error(messageRegistry.TYPE_EXPECTED, typeRestriction, {
                            expectedType: typeRestriction.value(),
                            actualType: 'null'
                        });
                    }

                    return error(messageRegistry.OBJECT_EXPECTED, this)
                }
            }
            this.restrictions(true).forEach(x=>result.addSubStatus(x.check(i, path)));
            if ((autoClose || autoCloseFlag) && this.isObject() && (!this.oneMeta(KnownPropertyRestriction))) {
                var cp = new KnownPropertyRestriction(false);
                cp.patchOwner(this);
                cp.check(i).getErrors().forEach(x=> {
                    var rs = new Status(Status.WARNING, x.getCode(), x.getMessage(), this);
                    setValidationPath(rs,x.getValidationPath())
                    result.addSubStatus(rs);
                });
            }
        } finally{
            autoCloseFlag = g;
            VALIDATED_TYPE=prevValidated;
        }
        return  result;
    }
    validate(i:any,autoClose:boolean=false,nullAllowed:boolean=true):Status{
        var g=autoCloseFlag;
        if (!nullAllowed&&(i===null||i===undefined)) {
            if (!this.nullable) {
                return error(messageRegistry.NULL_NOT_ALLOWED, this)
            }
        }
        if (autoClose){
            autoCloseFlag=true;
        }
        try {
            // for( var subType of this.subTypes()){
            //     var vr = subType.validateDirect(i,autoClose||g);
            //     if(vr.isOk()){
            //         return vr;
            //     }
            // }
            // return this.validateDirect(i, autoClose||g);

            var statuses:Status[] = [];
            var global:AbstractType = _.find([<AbstractType>this].concat(this.allSuperTypes()),x=>x.getExtra(GLOBAL));
            var queue = this.allSubTypes().concat(this);
            if(global && global!=this){
                queue = queue.concat(global.allSubTypes());
                queue.push(global);
            }
            var lastStatus:Status;
            for( var subType of queue){
                var dStatus = checkDescriminator(i,subType);
                var vr = subType.validateDirect(i,autoClose||g);
                if(dStatus){
                    if(dStatus.isOk()) {
                        return vr;
                    }
                    else {
                        statuses.push(dStatus);
                    }
                }
                else if(vr.isOk()){
                    return vr;
                }
                lastStatus = vr;
            }
            if(statuses.length==0){
                return lastStatus;
            }
            var result = ok();
            statuses.forEach(x=>result.addSubStatus(x));
            return statuses.pop();//result;
        } finally {
            autoCloseFlag=g;
        }

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
        this.addMeta(new KnownPropertyRestriction(false))
    }

    annotations(): metaInfo.Annotation[] {
        return this.metaOfType(metaInfo.Annotation);
    }

    declaredAnnotations(): metaInfo.Annotation[] {
        return <any>this.declaredMeta().filter(x =>metaInfo.Annotation.isInstance(x));
    }

    scalarsAnnotations(): {[key:string]:metaInfo.Annotation[][]}{
        return this.sAnnotations(this.meta());
    }

    declaredScalarsAnnotations(): {[key:string]:metaInfo.Annotation[][]}{
        return this.sAnnotations(this.declaredFacets());
    }

    private sAnnotations(facets:tsInterfaces.ITypeFacet[]): {[key:string]:metaInfo.Annotation[][]}{
        facets = facets.filter(x=>
            x.kind()!=tsInterfaces.MetaInformationKind.FacetDeclaration
            && x.kind()!=tsInterfaces.MetaInformationKind.Example
            && x.kind()!=tsInterfaces.MetaInformationKind.Examples
            && x.facetName() != "propertyIs");

        let result: {[key:string]:metaInfo.Annotation[][]} = {};
        for(let f of facets){
            const annotations = f.annotations();
            if(!annotations||!annotations.length){
                continue;
            }
            result[f.facetName()] = [annotations.map(x=>{
                let a = new metaInfo.Annotation(x.name(),x.value(),(<metaInfo.Annotation>x).getPath());
                a.setOwnerFacet(f);
                return a;
            })];
        }
        if(this.supertypeAnnotations&&this.supertypeAnnotations.length){
            result['type'] = this.supertypeAnnotations.map(x=>{
                return Object.keys(x).map(y=>new metaInfo.Annotation(x[y].name(),x[y].value(),(<metaInfo.Annotation>x[y]).getPath()));
            });
        }
        return result;
    }

    componentType(): tsInterfaces.IParsedType{
        let components = this.metaOfType(ComponentShouldBeOfType);
        if(components.length==0){
            return null;
        }
        else if(components.length==1){
            return components[0].value();
        }
        else{
            let componentTypes:AbstractType[] = components.map(x=>x.value());
            let componentTypes1:AbstractType[] = [].concat(componentTypes);
            for(let x of componentTypes1){
                let toRemove:AbstractType[] = []
                for(let y of componentTypes){
                    if(x==y){
                        continue;
                    }
                    if(y.isAssignableFrom(x)){
                        toRemove.push(y);
                    }
                }
                componentTypes = componentTypes.filter(y=>toRemove.indexOf(y)<0);
            }

            let ct = derive(null,componentTypes);
            return ct;
        }
    }

    canDoAc():Status{
        var tf:AbstractType[]= _.uniq(this.typeFamily());
        var s=new Status(Status.OK,"","",this);
        for (var i=0;i<tf.length;i++){
            for (var j=0;j<tf.length;j++){
                if (i!=j){
                    var t0=tf[i];
                    var t1=tf[j];
                    var ed=this.emptyIntersectionOrDiscriminator(t0,t1);
                    s.addSubStatus(ed);
                }
            }
        }
        return s;
    }

    private emptyIntersectionOrDiscriminator(t0:AbstractType, t1:AbstractType):Status {
        if (t1 === t0) {
            return ok();
        }
        if (t1.isScalar()&&t0.isScalar()){
            return ok();
        }
        var it = intersect("", [t0, t1]);
        var innerCheckConfluent = it.checkConfluent();
        if (innerCheckConfluent.isOk()) {
            return this.checkDiscriminator(t0, t1);

        }
        return ok();
    }

    protected propertyInfos:PropertyInfo[];
    protected propertiesMap:{[key:string]:PropertyInfo};

    protected definedFacetInfos:PropertyInfo[];
    protected definedFacetInfosMap:{[key:string]:PropertyInfo};

    properties(): tsInterfaces.IPropertyInfo[]{
        if (this.propertyInfos == null) {
            this.propertiesMap = {};
            this.propertyInfos = [];
            var meta = this.meta();
            for (let m of meta) {
                if (restr.MatchesProperty.isInstance(m)) {
                    let p = new PropertyInfo(<restr.MatchesProperty>m);
                    let name = p.name();
                    if(!this.propertiesMap[name]) {
                        this.propertiesMap[name] = p;
                    }
                    this.propertyInfos.push(p);
                }
            }
        }
        return this.propertyInfos;
    }

    declaredProperties(): tsInterfaces.IPropertyInfo[]{
        return this.properties().filter(x=>x.declaredAt()==this);
    }

    allDefinedFacets(): tsInterfaces.IPropertyInfo[]{
        if (this.definedFacetInfos == null) {
            this.definedFacetInfosMap = {};
            this.definedFacetInfos = [];
            var m = this.meta();
            for (let f of m) {
                if (metaInfo.FacetDeclaration.isInstance(f)&&!(<metaInfo.FacetDeclaration>f).isBuiltIn()) {
                    let p = new PropertyInfo(<metaInfo.FacetDeclaration>f);
                    if(!this.definedFacetInfosMap[f.facetName()]){
                        this.definedFacetInfosMap[p.name()] = p;
                    }
                    this.definedFacetInfos.push(p);
                }
            }
        }
        return this.definedFacetInfos;
    }

    definedFacets(): tsInterfaces.IPropertyInfo[]{
        return this.allDefinedFacets().filter(x=>x.declaredAt()==this);
    }

    property(name: string): tsInterfaces.IPropertyInfo{
        if (!this.propertyInfos) {
            this.properties();
        }
        return this.propertiesMap[name];
    }

    checkDiscriminator(t1:AbstractType, t2:AbstractType):Status {
        var found = error(messageRegistry.DISCRIMINATOR_NEEDED,this, {name1: t1.name(), name2: t2.name()});
        var oneMeta = t1.oneMeta(metaInfo.Discriminator);
        var anotherMeta = t2.oneMeta(metaInfo.Discriminator);
        if (oneMeta != null && anotherMeta != null && oneMeta.value() === (anotherMeta.value())) {

            var d1 = t1.name();
            var d2 = t2.name();
            var dv1 = t1.oneMeta(metaInfo.DiscriminatorValue);
            if (dv1 != null) {
                d1 = dv1.value();
            }
            var dv2 = t2.oneMeta(metaInfo.DiscriminatorValue);
            if (dv2 != null) {
                d2 = dv2.value();
            }
            if (d1 !== d2) {
                return ok();
            }
            found = error(messageRegistry.SAME_DISCRIMINATOR_VALUE,this, {name1: t1.name(), name2: t2.name()});
        }
        return found;
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

        if (this.isBuiltin()){
            return this;
        }
        var tf:AbstractType[]= _.uniq(this.typeFamily());
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
            var ds=x.validateDirect(obj,true);
            if (ds.isOk()){
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
    metaOfType<T>(clazz:{ new(v:any, x?:any, p?:string):T } ):T[]{
        return <any>this.meta().filter(x=>x instanceof clazz);
    }


    declaredMeta():TypeInformation[]{
        return this.metaInfo;
    }

    descValue():any{
        var dv=this.oneMeta(metaInfo.DiscriminatorValue);
        if (dv){
            return dv.value();
        }
        return this.name();
    }

    isAbstractOrInternal():boolean{
        return this.metaInfo.some(x=>x instanceof Abstract||x instanceof Internal)
    }

    public  typeFamily():AbstractType[] {
        if (this.isUnion()){
            var res:AbstractType[]=[]
            this.allSuperTypes().forEach(x=>{
                if (x instanceof UnionType){
                    var opts=x.allOptions();
                    for (var i=0;i<opts.length;i++){
                        res=res.concat(opts[i].typeFamily());
                    }
                }
            })
            return _.unique(res);
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

    hasPropertiesFacet():boolean{
        return this.metaInfo.some(x=>x instanceof metaInfo.HasPropertiesFacet);
    }

    sourceMap():tsInterfaces.ElementSourceInfo{
        return null;
    }
}

export abstract class Modifier extends TypeInformation{

    requiredType(){
        return ANY;
    }

    kind() : tsInterfaces.MetaInformationKind {
        return tsInterfaces.MetaInformationKind.Modifier;
    }
}
export class Polymorphic extends Modifier{

    constructor(){super(true)}
    facetName(){
        return "polymorphic";
    }

    value(){
        return true;
    }
}
export class Abstract extends Modifier{

    constructor(){super(false)}

    value(){
        return true;
    }

    facetName(){
        return "abstract"
    }
}
export class Internal extends Modifier{
    constructor(){super(false)}


    facetName(){
        return "abstract"
    }

    value(){
        return true;
    }
}

class BuiltIn extends Modifier{

    constructor(){super(false)}

    facetName(){
        return "builtIn"
    }
    value(){
        return true;
    }
}

var BUILT_IN=new BuiltIn();


export class RootType extends AbstractType{

    private static CLASS_IDENTIFIER_RootType = "typesystem.RootType";

    public getClassIdentifier() : string[] {
        var superIdentifiers:string[] = super.getClassIdentifier();
        return superIdentifiers.concat(RootType.CLASS_IDENTIFIER_RootType);
    }

    public static isInstance(instance: any): instance is RootType {
        return instance != null && instance.getClassIdentifier
            && typeof(instance.getClassIdentifier) == "function"
            && _.contains(instance.getClassIdentifier(), RootType.CLASS_IDENTIFIER_RootType);
    }

    kind(){
        return "root";
    }

    clone() {
        return this;
    }
}

export class InheritedType extends AbstractType{

    protected _superTypes: AbstractType[]=[]
    
    protected _contextMeta: restr.MatchesProperty;

    private static CLASS_IDENTIFIER_InheritedType = "typesystem.InheritedType";

    public getClassIdentifier() : string[] {
        var superIdentifiers:string[] = super.getClassIdentifier();
        return superIdentifiers.concat(InheritedType.CLASS_IDENTIFIER_InheritedType);
    }

    public static isInstance(instance: any): instance is InheritedType {
        return instance != null && instance.getClassIdentifier
            && typeof(instance.getClassIdentifier) == "function"
            && _.contains(instance.getClassIdentifier(), InheritedType.CLASS_IDENTIFIER_InheritedType);
    }

    superTypes(){
        return this._superTypes;
    }

    clone() {
        if (this.isBuiltin()) {
            return this;
        }
        var v = new InheritedType(this._name);
        v._superTypes = this._superTypes;
        return v;
    }

    knownProperties():MatchesProperty[]{
        var vs= <MatchesProperty[]>this.metaOfType(<any>MatchesProperty);
        this.superTypes().forEach(x=>{
            vs=vs.concat(x.knownProperties());
        })
        return vs;
    }

    kind(){
        return "inherited"
    }
    meta():TypeInformation[]{
        var rs=super.meta();
        var hasKp=false;
        this.superTypes().forEach(x=>{
            x.meta().forEach(m=>{
                if (m instanceof KnownPropertyRestriction){
                    if (hasKp){
                        return;
                    }
                    var kp=new KnownPropertyRestriction(false);
                    kp.patchOwner(this);
                    rs.push(kp);
                    return;
                }
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
        if (t.nullable){
            this.nullable=true;
        }
    }

    label(){
        var cmp:ComponentShouldBeOfType[] = <ComponentShouldBeOfType[]>this.metaOfType(ComponentShouldBeOfType);
        if(cmp.length>0){
            return cmp[0].value().label()+"[]";
        }
        return super.label();
    }
    
    contextMeta():restr.MatchesProperty{
        return this._contextMeta;
    }
    
    setContextMeta(contextMeta:restr.MatchesProperty){
        this._contextMeta = contextMeta;
    }
    
    patch(another:InheritedType){
        for (var prop in another) {
            if (another.hasOwnProperty(prop)) {
                (<any>this)[prop] = (<any>another)[prop];
            }
        }
        this.metaInfo.filter(m=>m._owner === another).forEach(m=>m._owner = this)
        for(let i = 0 ; i < this._superTypes.length; i++){
            var st = this._superTypes[i];
            if(st == this || st.allSuperTypes().indexOf(this)>=0){
                this._superTypes[i] = RECURRENT;
            }
        }
    }

}
export abstract class DerivedType extends AbstractType
        implements tsInterfaces.IDerivedType{

    constructor(name: string,private _options:AbstractType[]){
        super(name);
    }

    private static CLASS_IDENTIFIER_DerivedType = "typesystem.DerivedType";

    public getClassIdentifier() : string[] {
        var superIdentifiers:string[] = super.getClassIdentifier();
        return superIdentifiers.concat(DerivedType.CLASS_IDENTIFIER_DerivedType);
    }

    public static isInstance(instance: any): instance is DerivedType {
        return instance != null && instance.getClassIdentifier
            && typeof(instance.getClassIdentifier) == "function"
            && _.contains(instance.getClassIdentifier(), DerivedType.CLASS_IDENTIFIER_DerivedType);
    }

    cloneWithFilter(x: (y: TypeInformation, transformed?: tsInterfaces.IParsedType) => boolean|TypeInformation,
                    f?: (t: tsInterfaces.IParsedType) => tsInterfaces.IParsedType): AbstractType {
        var c = this.clone();
        var ms: TypeInformation[] = [];
        if (f) {
            (<DerivedType>c)._options = <any>this.options().map(t => f(t));
        }
        this.metaInfo.forEach(f => {
            var rs = x(f, c);
            if (typeof rs == "boolean") {
                if (rs) {
                    ms.push(f);
                }
            }
            else {
                if (rs) {
                    ms.push(<TypeInformation>rs);
                }
            }
        });
        (<DerivedType>c).metaInfo = ms;
        return c;
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
    options():AbstractType[]{
        return this._options;
    }

}
export class UnionType extends DerivedType{

    private static CLASS_IDENTIFIER_UnionType = "typesystem.UnionType";

    public getClassIdentifier() : string[] {
        var superIdentifiers:string[] = super.getClassIdentifier();
        return superIdentifiers.concat(UnionType.CLASS_IDENTIFIER_UnionType);
    }

    public static isInstance(instance: any): instance is UnionType {
        return instance != null && instance.getClassIdentifier
            && typeof(instance.getClassIdentifier) == "function"
            && _.contains(instance.getClassIdentifier(), UnionType.CLASS_IDENTIFIER_UnionType);
    }

    kind(){
        return "union"
    }
    clone() {
        return new UnionType(this.name(), this.options());
    }
    constructor(name: string, _options:AbstractType[]){
        super(name,_options);
        this.options().forEach(x=>{
            if (x.nullable){
                this.nullable=true;
            }
        })
    }
    isSubTypeOf(t:AbstractType):boolean{
        var isSubType=true;
        this.allOptions().forEach(x=>{
            if (!x.isSubTypeOf(t)){
                isSubType=false
            }
        })
        return isSubType;
        //return t===ANY||this===t|| this.superTypes().some(x=>x.isSubTypeOf(t));
    }

    validate(i:any):Status{
        return this.validateDirect(i);
    }

    public typeFamily():AbstractType[] {
        var res:AbstractType[]=[];
        this.allOptions().forEach(x=>{
            res=res.concat(x.typeFamily());
        });
        return res;
    }
    knownProperties():MatchesProperty[]{
        var vs= <MatchesProperty[]>this.metaOfType(<any>MatchesProperty);
        this.options().forEach(x=>{
            vs=vs.concat(x.knownProperties());
        })
        return vs;
    }

    validateDirect(i:any,autoClose:boolean=false):Status {

        var result=new Status(Status.OK,"","",this);
        this.restrictions().forEach(x=>result.addSubStatus(x.check(i,null)));
        return result;
    }

    isUnion(){
        return true;
    }

    isObject(){
        return _.all(this.allOptions(),x=>x.isObject());
    }

    restrictions(){
        return [new OrRestriction(this.allOptions().map(x=>new AndRestriction(x.restrictions())),
            messageRegistry.UNION_TYPE_FAILURE,
            messageRegistry.UNION_TYPE_FAILURE_DETAILS)]
    }
    label(){
        return this.options().map(x=>x.label()).join("|");
    }
}
export class IntersectionType extends DerivedType{

    private static CLASS_IDENTIFIER_IntersectionType = "typesystem.IntersectionType";

    public getClassIdentifier() : string[] {
        var superIdentifiers:string[] = super.getClassIdentifier();
        return superIdentifiers.concat(IntersectionType.CLASS_IDENTIFIER_IntersectionType);
    }

    public static isInstance(instance: any): instance is IntersectionType {
        return instance != null && instance.getClassIdentifier
            && typeof(instance.getClassIdentifier) == "function"
            && _.contains(instance.getClassIdentifier(), IntersectionType.CLASS_IDENTIFIER_IntersectionType);
    }

    kind(){
        return "intersection";
    }

    clone() {
        return new IntersectionType(this.name(), this.options());
    }

    restrictions(){
        var rs:Constraint[]=[];
        this.allOptions().forEach(x=>{
            if(!x.oneMeta(metaInfo.SkipValidation)) {
                rs = rs.concat(x.restrictions());
            }
        });
        return [new AndRestriction(rs)]
    }

    label(){
        return this.options().map(x=>x.label()).join("&");
    }
    isIntersection(){
        return true;
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
    if (r.isSubTypeOf(NIL)){
        r.nullable=true;
    }
    else if(t.length==1&&t[0]==ANY){
        r.nullable=true;
    }
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
    var d0=t0.oneMeta(metaInfo.Discriminator);
    var d1=t1.oneMeta(metaInfo.Discriminator);
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
            return ok();
        }
        return error(messageRegistry.NOTHING,this);
    }


    requiredType(){
        return ANY;
    }

    facetName(){
        return "nothing";
    }

    value(){
        return "!!!"
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

export abstract class GenericTypeOf extends Constraint{

    private static CLASS_IDENTIFIER_GenericTypeOf = "typesystem.GenericTypeOf";

    public getClassIdentifier() : string[] {
        var superIdentifiers:string[] = super.getClassIdentifier();
        return superIdentifiers.concat(GenericTypeOf.CLASS_IDENTIFIER_GenericTypeOf);
    }

    public static isInstance(instance: any): instance is GenericTypeOf {
        return instance != null && instance.getClassIdentifier
            && typeof(instance.getClassIdentifier) == "function"
            && _.contains(instance.getClassIdentifier(), GenericTypeOf.CLASS_IDENTIFIER_GenericTypeOf);
    }

}

export class TypeOfRestriction extends GenericTypeOf{

    constructor(private val: string){
        super();
    }
    check(i:any):Status {

            var to:string = typeof i;
            if (i===null||i===undefined){
                return ok();
            }
            if (Array.isArray(i)) {
                to = "array";
            }
            if (to === this.val) {
                return ok();
            }
            return error(messageRegistry.TYPE_EXPECTED,this,{
                expectedType: this.val,
                actualType: to
            });

    }

    value(){
        return this.val;
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

    toString(){
        return "should be of type "+this.val;
    }
}
function is_int(value:any){
    if((parseFloat(value) == parseInt(value)) && !isNaN(value)){
        return true;
    } else {
        return false;
    }
}
export class IntegerRestriction extends GenericTypeOf{

    constructor(){
        super();
    }
    check(i:any):Status {
        if (typeof i=="number"&&is_int(i)){
            return ok();
        }
        return error(messageRegistry.INTEGER_EXPECTED,this);
    }

    requiredType(){
        return ANY;
    }
    value(){
        return true;
    }
    facetName(){
        return "should be integer"
    }

    
}
export class NullRestriction extends TypeOfRestriction{

    constructor(){
        super("nil");
    }
    check(i:any):Status {
        if (i===null||i==undefined||i==="null"){
            return ok();
        }
        return error(messageRegistry.NULL_EXPECTED,this);
    }

    requiredType(){
        return ANY;
    }
    facetName(){
        return "should be nil"
    }


}
export class ScalarRestriction extends GenericTypeOf{

    constructor(){
        super();
    }
    check(i:any):Status {
        if (!i){
            return ok();
        }
        if (typeof i==='number'||typeof i==='boolean'||typeof i==='string'){
            return ok();
        }
        return error(messageRegistry.SCALAR_EXPECTED,this);
    }

    requiredType(){
        return ANY;
    }
    facetName(){
        return messageRegistry.SHOULD_BE_SCALAR.message;
    }

    value(){
        return true;
    }
}


export class OrRestriction extends Constraint{

    constructor(private val: Constraint[],private _extraMessage?:any,private _extraOptionMessage?:any){
        super();
    }

    check(i:any,p:tsInterfaces.IValidationPath):Status {
        var cs=new Status(Status.OK,"","",this);
        var results:Status[]=[];
        for (var j=0;j<this.val.length;j++){
            var m=this.val[j].check(i,p);
            if (m.isOk()){
                return ok();
            }
            results.push(m);
        }
        if (results.length>0){
            for(var r of results){
                var ownerName:string = null;
                var src = r.getSource();
                if(src instanceof TypeInformation){
                    var owner = (<TypeInformation>src).owner();
                    if(owner){
                        ownerName = owner.label();
                    }
                }
                r.getErrors().forEach(x=>{
                    var msg = x.getMessage();
                    var code = x.getCode()
                    if(ownerName){
                        msg = `${ownerName}: ${msg}`;
                    }
                    if(this._extraOptionMessage){
                        var st = error(this._extraOptionMessage,this,{msg : msg});
                        msg = st.getMessage();
                        code = st.getCode();
                    }
                    x.setMessage(msg);
                    x.setCode(code);
                    cs.addSubStatus(x)
                });
            }
            if (this._extraMessage){
                var severity = 0;
                results.forEach(x=>severity = Math.max(severity,x.getSeverity()));
                cs.addSubStatus(new Status(severity,this._extraMessage.code,this._extraMessage.message,this));
            }
        }
        return cs;
    }
    value(){
        return this.val.map(x=>x.value());
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
    value(){
        return this.val.map(x=>x.value());
    }
    options(){
        return this.val;
    }
    check(i:any,p:tsInterfaces.IValidationPath):Status {
        for (var j=0;j<this.val.length;j++){
            var st=this.val[j].check(i,p);
            if (!st.isOk()){
                return st;
            }
        }
        return ok();
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
//export const POLYMORPHIC=OBJECT.inherit("polymorphic");

export const ARRAY=ANY.inherit("array");

export const EXTERNAL=ANY.inherit("external");
export const NUMBER=SCALAR.inherit("number");
export const INTEGER=NUMBER.inherit("integer");
export const BOOLEAN=SCALAR.inherit("boolean");
export const STRING=SCALAR.inherit("string");
export const NIL=SCALAR.inherit("nil");
//export const DATE=SCALAR.inherit("date");
export const DATE_ONLY=SCALAR.inherit("date-only");
export const TIME_ONLY=SCALAR.inherit("time-only");
export const DATETIME_ONLY=SCALAR.inherit("datetime-only");
export const DATETIME=SCALAR.inherit("datetime");

export const FILE=SCALAR.inherit("file");
export const NOTHING=new RootType("nothing");
export const UNION=ANY.inherit("union");
export const UNKNOWN=NOTHING.inherit("unknown");
export const REFERENCE=NOTHING.inherit("reference");
export const RECURRENT=NOTHING.inherit("recurrent");


///
//POLYMORPHIC.addMeta(new Polymorphic())
ANY.addMeta(BUILT_IN);
NIL.addMeta(BUILT_IN);
UNION.addMeta(BUILT_IN);
SCALAR.addMeta(BUILT_IN);
OBJECT.addMeta(BUILT_IN);
ARRAY.addMeta(BUILT_IN);
NUMBER.addMeta(BUILT_IN);
INTEGER.addMeta(BUILT_IN);
BOOLEAN.addMeta(BUILT_IN);
STRING.addMeta(BUILT_IN);
EXTERNAL.addMeta(BUILT_IN);
UNKNOWN.addMeta(BUILT_IN);
RECURRENT.addMeta(BUILT_IN);

DATE_ONLY.addMeta(BUILT_IN);
TIME_ONLY.addMeta(BUILT_IN);
DATETIME_ONLY.addMeta(BUILT_IN);
DATETIME.addMeta(BUILT_IN);


FILE.addMeta(BUILT_IN);
//POLYMORPHIC.addMeta(BUILT_IN);
UNKNOWN.addMeta(BUILT_IN);
UNKNOWN.lock();
RECURRENT.addMeta(BUILT_IN);
RECURRENT.lock();
EXTERNAL.lock();
UNION.lock();
REFERENCE.lock();

///lets register all types in registry

registry.addType(ANY);
registry.addType(SCALAR);
registry.addType(OBJECT);
registry.addType(ARRAY);
registry.addType(NUMBER);
registry.addType(INTEGER);
registry.addType(BOOLEAN);
registry.addType(NIL);

registry.addType(STRING);
registry.addType(DATE_ONLY);
registry.addType(TIME_ONLY);
registry.addType(DATETIME_ONLY);
registry.addType(DATETIME);

registry.addType(FILE);
//registry.addType(POLYMORPHIC);

NOTHING.addMeta(new NothingRestriction());
NUMBER.addMeta(new TypeOfRestriction("number"));
NUMBER.addMeta(new FacetDeclaration("format",STRING,true,true));
BOOLEAN.addMeta(new TypeOfRestriction("boolean"));
OBJECT.addMeta(new TypeOfRestriction("object"));
ARRAY.addMeta(new TypeOfRestriction("array"));
STRING.addMeta(new TypeOfRestriction("string"));
INTEGER.addMeta(new IntegerRestriction());
NIL.addMeta(new NullRestriction());

import dt=require("./datetime")

DATE_ONLY.addMeta(new dt.DateOnlyR())
TIME_ONLY.addMeta(new dt.TimeOnlyR())
DATETIME_ONLY.addMeta(new dt.DateTimeOnlyR());
DATETIME.addMeta(new dt.DateTimeR());

FILE.addMeta(new TypeOfRestriction("string"));
var arrayOfString=ARRAY.inherit("");
arrayOfString.addMeta(new ComponentShouldBeOfType(STRING))
FILE.addMeta(new FacetDeclaration("fileTypes",arrayOfString,true,true));
FILE.addMeta(new FacetDeclaration("minLength",INTEGER,true,true));
FILE.addMeta(new FacetDeclaration("maxLength",INTEGER,true,true));
DATETIME.addMeta(new FacetDeclaration("format",STRING,true,true));
NIL.nullable=true;
SCALAR.addMeta(new ScalarRestriction());
registry.types().forEach(x=>x.lock())


export class ExternalType extends InheritedType{
    constructor( name: string,private _content:string,private json:boolean,
                 private provider: su.IContentProvider,
                 typeAttributeProvider: su.IContentProvider = null){
        super(name);
        this.addMeta(new restr.MatchToSchema(_content, typeAttributeProvider?typeAttributeProvider:provider));
        this.addSuper(EXTERNAL);
    }

    private static CLASS_IDENTIFIER_ExternalType = "typesystem.ExternalType";

    public getClassIdentifier() : string[] {
        var superIdentifiers:string[] = super.getClassIdentifier();
        return superIdentifiers.concat(ExternalType.CLASS_IDENTIFIER_ExternalType);
    }

    public static isInstance(instance: any): instance is ExternalType {
        return instance != null && instance.getClassIdentifier
            && typeof(instance.getClassIdentifier) == "function"
            && _.contains(instance.getClassIdentifier(), ExternalType.CLASS_IDENTIFIER_ExternalType);
    }

    getContentProvider() {
        return this.provider;
    }

    setContentProvider(provider: su.IContentProvider) {
        this.provider = provider;
    }

    kind():string{
        return "external";
    }
    isJSON(){
        return this.json;
    }

    schema(){
        return this._content;
    }

}

export function typePath(t:AbstractType):string[]{
    var arr:string[] = [];
    while(t != null){
        if(t.name()==null) {
            if (t instanceof InheritedType) {
                var contextMeta = (<InheritedType>t).contextMeta();
                if (contextMeta != null) {
                    arr.push(contextMeta.path());
                    t = contextMeta._owner;
                }
                else {
                    break;
                }
            }
            else {
                break;
            }
        }
        else{
            arr.push(t.name());
            break;
        }
    }
    return arr.reverse();
}

function checkDescriminator(i:any,t:AbstractType,path?:IValidationPath){
    var discriminator = t.metaOfType(metaInfo.Discriminator);
    if(discriminator.length!=0){
        var dName = discriminator[0].value();
        var owner = _.find([t].concat(t.allSuperTypes()),x=>x.getExtra(GLOBAL));
        if(!owner) {
             return null;
        }
        var dVal = owner.name();
        var discriminatorValue = t.metaOfType(metaInfo.DiscriminatorValue);
        if(discriminatorValue.length!=0){
            dVal = discriminatorValue[0].value();
        }
        if(dVal) {
            if (i.hasOwnProperty(dName)) {
                var adVal = i[dName];
                if (adVal != dVal) {
                    var wrng = error(Status.CODE_INCORRECT_DISCRIMINATOR,this,{
                        rootType: owner.name(),
                        value: adVal,
                        propName: dName                        
                    },Status.WARNING);
                    //var wrng = new Status(Status.WARNING, Status.CODE_INCORRECT_DISCRIMINATOR, dVal, this);
                    setValidationPath(wrng,{name: dName, child: path});
                    return wrng;
                }
                return ok();
            }
            else {
                var err = error(Status.CODE_MISSING_DISCRIMINATOR,this,{
                    rootType: owner.name(),
                    propName: dName
                });
                //var err = new Status(Status.ERROR, Status.CODE_MISSING_DISCRIMINATOR, dVal, this);
                setValidationPath(err,path);
                return err;
            }
        }
    }
    else{
        return null;
    }
}

export class ValidationError extends Error{

    private static CLASS_IDENTIFIER_ValidationError = "linter.ValidationError";

    constructor(public messageEntry:any, public parameters:any={}){
        super();
        this.message = messageText(messageEntry,parameters);
        this.getClassIdentifier = ValidationError.prototype.getClassIdentifier;
    }

    public isWarning = false;

    public internalRange: tsInterfaces.RangeObject;

    public internalPath: string;

    public filePath: string;

    public additionalErrors: ValidationError[];

    public getClassIdentifier() : string[] {
        var superIdentifiers:string[] = [];

        return superIdentifiers.concat(ValidationError.CLASS_IDENTIFIER_ValidationError);
    }

    public static isInstance(instance : any) : instance is ValidationError {
        return instance != null && instance.getClassIdentifier
            && typeof(instance.getClassIdentifier) == "function"
            && _.contains(instance.getClassIdentifier(),ValidationError.CLASS_IDENTIFIER_ValidationError);
    }
}

export function setValidationPath(_s:tsInterfaces.IStatus,_c:tsInterfaces.IValidationPath){
    if (_s.getValidationPath()){
        var c=patchPath(_c);
        var m=c;
        while (m.child){
            m= m.child;
        }
        m.child=_s.getValidationPath();
        _s.setValidationPath(c);
    }
    else {
        _s.setValidationPath(_c);
    }
    _s.getSubStatuses().forEach(x=>{
        setValidationPath(x,_c);
    })
}

export function patchPath(p:tsInterfaces.IValidationPath):tsInterfaces.IValidationPath{
    if (!p){
        return null;
    }
    else{
        var c=p;
        var r:tsInterfaces.IValidationPath=null;
        var cp:tsInterfaces.IValidationPath=null;
        while (c){
            if (!r){
                r={name: c.name};
                cp=r;
                c= c.child;
                cp=r;
            }
            else{
                var news= {name: c.name};
                cp.child=news;
                c= c.child;
                cp=news;
            }
        }
        return r;
    }
}



/**
 * A model of annotated RAML type facet
 */
export class AnnotatedFacet implements tsInterfaces.IAnnotatedElement{

    constructor(protected _facet:TypeInformation, protected reg:tsInterfaces.ITypeRegistry){}

    kind():string{ return "AnnotatedFacet"; }

    private _annotations:tsInterfaces.IAnnotationInstance[];

    private _annotationsMap:{[key:string]:tsInterfaces.IAnnotationInstance};

    annotationsMap(): {[key:string]:tsInterfaces.IAnnotationInstance}{
        if(!this._annotationsMap){
            this._annotationsMap = {};
            this.annotations().forEach(x=>this._annotationsMap[x.name()]=x);
        }
        return this._annotationsMap;
    }

    annotations(): tsInterfaces.IAnnotationInstance[]{
        if(!this._annotations){
            this._annotations = this._facet.annotations().map(
                x=>new AnnotationInstance(<tsInterfaces.IAnnotation><any>x,this.reg));
        }
        return this._annotations;
    }

    /**
     * Value of the facet serialized to JSON
     */
    value():any{ return this._facet.value(); }

    /**
     * Facet name
     */
    name():string{ return this._facet.facetName(); }

    /**
     * The facet itself
     */
    entry():tsInterfaces.ITypeFacet{ return this._facet; }
}
import parse = require("./parse");
/**
 * A model of annotated RAML type
 */
export class AnnotatedType implements tsInterfaces.IAnnotatedElement{

    constructor(private _type:AbstractType,protected reg:tsInterfaces.ITypeRegistry){}
    
    private _annotations:tsInterfaces.IAnnotationInstance[];

    private _annotationsMap:{[key:string]:tsInterfaces.IAnnotationInstance};

    kind():string{ return "AnnotatedType"; }

    annotationsMap(): {[key:string]:tsInterfaces.IAnnotationInstance}{
        if(!this._annotationsMap){
            this._annotationsMap = {};
            this.annotations().forEach(x=>{
                var n = x.name();
                var ind = n.lastIndexOf(".");
                if(ind>=0){
                    n = n.substring(ind+1);
                }
                this._annotationsMap[n]=x
            });
        }
        return this._annotationsMap;
    }

    annotations(): tsInterfaces.IAnnotationInstance[]{
        if(!this._annotations){
            this._annotations = this._type.meta().filter(x=>
                x.kind()==tsInterfaces.MetaInformationKind.Annotation).map(
                x=>new AnnotationInstance(<tsInterfaces.IAnnotation><any>x,this.reg));
        }
        return this._annotations;
    }

    /**
     * JSON representation of the type
     */
    value():any{ return parse.storeAsJSON(this._type); }

    /**
     * Type name
     */
    name():string{ return this._type.name(); }

    /**
     * The type itself
     * @returns {IParsedType}
     */
    entry():tsInterfaces.IParsedType{ return this._type; }
}

export class AnnotationInstance implements tsInterfaces.IAnnotationInstance{
    
    constructor(protected actual:tsInterfaces.IAnnotation,reg:tsInterfaces.ITypeRegistry){}

    name():string{
        return this.actual.facetName();
    }

    /**
     * Annotation value
     */
    value():any{
        return this.actual.value();
    }

    /**
     * Annotation definition type
     */
    definition():tsInterfaces.IParsedType{
        var tp=registry.get(this.actual.facetName());
        return tp;
    }

    /**
     * Actual annotation model
     */
    annotation():tsInterfaces.IAnnotation{
        return this.actual;
    }
}


/**
 * Apply registered type validation plugins to the type
 * @param t type to be validated
 * @param reg context type registry
 * @param skipOk whether to omit OK issues
 * @returns an array of {tsInterfaces.IStatus}
 */
export function applyAnnotationValidationPlugins(e:tsInterfaces.IAnnotatedElement):Status[] {

    var plugins = tsInterfaces.getAnnotationValidationPlugins();
    var result:Status[] = [];
    for (var tv of plugins) {
        var issues:tsInterfaces.PluginValidationIssue[] = tv.process(e);
        if (issues) {
            issues.forEach(x=> {
                result.push(toStatus(x,tv.id(),e.entry()));
            });
        }
    }
    return result;
}


/**
 * Apply registered type validation plugins to the type
 * @param t type to be validated
 * @param reg context type registry
 * @param skipOk whether to omit OK issues
 * @returns an array of {tsInterfaces.IStatus}
 */
export function applyTypeValidationPlugins(
    t:tsInterfaces.IParsedType,reg:tsInterfaces.ITypeRegistry):Status[] {

    var plugins = tsInterfaces.getTypeValidationPlugins();
    var result:Status[] = [];
    for (var tv of plugins) {
        var issues:tsInterfaces.PluginValidationIssue[] = tv.process(t,reg);
        if (issues) {
            issues.forEach(x=> {
                result.push(toStatus(x,tv.id(),t));
            });
        }
    }
    return result;
}

function toStatus(pvi:tsInterfaces.PluginValidationIssue,pluginId:string,src:any):Status{
    var severity = pvi.isWarning ? Status.WARNING : Status.ERROR;
    var issueCode = pvi.issueCode || pluginId;
    var message = pvi.message || messageText(messageRegistry.PLUGIN_REPORTS_AN_ERROR, {pluginId: pluginId});
    var status = new Status(severity,issueCode,message,src);
    status.setValidationPath(pvi.path);
    return status;
}

export function toValidationPath(p:string):tsInterfaces.IValidationPath{

    if(!p){
        return null;
    }
    p = p.trim();
    if(p.length==0){
        return null;
    }
    if(p.charAt(0)=="#"){
        p = p.substring(1);
    }
    if(p.charAt(0)=="/"){
        p = p.substring(1);
    }
    if(p.length==0){
        return null;
    }
    let arr = p.split("/");
    let result:IValidationPath = {
        name: arr[0]
    }
    let prev = result;
    for(var i = 1 ; i < arr.length ; i++){
        let vp = {
            name: arr[i]
        }
        prev.child = vp;
        prev = vp;
    }
    return result;
}

export function isUnknown(t:AbstractType):boolean{
    return !t || (t.isSubTypeOf(UNKNOWN)&&!t.oneMeta(metaInfo.SkipValidation));
}