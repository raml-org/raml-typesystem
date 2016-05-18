import ti = require("./nominal-interfaces")
import tsInterfaces = require("./typesystem-interfaces")
export type IAnnotation=ti.IAnnotation;
export type ITypeDefinition=ti.ITypeDefinition;
export type IExpandableExample=ti.IExpandableExample;
export type IUniverse=ti.IUniverse;
export type IUnionType=ti.IUnionType;
export type IProperty=ti.IProperty;
export type IArrayType=ti.IArrayType;
export type NamedId=ti.NamedId;
export type IExternalType=ti.IExternalType;
export type FacetValidator=ti.FacetValidator;
export type IPrintDetailsSettings=ti.IPrintDetailsSettings;
export type IAnnotationType=ti.IAnnotationType;
export type INamedEntity=ti.INamedEntity;
import _=require("./utils")
import {ICloningContext} from "./typesystem-interfaces";
declare var global:any;
global["extraInjectors"]=[];

declare function require(s:string):any;
export interface Injector{
    inject(a:Adaptable):void;
}
//var extraInjections:Injector[]=[];

export function registerInjector(i:Injector){
  //  extraInjections.push(i);
    global["extraInjectors"].push(i);
}

export class Adaptable{
    private  adapters: any[]=[]

    addAdapter(q: any){
        this.adapters.push(q);
    }

    constructor(){
        (<Injector[]>global["extraInjectors"]).forEach(x=>x.inject(this))

    }

    getAdapter<T>(adapterType:{ new(p?:any): T ;}):T{
        var result:T=null;
        this.adapters.forEach(x=>{
            if (x instanceof adapterType){
                result=<T>x;
            }
        })
        return result;
    }

    getAdapters() : any[] {
        return this.adapters;
    }

    fillClonedInstanceFields(clone : Adaptable, context : tsInterfaces.ICloningContext) {
        clone.adapters = this.adapters?[].concat(this.adapters):[];
    }
}
export class Described extends Adaptable{
    constructor(private _name:string,private _description=""){super()}

    nameId():string{return this._name;}
    description():string{return this._description}

    private _tags:string[]=[]

    private _version:string;

    private _annotations: IAnnotation[]=[]

    addAnnotation(a:IAnnotation){
        this._annotations.push(a);
    }
    removeAnnotation(a: IAnnotation){
        this._annotations=this._annotations.filter(x=>x!=a);
    }

    annotations(){
        return [].concat(this._annotations);
    }

    tags(){
        return this._tags;
    }

    withDescription(d:string){
        this._description=d;
        return this;
    }

    setName(name:string){
        this._name = name;
    }

    fillClonedInstanceFields(clone : Described, context : tsInterfaces.ICloningContext) {
        super.fillClonedInstanceFields(clone, context);

        clone._name = this._name;
        clone._tags = this._tags?[].concat(this._tags):[];
        clone._version = this._version;
        clone._description = this._description;
        clone._annotations = this._annotations?[].concat(this._annotations):[];
    }
}

export class Annotation extends Described implements IAnnotation{

    constructor(private type:IAnnotationType,private parameters: { [name:string]:any}){
        super(type.nameId());
    }

    parameterNames(){
        return Object.keys(this.parameters);
    }
    parameter(name:string):any{
        return this.parameters[name];
    }
    getType(){
        return this.type;
    }
}
export class Empty{

}

class EmptyUniverse implements  IUniverse{

    type(name:string):ITypeDefinition {
        return null;
    }

    version():string {
        return "Empty";
    }

    types():ITypeDefinition[] {
        return [];
    }

    matched():{ [name:string]:NamedId} {
        return {};
    }
}
var emptyUniverse:IUniverse =new EmptyUniverse();

var ebuilder=require("./exampleBuilder")

export class TypeCachingCloningContext implements ICloningContext {

    private nameIdToTypes : {[nameId:string]: AbstractType[]} = {};

    /**
     * Returns cached clone by original.
     * @param original
     */
    getCachedClone(original : any) : any {
        if (!(original instanceof AbstractType)) return null;
        var _original = <AbstractType> original;

        var nameId = _original.nameId();
        var cachedTypes = this.getCachedTypesByNameId(nameId);

        var result = this.findAlreadyCachedType(cachedTypes, _original);
        return result;
    }

