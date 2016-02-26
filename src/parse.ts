import  ts=require("./typesystem")
import  rs=require("./restrictions")
import {AbstractType} from "./typesystem";
import typeExpressions=require("./typeExpressions")
import facetR=require("./facetRegistry")
import meta=require("./metainfo")
import {Annotation} from "./metainfo";
import {Type} from "typescript";
import {FacetDeclaration} from "./metainfo";
import {HasProperty} from "./restrictions";
import {AdditionalPropertyIs} from "./restrictions";
import {MapPropertyIs} from "./restrictions";
import {TypeRegistry} from "./typesystem";
enum NodeKind{
    SCALAR,
    ARRAY,
    MAP
}

export interface ParseNode {

    key():string

    value():any

    children():ParseNode[];

    childWithKey(k:string):ParseNode;

    kind(): NodeKind
}

class JSObjectNode implements ParseNode{

    constructor(private _key:string,private obj:any){
    }

    value(){
        return this.obj;
    }

    key(){
        return this._key;
    }
    childWithKey(k:string):ParseNode{
        if (this.obj.hasOwnProperty(k)){
            return new JSObjectNode(k,this.obj[k]);
        }
        return null;
    }

    children():JSObjectNode[]{
        if (Array.isArray(this.obj)){
            return (<any[]>this.obj).map(x=>new JSObjectNode(null,x));
        }
        else if (typeof this.obj=="object"){
            return Object.keys(this.obj).map(x=>new JSObjectNode(x,this.obj[x]));
        }
        return []
    }
    kind():NodeKind{
        if (Array.isArray(this.obj)){
            return NodeKind.ARRAY;
        }
        else if (typeof this.obj==="object"){
            return NodeKind.MAP;
        }
        return NodeKind.SCALAR;
    }
}
export function parseJSON(name: string,n:any,r:ts.TypeRegistry=ts.builtInRegistry()):ts.AbstractType {
    return parse(name,new JSObjectNode(null,n),r);
}
export function parseJSONTypeCollection(n:any,r:ts.TypeRegistry=ts.builtInRegistry()):TypeCollection {
    return parseTypeCollection(new JSObjectNode(null,n),r);
}
function isOptional(p:string) {
    return p.charAt(p.length - 1) == '?';
}

export class PropertyBean{
    id: string
    optional: boolean
    additonal: boolean
    regExp: boolean;
    type: ts.AbstractType;

    add(t:ts.AbstractType){
        if (!this.optional&&!this.additonal&&!this.regExp){
            t.addMeta(new rs.HasProperty(this.id));
        }
        if (this.additonal){
            t.addMeta(new rs.AdditionalPropertyIs(this.type));
        }
        else if (this.regExp){
            t.addMeta(new rs.MapPropertyIs(this.id,this.type));
        }
        else{
            t.addMeta(new rs.PropertyIs(this.id,this.type));
        }
    }
}
export class TypeCollection {
    private _types:AbstractType[]=[];
    private _typeMap:{[name:string]:AbstractType}={};


    private _annotationTypes:AbstractType[]=[];
    private _annotationTypeMap:{[name:string]:AbstractType}={};


    add(t:AbstractType){
        this._types.push(t);
        this._typeMap[t.name()]=t;
    }

    getType(name:string){
        if (this._typeMap.hasOwnProperty(name)) {
            return this._typeMap[name];
        }
        return null;
    }

    addAnnotationType(t:AbstractType){
        this._annotationTypes.push(t);
        this._annotationTypeMap[t.name()]=t;
    }

    getAnnotationType(name:string){
        if (this._annotationTypeMap.hasOwnProperty(name)) {
            return this._annotationTypeMap[name];
        }
        return null;
    }

    types(){
        return this._types;
    }
    annotationTypes(){
        return this._annotationTypes;
    }

    getAnnotationTypeRegistry():TypeRegistry{
        var r=new TypeRegistry(ts.builtInRegistry());
        this.annotationTypes().forEach(x=>r.addType(x));
        return r;
    }
}

export class AccumulatingRegistry extends ts.TypeRegistry{


    constructor(private toParse:ParseNode,ts:ts.TypeRegistry){
        super(ts)
    }
    parsing:{ [name:string]:boolean}={};

    get(name: string ):ts.AbstractType{
        var result=super.get(name);
        if (!result){

            var chld=this.toParse.childWithKey(name)
            if (chld){
                if (this.parsing[name]){
                    return ts.derive(name,[ts.RECURRENT]);
                }
                this.parsing[name]=true;
                try {
                    var tp = parse(name, chld, this);
                }
                finally {
                    delete this.parsing[name];
                }
                return tp;
            }
        }
        return result;
    }
}

export function parseTypes(n:any,tr:ts.TypeRegistry=ts.builtInRegistry()):TypeCollection{
    return parseTypeCollection(new JSObjectNode(null,n),tr);
}

