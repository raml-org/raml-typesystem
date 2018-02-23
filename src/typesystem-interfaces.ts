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
     * returns true if status does not have errors
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
     * return true if this status is just information
     */
    isInfo():boolean
    /**
     * returns human readable message associated with this status
     */
    getMessage():string

    setMessage(m:string):void;

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

    setValidationPath(p:IValidationPath):void;

    /**
     * returns path to this status
     */
    getValidationPathAsString():string;

    /**
     * Unique identifier
     */
    getCode():string

    setCode(c:string):void;

    getSeverity(): number;

    getInternalRange():RangeObject;

    getInternalPath():IValidationPath;

    getFilePath():string;
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
    DiscriminatorValue,
    SchemaPath,
    SourceMap,
    ParserMetadata,
    ImportedByChain,
    AcceptAllScalarsAsStrings,
    SkipValidation,
    TypeAttributeValue
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

    isConstraint():boolean
}

export interface IConstraint extends ITypeFacet{

    composeWith(r: IConstraint):IConstraint
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

    /**
     * Annotation name
     */
    name():string;

    /**
     * Annotation value
     */
    value(): any;

    /**
     * Annotation definition type
     */
    definition(): IParsedType;
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

    library(name:string):IParsedTypeCollection;

    libraries():{[key:string]:IParsedTypeCollection}

    addLibrary(namespace:string,lib:IParsedTypeCollection):void

    id():string
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

    /**
     * Retrieve type if it is available through a library chain
     * @param name type name
     */
    getByChain(name:string): IParsedType
}


export interface IPropertyInfo {

    name():string;

    required(): boolean

    range(): IParsedType

    declaredAt(): IParsedType

    isPattern(): boolean

    isAdditional(): boolean

    annotations(): IAnnotation[]
}

export interface IAnnotated {

    annotations(): IAnnotation[]

    annotation(name: string): any
}

/**
 * parsed representation of the type
 * you should not create instances of this interfaces manually
 */
export interface IParsedType extends IAnnotated, IHasExtra {

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

    examples(): IExample[]

    allOptions():IParsedType[]

    /**
     * returns full list of known types which inherit from this type.
     * Note: built-in types does not list their not built in sub types
     */
    allSubTypes():IParsedType[]


    /**
     * returns full list of ancestor types
     */

    allSuperTypes():IParsedType[]


    annotations(): IAnnotation[]

    annotation(name: string): any

    declaredAnnotations(): IAnnotation[]

    scalarsAnnotations(): {[key:string]:IAnnotation[][]};

    declaredScalarsAnnotations(): {[key:string]:IAnnotation[][]};

    registry(): IParsedTypeCollection

    isAssignableFrom(t:IParsedType):boolean

    componentType(): IParsedType

    properties(): IPropertyInfo[]

    declaredProperties(): IPropertyInfo[]

    definedFacets(): IPropertyInfo[]

    allDefinedFacets(): IPropertyInfo[]

    property(name: string): IPropertyInfo

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

    allCustomFacets():ITypeFacet[]

    /**
     * returns array of custom facets directly declared on this type
     */
    restrictions():ITypeFacet[]

    /**
     * returns true if this type is anonimous
     */
    isAnonymous(): boolean;
    /**
     * returns true if this type is empty
     */
    isEmpty(): boolean;
    /**
     * returns true if this type inherits from object type
     */
    isObject():boolean
    /**
     * returns true if this type inherits external type
     */
    isExternal():boolean
    /**
     * returns true if this type inherits from string type
     */
    isString():boolean
    /**
     * returns true if this type inherits from number type
     */
    isNumber():boolean

    /**
     * returns true if this type is builtin
     */
    isBuiltin(): boolean;
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
     * returns true if this type is an intersection type
     */
    isIntersection():boolean

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

    /**
     * Straightforward set of components. E.g. for `A|(B|C)` where `A`, `B` and `C`
     * are not union types the result is `[A, B|C]`
     */
    options():IParsedType[]

    cloneWithFilter( x:(y:ITypeFacet,transformed?:IParsedType)=>boolean|ITypeFacet,f?:(t:IParsedType)=>IParsedType):IParsedType;

