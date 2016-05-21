export interface IValidationPath{
    name: string
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