export function parseTypeCollection(n:ParseNode,tr:ts.TypeRegistry):TypeCollection{
    var result=new TypeCollection();
    var tpes=n.childWithKey("types");
    var reg=tr;
    if (tpes!=null){
        var ar=new AccumulatingRegistry(tpes,tr)
        tpes.children().forEach(x=>{
            ar.get(x.key());
        });
        ar.types().forEach(x=>result.add(x));
        reg=ar;
    }
    var tpes=n.childWithKey("annotationTypes");
    if (tpes!=null){
        tpes.children().forEach(x=>{
           result.addAnnotationType(parse(x.key(),x,reg))
        });
    }
    return result;
}

export function parsePropertyBean(n:ParseNode,tr:ts.TypeRegistry):PropertyBean{
    var result=new PropertyBean();
    var name:string= n.key();
    if (isOptional(n.key())){
        name=name.substr(0,name.length-1);
        result.optional=true;
    }
    if (name==='[]'){
        result.additonal=true;

    }
    else if (name.charAt(0)=='['&&name.charAt(name.length-1)==']'){
        name=name.substring(1,name.length-1);
        result.regExp=true;
    }
    result.type=parse(null, n,tr);
    result.id=name;
    return result;
}

export class TypeProto{
    name: string

    properties:PropertyBean[];

    basicFacets: ts.TypeInformation[];

    facetDeclarations: meta.FacetDeclaration[]

    annotations: Annotation[]

    customFacets: meta.CustomFacet[]

    notAScalar:boolean

    superTypes: string[]

    toJSON(){
        var result:{ [name:string]:any}={};
        if (this.superTypes&&this.superTypes.length>0){
            if (this.superTypes.length==1){
                result['type']=this.superTypes[0];
            }
            else{
                result['type']=this.superTypes;
            }
        }
        if (this.customFacets){
            this.customFacets.forEach(x=>result[x.facetName()]= x.value());
        }
        if (this.annotations){
            this.annotations.forEach(x=>result["("+x.facetName()+")"]= x.value());
        }

        if (this.facetDeclarations&&this.facetDeclarations.length>0){
            var facets:{ [name:string]:any}={};
            this.facetDeclarations.forEach(x=>{
                var nm= x.facetName();
                if (x.isOptional()){
                    nm=nm+"?";
                }
                var vl:any=null;
                if (x.type().isAnonymous()){
                    if (x.type().isEmpty()) {
                        vl = typeToSignature(x.type());
                    }
                    else{
                        vl=toProto(x.type()).toJSON();
                    }
                }
                else{
                    vl=typeToSignature(x.type());
                }
                facets[nm]=vl;
            });
            result['facets']=facets;
        }
        if (this.properties&&this.properties.length>0){
            var properties:{ [name:string]:any}={};
            this.properties.forEach(x=>{
                var nm= x.id;
                if (x.optional){
                    nm=nm+"?";
                }
                if (x.additonal){
                    nm="[]"
                }
                if (x.regExp){
                    nm="["+nm+"]";
                }
                var vl:any=null;
                if (x.type.isAnonymous()){
                    if (x.type.isEmpty()) {
                        vl = typeToSignature(x.type);
                    }
                    else{
                        vl=toProto(x.type).toJSON();
                    }
                }
                else{
                    vl=typeToSignature(x.type);
                }
                properties[nm]=vl;
            });
            result['properties']=properties;
        }
        if (this.basicFacets) {
            this.basicFacets.forEach(x=> {
                result[x.facetName()] = x.value();
            })
        }
        if (Object.keys(result).length==1&&!this.notAScalar){
            if (result['type']){
                return result['type'];
            }
        }

        return result;
    }
}

export function toProto(type:AbstractType):TypeProto{
    var result:TypeProto=new TypeProto();
    result.name=type.name();
    result.superTypes=type.superTypes().map(x=>typeToSignature(x));
    result.annotations=[];
    result.customFacets=[];
    result.facetDeclarations=[];
    result.basicFacets=[];
    result.properties=[];
    var pmap:{[name:string]:PropertyBean}={}
    type.declaredMeta().forEach(x=>{
        if (x instanceof meta.Annotation){
            result.annotations.push(x);
        }
        else if (x instanceof meta.CustomFacet){
            result.customFacets.push(x);
        }else if (x instanceof meta.NotScalar){
            result.notAScalar=true;
        }
        else if (x instanceof FacetDeclaration){
            result.facetDeclarations.push(x);
        }
        else{
            if (x instanceof rs.HasProperty){
                if (pmap.hasOwnProperty(x.value())){
                    pmap[x.value()].optional=false;
                }
                else{
                    var pbean=new PropertyBean();
                    pbean.optional=false;
                    pbean.id= x.value();
                    pbean.type=ts.ANY;
                    pmap[x.value()]=pbean;
                }
            }
            else if (x instanceof rs.AdditionalPropertyIs){

                var pbean=new PropertyBean();
                pbean.optional=false;
                pbean.id= "[]";
                pbean.additonal=true;
                pbean.type= x.value();
                pmap['[]']=pbean;
            }
            else if (x instanceof rs.MapPropertyIs){
                var pbean=new PropertyBean();
                pbean.optional=false;
                pbean.id= x.regexpValue();
                pbean.regExp=true;
                pbean.type= x.value();
                pmap[x.regexpValue()]=pbean;
            }
            else if (x instanceof rs.PropertyIs){
                if (pmap.hasOwnProperty(x.propertyName())){
                    pmap[x.propertyName()].type= x.value();
                }
                else{
                    var pbean=new PropertyBean();
                    pbean.optional=true;
                    pbean.id= x.propertyName();
                    pbean.type= x.value();
                    pmap[x.propertyName()]=pbean;
                }
            }
            else{

                if (!(x instanceof rs.KnownPropertyRestriction)) {
                    result.basicFacets.push(x);
                }
             }
        }
    })
    Object.keys(pmap).forEach(x=>result.properties.push(pmap[x]));
    return result;
}

