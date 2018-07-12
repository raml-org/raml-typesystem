import ts=require("./typesystem")
export import tsInterfaces=require("./typesystem-interfaces")
import tc=require("./parse")
import fr=require("./facetRegistry")
import {KnownPropertyRestriction} from "./restrictions";
import {Annotation} from "./metainfo";
import {CustomFacet} from "./metainfo";
import {FacetDeclaration} from "./metainfo";
import {Status} from "./typesystem";
import nm=require("./nominals")
export import nominalTypes=require("./nominal-types")
export import nominalInterfaces=require("./nominal-interfaces")
export import typeExpressions=require("./typeExpressionUtil");
import schemaUtil = require('./schemaUtil');

export type IValidationPath = tsInterfaces.IValidationPath;
export type IExample = tsInterfaces.IExample;
export type IAnnotation = tsInterfaces.IAnnotation;
export type IHasExtra = tsInterfaces.IHasExtra;
export type ElementSourceInfo = tsInterfaces.IHasExtra;
export var TOP_LEVEL_EXTRA = tsInterfaces.TOP_LEVEL_EXTRA;
export var DEFINED_IN_TYPES_EXTRA = tsInterfaces.DEFINED_IN_TYPES_EXTRA;
export var USER_DEFINED_EXTRA = tsInterfaces.USER_DEFINED_EXTRA;
export var SOURCE_EXTRA = tsInterfaces.SOURCE_EXTRA;
export let messageRegistry = require("../../resources/errorMessages");

// export function instanceOfHasExtra(instance : nominalTypes.ITypeDefinition) : instance is IHasExtra {
//     returninstance instanceof ts.AbstractType || instance instanceof nominalTypes.AbstractType;
// }

export function getSchemaUtils(): any {
    return schemaUtil;
}

export type IStatus = tsInterfaces.IStatus;
export type ITypeFacet = tsInterfaces.ITypeFacet;
export type IConstraint = tsInterfaces.IConstraint;
export type IParsedTypeCollection = tsInterfaces.IParsedTypeCollection;
export type ITypeRegistry = tsInterfaces.ITypeRegistry;
export type IParsedType = tsInterfaces.IParsedType;
export type IPropertyInfo = tsInterfaces.IPropertyInfo;

export function isParsedType(object : any) : object is IParsedType {
    return object instanceof ts.AbstractType;
}

export interface Open {
    /**
     * this index signature is here to specify that IType can contain unknown user defined facets and annotations
     */
    [name:string]:any
}
/**
 * this interface describes basic layout of JSON type representation,
 * sub interfaces contains documentation about important facets which can be specified for the types extended from related built-in types
 */
export interface IType extends Open {
    /**
     * type expression describing super types or in case of multiple inheritance array of type expressions
     */
        type?: string| string[]

    /**
     * default value for the type
     */
        default?: any

    /**
     * example for the type
     */
    example?: any


    /**
     * human readable description of the type (GitHub Markdown)
     */
    description?: string

    /**
     * human readable short name of the type
     */
    displayName?: string

    /**
     * map of custom facets declarations
     */
    facets?:{

        [name:string]:IType
    }

    /**
     * enumeration of possible valid instances for the type
     */
        enum?: any[]

}
/**
 * this interface constains additional properties specific to object types
 */
export interface ObjectType extends IType {

    /**
     * minimum amount of properties which instances of the type should have
     */
    minProperties?: number
    /**
     * maximum amount of properties which instances of the type should have
     */
    maxProperties?: number


    /**
     * if set to true type is threaten as closed type
     */

    closed?: boolean
    /**
     * map of property signatures to the property  declarations
     */
    properties?:{
        [name:string]:IType
    }
    
    /**
     * allows to set constraints on the type of additional properties
     */
    additionalProperties?: boolean
}
/**
 * this interface contains additional properties specific to array types
 */
export interface ArrayType extends IType {

    /**
     * minimum amount of properties which instances of the type should have
     */
    minItems?: number
    /**
     * maximum amount of properties which instances of the type should have
     */
    maxItems?: number

    /**
     * contains description of the component type
     */
    items?: string | IType
}

/**
 * this interface contains additional properties specific to number types
 */
export interface NumberType extends IType {

    /**
     * minimum value for this type
     */
    minimum?: number
    /**
     * maximum value for this type
     */
    maximim?: number

    /**
     * value for multiple of constraint
     */
    multipleOf?: number

}

/**
 * this interface contains additional properties specific to string types
 */