    /**
     * Caches clone.
     * @param original
     * @param clone
     */
    cacheClone(original : any, clone : any) : void {
        if (!(clone instanceof AbstractType)) return null;
        var _clone = <AbstractType> clone;

        var nameId = _clone.nameId();
        var cachedTypes = this.getCachedTypesByNameId(nameId);

        var alreadyCachedType = this.findAlreadyCachedType(cachedTypes, _clone);
        if (!alreadyCachedType) {
            cachedTypes.push(_clone);
        }
    }

    private findAlreadyCachedType(alreadyCachedTypes : AbstractType[],
                                  typeToFind : AbstractType) : AbstractType {
        return _.find(alreadyCachedTypes, cachedType=>{
            var rTypeToFind = this.getTypeByNominal(typeToFind);

            var rCurrentCachedType = this.getTypeByNominal(typeToFind);

            if (rTypeToFind == null && rCurrentCachedType == null) {
                var path1 = typeToFind.getPath();
                var path2 = cachedType.getPath();

                return path1 != null && path1 == path2;
            }

            return rTypeToFind != null && rTypeToFind === rCurrentCachedType;
        })
    }

    private getCachedTypesByNameId(nameId : string) : AbstractType[] {
        var cachedTypes = this.nameIdToTypes[nameId];
        if (!cachedTypes) {
            cachedTypes = []
            this.nameIdToTypes[nameId] = cachedTypes;
        }

        return cachedTypes;
    }

    private getTypeByNominal(type : ITypeDefinition) : tsInterfaces.IType {
        if (!(type instanceof AbstractType)) {
            return null;
        }

        return (<AbstractType>type).getTypeAdapter();
    }
}

export class AbstractType extends Described implements ITypeDefinition{

    _key: NamedId;

    _isCustom:boolean

    _customProperties:IProperty[]=[];

    properties():IProperty[]{
        return [];
    }
    externalInHierarchy(){
        var x=this.allSuperTypes();
        var res:ExternalType=null;
        x.forEach(y=>{
            if (y instanceof ExternalType){
                res= (<ExternalType>y);
            }
        });
        return res;
    }
    private _props:IProperty[];
    protected _allFacets:IProperty[]
    protected _facets: IProperty[]=[];

    clone(context : tsInterfaces.ICloningContext) : AbstractType {
        var cached = context != null ? context.getCachedClone(this) : null;

        if (cached) {
            return <AbstractType>cached;
        }
        var result = this.createClonedInstance();
        if(context) context.cacheClone(this, result);
        
        this.fillClonedInstanceFields(result, context);



        return result;
    }

    createClonedInstance() : AbstractType {
        return new AbstractType(this.nameId(), this._universe, this._path);
    }

    fillClonedInstanceFields(clone : AbstractType, context : tsInterfaces.ICloningContext) {
        super.fillClonedInstanceFields(clone, context);

        clone._key = this._key;
        clone._isCustom = this._isCustom;

        clone._customProperties = []
        if (this._customProperties) {
            this._customProperties.forEach(customProperty=>{
                clone._customProperties.push(customProperty.clone(context));
            })
        }

        clone._props = [];
        if (this._props) {
            this._props.forEach(property=>{
                clone._props.push(property.clone(context));
            })
        }

        clone._allFacets = [];
        if (this._allFacets) {
            this._allFacets.forEach(property=>{
                clone._allFacets.push(property.clone(context));
            })
        }

        clone._facets = [];
        if (this._facets) {
            this._facets.forEach(property=>{
                clone._facets.push(property.clone(context));
            })
        }

        clone._validator = this._validator;

        clone._superTypes = [];
        if (this._superTypes) {
            this._superTypes.forEach(property=>{
                clone._superTypes.push(property.clone(context));
            })
        }

        clone._subTypes = []
        //we are intentionally not cloning subtypes as they will most probably be never
        //actually needed, and cloning them requires additional efforts and cycle handling

        clone._requirements = this._requirements;

        clone.fixedFacets = this.fixedFacets;

        clone.uc = this.uc;

        clone._af = this._af;

        clone._nameAtRuntime = this._nameAtRuntime;

        clone._universe = this._universe;

        clone._path = this._path;

        clone.buildIn = this.buildIn;
    }

    addFacet(q:IProperty){
        this._facets.push(q);
    }

    _validator:(x:any)=>ti.Status[]

    validate(x:any):ti.Status[]{
        if (!this._validator){
            throw new Error("Validate can be used only on runtime types instances")
        }
        return this._validator(x)
    }

