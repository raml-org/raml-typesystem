export interface IValidationPath{
    name: string|number
    child?:IValidationPath
}

export interface IHasExtra {
    getExtra(name:string) : any;
    putExtra(name:string,value:any) : void;
}
export const REPEAT = "repeat";
export const PARSE_ERROR = "parseError";
export const TOP_LEVEL_EXTRA = "topLevel";
export const DEFINED_IN_TYPES_EXTRA = "definedInTypes";
export const USER_DEFINED_EXTRA = "USER_DEFINED";
export const SOURCE_EXTRA = "SOURCE";
export const SCHEMA_AND_TYPE_EXTRA="SCHEMA";
export const GLOBAL_EXTRA="GLOBAL";
export const HAS_FACETS="HAS_FACETS";
export const HAS_ITEMS="HAS_ITEMS";

export interface IStatus extends IHasExtra {
    

    /**
     * retur2ns true if status does not have errors
     */
    isOk():boolean

    /**
     * return true if this status contains a warning
     */
    isWarning():boolean
    /**
     * return true if this status contains a error
     */
    isError():boolean
    /**
     * returns human readable message associated with this status
     */
    getMessage():string

    /**
     * returns an array of nested statuses
     */
    getSubStatuses():IStatus[]

    /**
     * return an object which raised this status
     */
    getSource():any

    /**
     * returns primitive error statuses gathered recurrently, returns warnings to.
     */
    getErrors():IStatus[];

    getValidationPath():IValidationPath;

    /**
     * returns path to this status
     */
    getValidationPathAsString():string;

    /**
     * Unique identifier
     */
    getCode():string
}

export enum MetaInformationKind {
    Description,
    NotScalar,
    DisplayName,
    Usage,
    Annotation,
    FacetDeclaration,
    CustomFacet,
    Example,
    Required,
    HasPropertiesFacet,
    AllowedTargets,
    Examples,
    XMLInfo,
    Default,
    Constraint,
    Modifier,
    Discriminator,
    DiscriminatorValue
}

/**
 * this is a common super interface for restrictions and meta data
 */
export interface ITypeFacet {

    /**
     * name of the facet
     */
    facetName():string

    /**
     * broadest type to which this facet can be added
     */
    requiredType():IParsedType

    /**
     * returns a type to which this facet  belongs
     */
    owner():IParsedType

    /**
     * return true if this facet is inheritable
     */
    isInheritable():boolean


    /**
     * validates if the facet is configured properly
     * @param registry
     */
    validateSelf(registry:ITypeRegistry):IStatus

    /**
     * returns value associated with the facet
     */
    value():any

    /**
     * Returns kind of meta-information this instance represents.
     */
    kind() : MetaInformationKind

    /**
     * Annotations applied to the facet
     */
    annotations():IAnnotation[]
}

/**
 * Model of annotation instances applied to types or their facets
 */
export interface IAnnotation extends ITypeFacet {

    /**
     * Returns owner facet for annotations applied to facets
     */
    ownerFacet():ITypeFacet

    /**
     * Returns owner type for annotations applied to types
     */
    owner():IParsedType
}

export interface IParsedTypeCollection {

    /**
     * returns a type for a given name
     * @param name
     */
    getType(name:string):IParsedType
    /**
     * adds a type to collection
     * @param t
     */
    add(t:IParsedType):void

    /**
     * adds annotation type
     * @param t
     */
    addAnnotationType(t:IParsedType):void
    /**
     * returns annotation type for a given name
     * @param name
     */
    getAnnotationType(name:string):IParsedType

    /**
     * lists the types defined in this collection
     */
    types():IParsedType[]
    /**
     * lists annotation types defined in this collection
     */
    annotationTypes():IParsedType[]

    getTypeRegistry():ITypeRegistry;
    getAnnotationTypeRegistry():ITypeRegistry;
}
export  interface ITypeRegistry {

    /**
     * returns a type associated with a given name
     * @param name
     */
    get(name:string):IParsedType

    /**
     * list all types stored in this registry
     */
    types():IParsedType[]
}

/**
 * parsed representation of the type
 * you should not create instances of this interfaces manually
 */
export interface IParsedType extends IHasExtra {

    /**
     * returns  list of directly declared sub types of this type
     */
    subTypes():IParsedType[]
    /**
     * returns  list of directly declared super types of this type
     */
    superTypes():IParsedType[]

    /**
     * name of the type
     */
    name(): string

    /**
     * returns full list of known types which inherit from this type.
     * Note: built-in types does not list their not built in sub types
     */
    allSubTypes():IParsedType[]


    /**
     * returns full list of ancestor types
     */

    allSuperTypes():IParsedType[]

    /**
     * validates a potential instance of type and returns a status describing the results of validation
     * @param i
     */
    validate(i:any,autoClose?:boolean): IStatus

    validateType(reg?:ITypeRegistry):IStatus

    ac(i:any):IParsedType

    canDoAc(i:any):IStatus

    /**
     * returns all meta information and restrictions associated with the type all inheritable facets from super types are included
     */
    allFacets():ITypeFacet[]


    exampleObject(): any
    /**
     * returns  meta information and restrictions associated with the type only declared facets are included
     */
    declaredFacets():ITypeFacet[]

    /**
     * returns array of custom facets directly declared on this type
     */
    customFacets():ITypeFacet[]

    /**
     * returns array of custom facets directly declared on this type
     */
    restrictions():ITypeFacet[]

    /**
     * returns true if this type inherits from object type
     */
    isObject():boolean
    /**
     * returns true if this type inherits from string type
     */
    isString():boolean
    /**
     * returns true if this type inherits from number type
     */
    isNumber():boolean

    /**
     * returns true if this type inherits from boolean type
     */
    isBoolean():boolean
    /**
     * returns true if this type inherits from integer type
     */
    isInteger():boolean
    /**
     * returns true if this type inherits from one of date related types
     */
    isDateTime():boolean

    /**
     * returns true if this type inherits from one of date related types
     */
    isDateOnly():boolean

    /**
     * returns true if this type inherits from one of date related types
     */
    isTimeOnly():boolean

    /**
     * returns true if this type inherits from one of date related types
     */
    isDateTimeOnly():boolean
    /**
     * returns true if this type inherits from array type
     */
    isArray():boolean
    /**
     * returns true if this type inherits from scalar type
     */
    isScalar():boolean

    /**
     * returns true if this type is a union type
     */
    isUnion():boolean

    /**
     * returns true if this type inhetits from an unknown type
     */
    isUnknown(): boolean;

    /**
     * return true if this type inherits from a file type
     */
    isFile():boolean;

    /**
     * returns true if this type has recurrent definition;
     */
    isRecurrent():boolean;
}