export interface StringType extends IType {

    /**
     * regular expression which all instances of the type should pass
     */
    pattern?: string

    /**
     * minimum length of the string
     */
    minLength?: number

    /**
     * maximum length of the string
     */
    maxLength?: number

}
/**
 * this interface represents JSON representation of the Library
 */
export interface ITypeCollection {

    /**
     * map of annotation type name to annotation type description
     */
    annotationTypes?:{
        [name: string]: IType
    },
    /**
     * map of normal type name to type description
     */
    types?:{

        [name:string]: IType
    }
}
/**
 * loads type collection from JSON type definition
 * @param data
 * @param registry - optional registry of types which ar already known (does not modified during parse)
 * @returns {TypeCollection} returns a new instance of type collection with a parsed types
 */
export function loadTypeCollection(data:ITypeCollection,registry:ITypeRegistry=ts.builtInRegistry()):IParsedTypeCollection {
    return tc.parseJSONTypeCollection(data, <any>registry);
}
/**
 * loads type  from JSON type definition
 * @param data
 * @returns {ts.AbstractType}
 */
export function loadType(data:IType):IParsedType {
    return tc.parseJSON(null, data, ts.builtInRegistry());
}
/**
 * parses a type or type collection definition from a JSON structure
 * @param data
 * @returns {any}
 */
export function parse(data:IType| ITypeCollection):IParsedType|IParsedTypeCollection {
    if ((<any>data)['types'] || (<any>data)['annotationTypes']) {
        return tc.parseJSONTypeCollection(data);
    }
    else {
        return tc.parseJSON(null, data);
    }
}

/**
 * parses a type  from a JSON structure, uses second argument to resolve types
 * @param data
 * @returns {any}
 */
export function parseType(data:IType, collection:IParsedTypeCollection):IParsedType {

   return tc.parseJSON(null, data,collection?<ts.TypeRegistry>collection.getTypeRegistry():ts.builtInRegistry());

}
/**
 * kind of the node
 */
export enum NodeKind{
    SCALAR,
    ARRAY,
    MAP
}

/**
 * node representing an element of abstract syntax tree
 */
export interface IParseNode {

    /**
     * node key
     */
    key():string

    /**
     * node value
     */
    value():any

    /**
     * node children
     */
    children():IParseNode[];

    /**
     * child with a given key
     * @param k
     */
    childWithKey(k:string):IParseNode;

    /**
     * kind of the node
     */
    kind(): NodeKind
}
/**
 * parses type collection definition from a JSON structure
 * @param data
 * @returns {any}
 */
export function parseFromAST(data:IParseNode,ignoreUses=false):IParsedTypeCollection {
     return tc.parseTypeCollection(<any>data, ts.builtInRegistry(),ignoreUses);
}
/**
 * parses type collection definition from a JSON structure
 * @param data
 * @returns {any}
 */
export function parseTypeFromAST(
    name:string,
    data:IParseNode,
    collection:IParsedTypeCollection,
    defaultsToAny:boolean=false,
    annotation:boolean=false,
    global:boolean=true,
    ignoreTypeAttr:boolean=false):IParsedType {
    if(global) {
        var t:IParsedType;
        if (annotation) {
            t = collection.getAnnotationType(name);
        }
        else {
            t = collection.getType(name);
        }
        if (t != null) {
            return t;
        }
    }
    return tc.parse(name,<any>data,collection? <ts.TypeRegistry>collection.getTypeRegistry():ts.builtInRegistry(),defaultsToAny,annotation,global,ignoreTypeAttr, false, []);
}
/**
 * dumps type or type collection to JSON
 * @param ts
 * @returns {IType|ITypeCollection}
 */
export function dump(ts:IParsedType|IParsedTypeCollection):ITypeCollection|IType {
    return tc.storeAsJSON(<any>ts);
}

/**
 * validates intance against the type definition
 * @param i - instance to validate
 * @param t - type definition
 * @returns {IStatus}
 */
export function validate(i:any, t:IParsedType,autoClose:boolean=false):IStatus {
    ts.autoCloseFlag=autoClose;
    try {
        return t.validate(i, autoClose);
    }finally {
        ts.autoCloseFlag = false;
    }
}

/***
 * validates type definition
 * @param t
 * @param collection - collection of the types
 * @returns {IStatus}
 */
export function validateTypeDefinition(t:IParsedType, collection:IParsedTypeCollection):IStatus {
    return t.validateType((<tc.TypeCollection>collection).getAnnotationTypeRegistry());
}