    allFacets(ps:{[name:string]:ITypeDefinition}={}):IProperty[]{
        if (this._allFacets){
            return this._allFacets;
        }
        if (ps[this.nameId()]){
            return [];
        }
        ps[this.typeId()]=this;
        var n:{[name:string]:IProperty}={}
        if (this.superTypes().length>0){
            this.superTypes().forEach(x=>{
                if (x instanceof AbstractType) {
                    (<AbstractType>x).allFacets(ps).forEach(y=>n[y.nameId()] = <any>y);
                }
            })
        }
        this._facets.forEach(x=>n[x.nameId()]=x);
        //this.properties().forEach(x=>n[x.nameId()]=x);
        this._allFacets=Object.keys(n).map(x=>n[x]);
        return this._allFacets;
    }

    facets():IProperty[]{
        return [].concat(this._facets);
    }

    facet(name: string){
        return _.find(this.allFacets(),x=>x.nameId()==name);
    }

    typeId():string{
        return this.nameId();
    }

    allProperties(ps:{[name:string]:ITypeDefinition}={}):IProperty[]{
        if (this._props){
            return this._props;
        }
        if (ps[this.typeId()]){
            return [];
        }
        ps[this.typeId()]=this;
        var n:{[name:string]:IProperty}={}
        if (this.superTypes().length>0){
            this.superTypes().forEach(x=>{
                if (x instanceof AbstractType) {
                    x.allProperties(ps).forEach(y=>n[y.nameId()] = <any>y);
                }
                else{
                    x.allProperties().forEach(y=>n[y.nameId()] = <any>y);
                }
            })
        }
        for (var x in this.getFixedFacets()){
            delete n[x];
        }
        this.properties().forEach(x=>n[x.nameId()]=x);
        this._props=Object.keys(n).map(x=>n[x]);
        return this._props;
    }

    property(propName:string):IProperty {
        return _.find(this.allProperties(), x=>x.nameId() == propName);
    }
    hasValueTypeInHierarchy(){
        return _.find(this.allSuperTypes(),x=>{
                var mm=<any>x;
                if (mm.uc){
                    return false;
                }
                mm.uc=true;
                try{
                    return x.hasValueTypeInHierarchy()
                }finally{
                    mm.uc=false
                }

            })!=null;
    }
    isAnnotationType(){
        return false;
    }
    hasStructure(){
        return false;
    }



    key (): NamedId{
        if (this._key){
            return this._key;
        }
        if (this._universe) {
            this._key = this.universe().matched()[this.nameId()];
            if (!this._key) {
                return null;
            }
        }
        return this._key;
    }


    _superTypes:ITypeDefinition[]=[];
    _subTypes:ITypeDefinition[]=[];
    _requirements:ti.ValueRequirement[]=[];

    private fixedFacets:{ [name:string]:any}={}


    hasArrayInHierarchy(){
        var arr =_.find(this.allSuperTypes(),x=>x instanceof Array)!=null;
        return arr;
    }
    arrayInHierarchy():IArrayType{
        var x=this.allSuperTypes();
        var res:IArrayType=null;
        x.forEach(y=>{
            if (y instanceof Array){
                res= (<Array>y);
            }
        });
        return res;
    }
    uc:boolean=false;

    unionInHierarchy():IUnionType{
        var x=this.allSuperTypes();
        var res:IUnionType=null;
        x.forEach(y=>{
            if (y instanceof Union){
                res= (<Union>y);
            }
        });
        return res;
    }
    hasExternalInHierarchy(){
        return _.find(this.allSuperTypes(),x=>{
                var mm=<any>x;
                if (mm.uc){
                    return false;
                }
                mm.uc=true;
                try{
                    return x instanceof ExternalType
                }finally{
                    mm.uc=false
                }

            })!=null;

    }

    hasUnionInHierarchy(){
        return _.find(this.allSuperTypes(),x=>{
                var mm=<any>x;
                if (mm.uc){
                    return false;
                }
                mm.uc=true;
                try{
                    return x.hasUnionInHierarchy()
                }finally{
                    mm.uc=false
                }

            })!=null;

    }

    fixFacet(name:string,v: any){
        this.fixedFacets[name]=v;
    }

    protected _af:{ [name:string]:any};

    getFixedFacets():{ [name:string]:any}{
        var mm:{ [name:string]:any}={};
        for (var q in  this.fixedFacets){
            mm[q]=this.fixedFacets[q];
        }
        this.contributeFacets(mm);
        return mm;
    }

