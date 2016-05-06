export interface IValidationPath{
    name: string
    child?:IValidationPath
}

export interface IHasExtra {
    getExtra(name:string) : any;
    putExtra(name:string,value:any) : void;
}

export var TOP_LEVEL_EXTRA = "topLevel";
export var DEFINED_IN_TYPES_EXTRA = "definedInTypes";
export var USER_DEFINED_EXTRA = "USER_DEFINED";