    kind():string
}

/**
 * Type defined by a set of types, e.g. union or intersection type
 */
export interface IDerivedType extends IParsedType {

    /**
     * Straightforward set of components. E.g. for `A|(B|C)` where `A`, `B` and `C`
     * are not union types the result is `[A, B|C]`
     */
    options():IParsedType[];

    /**
     * Expanded set of components. E.g. for `A|(B|C)` where `A`, `B` and `C`
     * are not union types the result is `[A, B, C]`
     */
    allOptions():IParsedType[];
}

/**
 * A model of custom type validation plugin
 */
export interface ITypeValidationPlugin {

    /**
     * @param t the type to be validated
     * @param reg context type registry
     */
    process(t:IParsedType, reg:ITypeRegistry):PluginValidationIssue[];

    /**
     * String ID of the plugin
     */
    id():string;
}

declare var global: any
/**
 * Retrieve a list of registered type validation plugins
 */
export function getTypeValidationPlugins(): ITypeValidationPlugin[] {
    var rv: any = (<any>global).ramlValidation;
    if (rv) {
        var typeValidators = rv.typeValidators;
        if (Array.isArray(typeValidators)) {
            return <ITypeValidationPlugin[]>typeValidators;
        }
    }
    return [];
}

/**
 * Model of annotation instance used as input fo validation plugins
 */
export interface IAnnotationInstance{

    /**
     * Annotation name
     */
    name():string;

    /**
     * Annotation value
     */
    value():any;

    /**
     * Annotation definition type
     */
    definition():IParsedType;
}

export interface PluginValidationIssue{

    issueCode?:string,
    message?:string,
    isWarning?:boolean
    path?:IValidationPath
}

/**
 * Model of annotation validator for typesystem
 */
export interface IAnnotationValidationPlugin {

    /**
     * validate annotated RAML element
     */
    process(entry:IAnnotatedElement):PluginValidationIssue[];

    /**
     * String ID of the plugin
     */
    id():string;

}


/**
 * A model of annotated RAML element used as input for
 * annotation validation plugins
 */
export interface IAnnotatedElement {

    /**
     * Element kind
     */
    kind():string;

    /**
     * Map view on the annotations applied
     */
    annotationsMap(): {[key:string]:IAnnotationInstance};

    /**
     * Array view on the annotations applied
     */
    annotations(): IAnnotationInstance[];

    /**
     * JSON representation of the entry
     */
    value(): any;

    /**
     * Element name
     */
    name(): string;

    /**
     * The element itself
     */
    entry():any;

}

export interface IExample {

    name(): string

    displayName(): string

    description():string

    strict(): boolean

    value(): any
    annotationsMap(): {
        [key: string]: IAnnotation[];
    };
    annotations(): IAnnotation[];
}


/**
 * Retrieve a list of registered type validation plugins
 */
export function getAnnotationValidationPlugins(): IAnnotationValidationPlugin[] {
    var rv: any = (<any>global).ramlValidation;
    if (rv) {
        var typesystemAnnotationValidators = rv.typesystemAnnotationValidators;
        if (Array.isArray(typesystemAnnotationValidators)) {
            return <IAnnotationValidationPlugin[]>typesystemAnnotationValidators;
        }
    }
    return [];
}


export interface MarkerObject{
    /**
     * Line number, starting from zero
     */
    line: number
    /**
     * Column number, starting from zero
     */
    column: number
    /**
     * Position, starting from zero
     */
    position: number
}

export interface RangeObject{
    start: MarkerObject,
    end: MarkerObject
}

export interface SourceInfo{

    /**
     * Path to file which contains definition
     */
    path?: string

    /**
     * Namespace of defining library if any
     */
    namespace?: string

}

export interface ElementSourceInfo extends SourceInfo{

    /**
     * Source information for fields which are defined in another file rather then their owning component.
     * If all scalar fields of the component are defined in the same file, the 'scalarsSources' field is undefined.
     */
    scalarsSources: { [key:string]:SourceInfo[] }

}

export interface HasSource {

    sourceMap(): ElementSourceInfo
}