    allFixedFacets():{ [name:string]:any}{
        if (this._af){
            return this._af;
        }
        var sp=this.allSuperTypes();
        sp.push(this);
        var mm:{ [name:string]:any}={};
        sp.forEach(x=>{
            var ff = x.getFixedFacets();
            for( var key in Object.keys(ff)){
                mm[key] = ff[key];
            }
        });
        this._af=mm;
        return mm;
    }

    protected contributeFacets(x:{ [name:string]:any}){

    }

    private _nameAtRuntime:string

    getPath(){
        return this._path;
    }

    setNameAtRuntime(name:string){
        this._nameAtRuntime=name;
    }
    getNameAtRuntime(){
        return this._nameAtRuntime;
    }

    constructor(_name:string,public _universe:IUniverse=emptyUniverse ,private _path:string=""){
        super(_name)
    }

    universe():IUniverse{
        if (!this._universe){
            return new EmptyUniverse();
        }
        return this._universe;
    }

    superTypes():ITypeDefinition[]{
        return [].concat(this._superTypes);
    }

    isAssignableFrom(typeName : string) : boolean {
        if (this.nameId() == typeName) {
            if (this.isUserDefined()){
                return false;
            }
            return true;
        }

        var currentSuperTypes = this.allSuperTypes();
        for (var i =0;i<currentSuperTypes.length;i++) {
            if (currentSuperTypes[i].nameId()==typeName) {
                return true;
            }
        }

        return false;
    }
    annotationType():IAnnotationType{
        return null;
    }

    subTypes():ITypeDefinition[]{
        return [].concat(this._subTypes);
    }

    allSubTypes():ITypeDefinition[]{
        var rs:ITypeDefinition[]=[];
        this.subTypes().forEach(x=>{
            rs.push(x);
            rs=rs.concat(x.allSubTypes());
        })
        return _.unique(rs);
    }
    allSuperTypes():ITypeDefinition[]{
        var rs:ITypeDefinition[]=[];
        this.allSuperTypesRecurrent(<any>this,{},rs);
        return _.unique(rs);
    }
    private allSuperTypesRecurrent(t:ITypeDefinition,m:{[name:string]:ITypeDefinition},result:ITypeDefinition[]){
        t.superTypes().forEach(x=>{
            if (!m[(<AbstractType>x).typeId()]) {
                result.push(x);
                m[(<AbstractType>x).typeId()] = x;
                this.allSuperTypesRecurrent(x, m, result);
            }
        })
    }

    addSuperType(q:AbstractType){
        q._subTypes.push(this);
        this._superTypes.push(q);
    }

    addRequirement(name:string,value:string){
        this._requirements.push(new ti.ValueRequirement(name,value))
    }

    //FIXME simplify it
    valueRequirements(){
        return this._requirements;
    }



    requiredProperties():IProperty[]{
        return this.allProperties().filter(x=>x.isRequired());
    }

    printDetails(indent? : string, settings?: IPrintDetailsSettings) : string {
        if (!indent) {
            indent = "";
        }

        if (!settings) {
            settings = {
                hideProperties : false,
                hideSuperTypeProperties : false,
                printStandardSuperclasses : false
            }
        }

        var standardIndent = "  ";

        var result = "";

        var className = this.getTypeClassName();
        result += indent + this.nameId() + "[" + className + "]" + "\n";

        var properties = this.properties();
        if (properties && properties.length > 0 && !settings.hideProperties) {
            result += indent + standardIndent + "Properties:\n";
            properties.forEach(property => {
                var propertyType = "";

                var propertyRange = property.range();
                if (propertyRange instanceof Described) {
                    propertyType += (<any>propertyRange).nameId();
                }

                if (propertyRange instanceof AbstractType) {
                    propertyType += "[";
                    propertyType += (<AbstractType>propertyRange).getTypeClassName();
                    propertyType += "]";
                }

                result += indent + standardIndent + standardIndent + property.nameId() + " : " + propertyType + "\n"
            })
        }

        var superTypes = this.superTypes();
        var filteredSuperTypes = superTypes;

        if (superTypes && !settings.printStandardSuperclasses) {
            filteredSuperTypes = _.filter(superTypes, superType=>{

                var name = superType instanceof Described ? (<any>superType).nameId() : "";
                var type = superType instanceof AbstractType ?
                    (<AbstractType>superType).getTypeClassName() : "";
                return !this.isStandardSuperclass(name, type);

            })
        }

        if (filteredSuperTypes && filteredSuperTypes.length > 0) {
            result += indent + standardIndent + "Super types:\n";
            filteredSuperTypes.forEach(superType=>{
                result += superType.printDetails(indent + standardIndent + standardIndent,
                    {
                        hideProperties : settings.hideSuperTypeProperties,
                        hideSuperTypeProperties : settings.hideSuperTypeProperties,
                        printStandardSuperclasses : settings.printStandardSuperclasses
                    });
            })
        }

        return result;
    }

