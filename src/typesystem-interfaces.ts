export interface IValidationPath{
    name: string
    child?:IValidationPath
}

export interface IHasExtra {
    getExtra(name:string) : any;
    putExtra(name:string,value:any) : void;
}

export interface IType {
    id():number;

    kind():string;

    name():string;

    superTypes():IType[];
}

export interface ICloningContext {

    /**
     * Returns cached clone by original.
     * @param original
     */
    getCachedClone(original : any) : any;

    /**
     * Caches clone.
     * @param original
     * @param clone
     */
    cacheClone(original : any, clone : any) : void;
}

export interface ICloneable<Clazz> {

    /**
     * Returns a clone of itself
     * @param context
     */
    clone(context : ICloningContext) : Clazz;
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