/***
 * stores a type to JSON structure
 * @param ts
 */
export function storeAsJSON(ts:AbstractType|TypeCollection) : any{
   if (ts instanceof AbstractType) {
       return toProto(ts).toJSON();
   }
    else{
       return storeTypeCollection(<TypeCollection>ts);
   }
}
function storeTypeCollection(tc:TypeCollection):any{
    var res:any={};
    var types:any={};
    tc.types().forEach(x=>{
        types[x.name()]=storeAsJSON(x);
    })
    if (Object.keys(types).length>0) {
        res["types"] = types;
    }
    var types:any={};
    tc.annotationTypes().forEach(x=>{
        types[x.name()]=storeAsJSON(x);
    })
    if (Object.keys(types).length>0) {
        res["annotationTypes"] = types;
    }
    return res;
}

function typeToSignature(t:ts.AbstractType):string{
    if (t.isAnonymous()){
        if (t.isArray()){
            var ci=t.oneMeta(rs.ComponentShouldBeOfType);
            if (ci){
                var vl=ci.value();
                if (vl.isAnonymous()&&vl.isUnion()){
                    return "("+typeToSignature(vl)+")"+"[]";
                }
                return typeToSignature(vl)+"[]";
            }
        }
        if (t.isUnion()){
            return (<ts.UnionType>t).options().map(x=>typeToSignature(x)).join(" | ");
        }
        return t.superTypes().map(x=>typeToSignature(x)).join(" , ");
    }
    return t.name();
}

/**
 * parses a type from a JSON structure
 * @param name
 * @param n
 * @param r
 * @returns {any}
 */
export function parse(name: string,n:ParseNode,r:ts.TypeRegistry=ts.builtInRegistry()):ts.AbstractType{
    //Build super types.
    if (n.kind()==NodeKind.SCALAR){
        var sp=typeExpressions.parseToType(""+n.value(),r);
        if (name==null){
            return sp;
        }
        var res=ts.derive(name,[sp]);
        if (r instanceof AccumulatingRegistry){
            r.addType(res);
        }
        return res;
    }
    var superTypes:AbstractType[]=[];
    var tp=n.childWithKey("type");
    if (!tp){
        tp=n.childWithKey("schema");
    }
    if (!tp){
        if (n.childWithKey("properties")){
            superTypes=[ts.OBJECT];
        }
        else{
            superTypes=[ts.STRING];
        }
    }
    else{
        if (tp.kind()==NodeKind.SCALAR){
            superTypes=[typeExpressions.parseToType(""+tp.value(),r)];
        }
        else if (tp.kind()==NodeKind.ARRAY){
            superTypes=tp.children().map(x=>x.value()).map(y=>typeExpressions.parseToType(""+y,r));
        }
    }
    var result=ts.derive(name,superTypes);
    if (r instanceof AccumulatingRegistry){
        r.addType(result);
    }
    n.children().forEach(x=>{
        var key = x.key();
        if (key==="type"){
            return;
        }
        if (key=="properties"){
            if (result.isSubTypeOf(ts.OBJECT)){
                return;
            }
        }
        if (key==="facets"){
            return;
        }
        if (key.charAt(0)=='('&& key.charAt(key.length-1)==')'){
            result.addMeta(new meta.Annotation(key.substr(1, key.length-2), x.value()));
            return;
        }
        var vl=facetR.getInstance().buildFacet(key, x.value());
        if (vl&&result.isSubTypeOf(vl.requiredType())){
            result.addMeta(vl);
        }
        else{
            result.addMeta(new meta.CustomFacet(key, x.value()));
        }
    });
    if (result.isSubTypeOf(ts.OBJECT)) {
        var props=n.childWithKey("properties");
        var hasProps=false;
        if (props) {
            if (props.kind() == NodeKind.MAP) {
                props.children().forEach(x=> {
                    hasProps = true;
                    parsePropertyBean(x, r).add(result);
                });
            }
        }

    }
    var props=n.childWithKey("facets");
    if (props){
        if (props.kind()==NodeKind.MAP){
            props.children().forEach(x=>{
                var bean=parsePropertyBean(x,r);
                result.addMeta(new meta.FacetDeclaration(bean.id,bean.type,bean.optional));
            });
        }
    }
    if (result.isAnonymous()&&result.isEmpty()){
        if (result.superTypes().length==1){
            return result.superTypes()[0];
        }
    }
    if (n.kind()!=NodeKind.SCALAR){
        result.addMeta(new meta.NotScalar());
    }
    return result;
}