    private getTypeClassName() : string {
        return this.constructor.toString().match(/\w+/g)[1];
    }
    buildIn:boolean;

    private isStandardSuperclass(nameId : string, className : string) {

        if (nameId === "TypeDeclaration" && className === "NodeClass") return true;
        if (nameId === "ObjectTypeDeclaration" && className === "NodeClass") return true;
        if (nameId === "RAMLLanguageElement" && className === "NodeClass") return true;

        return false;
    }

    /**
     * Returns example for this type.
     * Returned example should be tested for being empty and being expandable.
     */
    examples() : IExpandableExample[] {
        return ebuilder.exampleFromNominal(this);
    }

    /**
     * Returns whether this type contain genuine user defined type in its hierarchy.
     * Genuine user defined type is a type user intentionally defined and filled with
     * properties or facets, or having user-defined name as opposed to a synthetic user-defined type.
     */
    isGenuineUserDefinedType() : boolean {
        if (this.buildIn) return false;

        if (this.properties() && this.properties().length > 0) return true;

        if (this.getFixedFacets() && Object.keys(this.getFixedFacets()).length > 0) return true;

        return this.isTopLevel()&&this.nameId()&&this.nameId().length>0;
    }

    /**
     * Returns nearest genuine user-define type in the hierarchy.
     * Genuine user defined type is a type user intentionally defined and filled with
     * properties or facets, or having user-defined name as opposed to a synthetic user-defined type.
     */
    genuineUserDefinedTypeInHierarchy() : ITypeDefinition {
        if (this.isGenuineUserDefinedType()) return this;

        var result:ITypeDefinition=null;

        var allSuperTypes=this.allSuperTypes();
        allSuperTypes.forEach(currentSuperType=>{
            if (!result && currentSuperType.isGenuineUserDefinedType()){
                result = currentSuperType;
            }
        });

        return result;
    }

    /**
     * Returns whether this type contain genuine user defined type in its hierarchy.
     * Genuine user defined type is a type user intentionally defined and filled with
     * properties or facets, or having user-defined name as opposed to a synthetic user-defined type.
     */
    hasGenuineUserDefinedTypeInHierarchy() : boolean {
        return _.find(this.allSuperTypes(),x=>{
                var mm=<any>x;
                if (mm.uc){
                    return false;
                }
                mm.uc=true;
                try{
                    return x.isGenuineUserDefinedType()
                }finally{
                    mm.uc=false
                }

            })!=null;
    }

    customProperties():IProperty[]{
        return [].concat(this._customProperties)
    }

    allCustomProperties():IProperty[]{
        var props:IProperty[] = [];
        this.superTypes().forEach(x=>props = props.concat((<AbstractType>x).allCustomProperties()));
        props = props.concat(this.customProperties());
        return props;
    }

    registerCustomProperty(p:IProperty){
        if (p.domain()!=this){
            throw new Error("Should be already owned by this");
        }
        if (this._customProperties.indexOf(p)!=-1){
            throw new Error("Already included");
        }
        this._customProperties.push(p);
    }

    setCustom(val:boolean){
        this._isCustom = val;
    }

    isCustom():boolean{
        return this._isCustom;
    }

    isUnion() {
        return false;
    }

    union():IUnionType {
        return null;
    }

    isExternal() {
        return false;
    }

    external():IExternalType{
        return null;
    }

    isArray() {
        return false;
    }

    isObject() {
        if(this.nameId()=="object"){
            return true;
        }
        for(var t of this.allSuperTypes()){
            if(t.isObject()){
                return true;
            }
        }
        return false;
    }

    array():IArrayType {
        return null;
    }

    isValueType() {
        return false;
    }

    kind():string[]{

        var result:string[] = [];
        if(this.isObject()){
            result.push("object");
        }
        if(this.isArray()){
            result.push("array");
        }
        if(this.isValueType()){
            result.push("value");
        }
        if(this.isUnion()){
            result.push("union");
        }
        if(this.isAnnotationType()){
            result.push("annotation");
        }
        if(this.isExternal()){
            result.push("external");
        }
        return result;
    }

    isBuiltIn() {
        return this.buildIn;
    }

    setBuiltIn(builtIn : boolean) {
        this.buildIn = builtIn;
    }