/**
 * performs automatic classification of instance against a given type
 * @param i
 * @param t
 * @returns {IParsedType}
 */
export function performAC(i:any, t:IParsedType):IParsedType {
    return t.ac(i);
}

/**
 * checks if the given type is suitable for automatic classification
 * @param t
 * @returns {Status}
 */
export function checkACStatus(t:IParsedType):IStatus {
    return (<ts.AbstractType>t).canDoAc();
}

export interface IFacetPrototype {
    /**
     *creates brand new instance of facet filled with default values
     */
    newInstance():ITypeFacet

    /**
     * creates a facet filled with a passed value
     * @param v
     */
    createWithValue(v:any):ITypeFacet

    /**
     * checks if the facet represented by this prototype can be added to the given type
     * @param t
     */
    isApplicable(t:IParsedType):boolean

    /**
     * returns true if this facet is inheritable
     */
    isInheritable():boolean

    /**
     * returns true if this facet is a constraint
     */
    isConstraint():boolean

    /**
     * returns true if this facet describes a metadata
     */
    isMeta(): boolean

    /**
     * returns the name of the facet represented by this prototype
     */
    name():string;
}

/**
 * this function allow you to get a list of all built-in facets
 * @returns {FacetPrototype[]}
 */
export function builtInFacets():IFacetPrototype[] {
    return fr.getInstance().allPrototypes();
}

/**
 * returns type registry returning all built in types
 * @returns {TypeRegistry}
 */
export function builtInTypes():ITypeRegistry {
    return ts.builtInRegistry();
}

/**
 * creates a new type by deriving it from a list of super types
 * @returns {IParsedType}
 */
export function derive(name:string, ...types:IParsedType[]):IParsedType {
    return ts.derive(name, <ts.AbstractType[]>types);
}
/**
 * creates a new type by unifying it from a list of possible options
 * @returns {IParsedType}
 */
export function unify(name:string, ...types:IParsedType[]):IParsedType {
    return ts.union(name, <ts.AbstractType[]>types);
}

export class TypeConstructor {
    constructor(private target:IParsedType) {
    }

    /**
     * adds property declaration to the type
     * @param name
     * @param type
     * @param optional
     * @returns {TypeConstructor}
     */
    addProperty(name:string, type:IParsedType, optional:boolean):TypeConstructor {
        (<ts.AbstractType>this.target).declareProperty(name, <ts.AbstractType>type, optional);
        return this;
    }
    
    /**
     * closes type
     * @returns {TypeConstructor}
     */
    closeType():TypeConstructor {
        (<ts.AbstractType>this.target).addMeta(new KnownPropertyRestriction(false));
        return this;
    }

    /**
     * adds annotation to the type
     * @returns {TypeConstructor}
     */
    annotate(name:string, value:any):TypeConstructor {
        (<ts.AbstractType>this.target).addMeta(new Annotation(name, value, `(${value})`));
        return this;
    }

    /**
     * adds custom facet to the type
     * @returns {TypeConstructor}
     */
    customFacet(name:string, value:any):TypeConstructor {
        (<ts.AbstractType>this.target).addMeta(new CustomFacet(name, value));
        return this;
    }

    /**
     * adds custom facet declaration to the type
     * @returns {TypeConstructor}
     */
    customFacetDeclaration(name:string, value:IParsedType, optional:boolean = true):TypeConstructor {
        (<ts.AbstractType>this.target).addMeta(new FacetDeclaration(name, <ts.AbstractType>value, optional));
        return this;
    }

    /**
     * adds a built-in facet with a given name and value
     * @param name
     * @param value
     * @returns {TypeConstructor}
     */
    addSimpleFacet(name:string, value:any):TypeConstructor {
        (<ts.AbstractType>this.target).addMeta(fr.getInstance().buildFacet(name, value));
        return this;
    }

    /**
     * returns a constructed type instance
     * @returns {IParsedType}
     */
    getResult() {
        return this.target;
    }
}

export function setPropertyConstructor(c:any){
    nm.setPropertyConstructor(c);
}
export function toNominal(t:IParsedType,bt: (name:string)=>nominalTypes.ITypeDefinition) :nominalTypes.ITypeDefinition{
     return nm.toNominal(<ts.AbstractType>t,bt);
}

export function toValidationPath(p:string):tsInterfaces.IValidationPath{
    return ts.toValidationPath(p);
}