    isTopLevel() : boolean {
        //TODO determine whether "topLevel" actually means a simple top-level type and
        //this flag is absent due to a bug
        if(this.getExtra(tsInterfaces.DEFINED_IN_TYPES_EXTRA) || this.getExtra(tsInterfaces.TOP_LEVEL_EXTRA)) return true;
        return false;
    }

    isUserDefined() : boolean {
        return this.getExtra(tsInterfaces.USER_DEFINED_EXTRA);
    }

    putExtra(extraName: string, value : any) : void {
        var extraAdapter = this.getExtraAdapter();
        if (!extraAdapter) return;

        extraAdapter.putExtra(extraName, value);
    }

    getExtra(name:string) : any {
        var extraAdapter = this.getExtraAdapter();
        if (!extraAdapter) return null;

        return extraAdapter.getExtra(name);
    }

    private getExtraAdapter() : tsInterfaces.IHasExtra {
        if(this.getAdapters()) {
            var extraAdapter = _.find(this.getAdapters(), adapter=>{
                //weird duck-typing, but we cant touch anything from ts types here
                if ((<any>adapter).getExtra && typeof((<any>adapter).getExtra) == "function"
                    && (<any>adapter).putExtra && typeof((<any>adapter).putExtra) == "function") {
                    return true;
                }
            });

            return <tsInterfaces.IHasExtra>extraAdapter;
        }

        return null;
    }

    getTypeAdapter() : tsInterfaces.IType {
        if(this.getAdapters()) {
            var extraAdapter = _.find(this.getAdapters(), adapter=>{
                //weird duck-typing, but we cant touch anything from ts types here
                if ((<any>adapter).id && typeof((<any>adapter).id) == "function"
                    && (<any>adapter).kind && typeof((<any>adapter).kind) == "function"
                    && (<any>adapter).name && typeof((<any>adapter).name) == "function"
                    && (<any>adapter).superTypes && typeof((<any>adapter).superTypes) == "function") {
                    return true;
                }
            });

            return <tsInterfaces.IType>extraAdapter;
        }

        return null;
    }

    visit(visitor : ti.IHierarchyVisitor) : void {
        visitor.typeEncountered(this);

        if (this.superTypes()) {
            this.subTypes().forEach(superType=>superType.visit(visitor));
        }

        if (this.properties()) {
            this.properties().forEach(property=>property.visit(visitor));
        }

        if (this._facets) {
            this._facets.forEach(property=>property.visit(visitor));
        }
    }
}
export class ValueType extends AbstractType implements ITypeDefinition{
    constructor(name:string,_universe:IUniverse=null,path:string="",description=""){
        super(name,_universe,path);
    }
    hasStructure():boolean{
        return false;
    }

    hasValueTypeInHierarchy(){
        return true;
    }

    isValueType() {
        return true;
    }

    isUnionType(){
        return false;
    }

    isObject() {
        return false;
    }

    createClonedInstance() : AbstractType {
        return new ValueType(this.nameId(), this._universe, this.getPath());
    }
}

export class StructuredType extends AbstractType implements ITypeDefinition{
    _properties:IProperty[]=[];

    hasStructure():boolean{
        return true;
    }


    propertyIndex(name:string):number {
        var props = this.properties();
        for(var i=0; i<props.length; i++) {
            if(props[i].nameId() == name) return i;
        }
        return -1;
    }

    addProperty(name:string,range:ITypeDefinition):Property{
        return new Property(name).withDomain(this).withRange(range);
    }

    allPropertyIndex(name:string):number {
        var props = this.allProperties();
        for(var i=0; i<props.length; i++) {
            if(props[i].nameId() == name) return i;
        }
        return -1;
    }

    properties():IProperty[]{
        return [].concat(this._properties)
    }

    registerProperty(p:IProperty){
        if (p.domain()!=this){
            throw new Error("Should be already owned by this");
        }
        if (this._properties.indexOf(p)!=-1){
            throw new Error("Already included");
        }
        this._properties.push(p);
    }

    createClonedInstance() : AbstractType {
        return new StructuredType(this.nameId(), this._universe, this.getPath());
    }

    fillClonedInstanceFields(clone : AbstractType, context : tsInterfaces.ICloningContext) {
        super.fillClonedInstanceFields(clone, context);

        var _clone = <StructuredType> clone;

        _clone._properties = [];
        if (this._properties) {
            this._properties.forEach(property=>{
                var clonedProperty = property.clone(context);
                _clone._properties.push(clonedProperty);
            })
        }
    }
}
export class Property extends Described implements IProperty{

    private _ownerClass:StructuredType
    private _nodeRange:ITypeDefinition;
    protected _groupName:string;
    protected _keyShouldStartFrom:string=null;
    protected _enumOptions:string[];
    private _isRequired:boolean=false;
    private _isMultiValue:boolean=false;
    private _defaultValue:any
    private _descriminates:boolean=false;
    private _defaultBooleanValue:boolean = null;
    private _defaultIntegerValue:number = null;

    withMultiValue(v:boolean=true){
        this._isMultiValue=v;
        return this;
    }
    withDescriminating(b:boolean){
        this._descriminates=b;
        return this;
    }

    withRequired(req:boolean){
        this._isRequired=req;
        return this;
    }
    isRequired(){
        return this._isRequired;
    }
    withKeyRestriction(keyShouldStartFrom:string){
        this._keyShouldStartFrom=keyShouldStartFrom;
        return this;
    }

    withDomain(d:StructuredType,custom:boolean=false):Property{
        this._ownerClass=d;
        if(custom) {
            d.registerCustomProperty(this);
        }
        else{
            d.registerProperty(this);
        }
        return this;
    }
    setDefaultVal(s:any){
        this._defaultValue=s;
        return this;
    }
    setDefaultBooleanVal(s:any){
        this._defaultBooleanValue=s;
        return this;
    }
    setDefaultIntegerVal(s:any){
        this._defaultIntegerValue=s;
        return this;
    }

    defaultValue(){
        if(this._defaultValue != null) {
            return this._defaultValue;
        }
        else if(this._defaultBooleanValue != null) {
            return this._defaultBooleanValue;
        }
        else if(this._defaultIntegerValue != null) {
            return this._defaultIntegerValue;
        }

        return null;
    }
    isPrimitive(){
        return false;
    }
    withRange(t:ITypeDefinition){
        this._nodeRange=t;
        return this;
    }
    isValueProperty(){
        return this._nodeRange.hasValueTypeInHierarchy();
    }

    enumOptions(){
        if (this._enumOptions && typeof this._enumOptions == 'string') {
            return [this._enumOptions + ""];
        }
        return this._enumOptions
    }
    keyPrefix(){
        return this._keyShouldStartFrom
    }
    withEnumOptions(op:string[]){
        this._enumOptions=op;
        return this;
    }
    _keyRegexp:string;
    withKeyRegexp(regexp:string){
        this._keyRegexp=regexp;
        return this;
    }
    getKeyRegexp(){
        return this._keyRegexp
    }

    matchKey(k:string):boolean{
        if (k==null){
            return false;
        }
        if (this._groupName!=null){
            return this._groupName==k;
        }
        else{
            if (this._keyShouldStartFrom!=null){
                if(k.indexOf(this._keyShouldStartFrom)==0){
                    return true;
                }
            }
            if(this._enumOptions){
                if (this._enumOptions.indexOf(k)!=-1){
                    return true;
                }
            }
            if (this.getKeyRegexp()) {
                try {
                    if(new RegExp(this.getKeyRegexp()).test(k)){
                        return true;
                    }
                } catch (Error){
                    //ignoring as the most probable reason for an error is an invalid pattern, we dont want to spam log
                    //with that kind of exceptions
                }
            }
            return false;
        }
    }
    private facetValidator: FacetValidator;

    getFacetValidator(){
        return this.facetValidator;
    }

    setFacetValidator(f: FacetValidator){
        this.facetValidator=f;
    }

    domain():StructuredType{
        return this._ownerClass;
    }
    range():ITypeDefinition{
        return this._nodeRange;
    }

    isMultiValue(){
        if (this.range()&& this.range().hasArrayInHierarchy()){
            return true;
        }
        return this._isMultiValue;
    }
    isDescriminator(){
        return this._descriminates;
    }

    clone(context : tsInterfaces.ICloningContext) : Property {
        var cached  = context != null? context.getCachedClone(this) : null;

        if (cached) return <Property>cached;

        var result = this.createClonedInstance();
        this.fillClonedInstanceFields(result, context);

        if (context) context.cacheClone(this, result);

        return result;
    }

    createClonedInstance() : Property {
        return new Property(this.nameId(), this.description());
    }

    fillClonedInstanceFields(clone : Property, context : tsInterfaces.ICloningContext) {
        super.fillClonedInstanceFields(clone, context);

        if (this._ownerClass) {
            clone._ownerClass = <StructuredType>this._ownerClass.clone(context);
        }

        if (this._nodeRange) {
            clone._nodeRange = this._nodeRange.clone(context);
        }

        clone._groupName = this._groupName;

        clone._keyShouldStartFrom = this._keyShouldStartFrom;

        clone._enumOptions = this._enumOptions;

        clone._isRequired = this._isRequired;

        clone._isMultiValue = this._isMultiValue;

        clone._defaultValue = this._defaultValue;

        clone._descriminates = this._descriminates;

        clone._defaultBooleanValue = this._defaultBooleanValue;

        clone._defaultIntegerValue = this._defaultIntegerValue;

        clone._keyRegexp = this._keyRegexp;

        clone.facetValidator = this.facetValidator;
    }

    visit(visitor : ti.IHierarchyVisitor) : void {
        visitor.propertyEncountered(this, this.domain());

        if (this.range()) {
            this.range().visit(visitor);
        }
    }
}
export class Union extends AbstractType implements IUnionType{

    left:ITypeDefinition;
    right:ITypeDefinition;

    key():NamedId{
        return null;
    }

    leftType():ITypeDefinition{
        return this.left;
    }

    rightType():ITypeDefinition{
        return this.right;
    }

    isUserDefined(): boolean{
        return true;
    }

    unionInHierarchy(){
        return this;
    }

    union() {
        return this;
    }

    hasUnionInHierarchy(){
        return true;
    }

    isUnion() {
        return true;
    }

    isObject() {
        return this.leftType().isObject() && this.rightType().isObject();
    }

    hasArrayInHierarchy(){
        if (this.left&&this.right){
            return this.left.hasArrayInHierarchy()||this.right.hasArrayInHierarchy();
        }
        if (this.left){
            return this.left.hasArrayInHierarchy()
        }
        if (this.right){
            return this.right.hasArrayInHierarchy()
        }
    }

    createClonedInstance() : AbstractType {
        return new Union(this.nameId(), this._universe, this.getPath());
    }

    fillClonedInstanceFields(clone : AbstractType, context : tsInterfaces.ICloningContext) {
        super.fillClonedInstanceFields(clone, context);

        var _clone = <Union>clone;
        if (this.left) {
            _clone.left = this.left.clone(context);
        }

        if (this.right) {
            _clone.right = this.right.clone(context);
        }
    }

    visit(visitor : ti.IHierarchyVisitor) : void {
        super.visit(visitor);

        if (this.left) this.left.visit(visitor);
        if (this.right) this.right.visit(visitor);
    }
}
export class Array extends AbstractType implements IArrayType{
    dimensions: number
    component:ITypeDefinition;

    hasArrayInHierarchy(){
        return true;
    }

    isArray() {
        return true;
    }

    isObject() {
        return false;
    }

    arrayInHierarchy(){
        return this;
    }

    array() {
        return this;
    }

    isUserDefined(): boolean{
        return true;
    }

    componentType(){
        return this.component;
    }

    setComponent(t:ITypeDefinition){
        this.component=t;
    }

    key():NamedId{
        return null;
    }

    createClonedInstance() : AbstractType {
        return new Array(this.nameId(), this._universe, this.getPath());
    }

    fillClonedInstanceFields(clone : AbstractType, context : tsInterfaces.ICloningContext) {
        super.fillClonedInstanceFields(clone, context);

        var _clone = <Array> clone;

        _clone.dimensions = this.dimensions;

        if (this.component) {
            _clone.component = this.component.clone(context);
        }
    }

    visit(visitor : ti.IHierarchyVisitor) : void {
        super.visit(visitor);

        if (this.component) this.component.visit(visitor);
    }
}

export class ExternalType extends StructuredType implements IExternalType{

    schemaString:string;

    externalInHierarchy(){
        return this;
    }
    typeId(){
        return this.schemaString;
    }
    schema(){
        return this.schemaString;
    }

    isUserDefined(): boolean{
        return true;
    }

    hasExternalInHierarchy(){
        return true;
    }

    isExternal() {
        return true;
    }

    external() {
        return this;
    }

    createClonedInstance() : AbstractType {
        return new ExternalType(this.nameId(), this._universe, this.getPath());
    }

    fillClonedInstanceFields(clone : AbstractType, context : tsInterfaces.ICloningContext) {
        super.fillClonedInstanceFields(clone, context);

        var _clone = <ExternalType> clone;

        _clone.schemaString = this.schemaString;
    }
}

