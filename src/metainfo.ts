/// <reference path="../typings/main.d.ts" />
import ts=require("./typesystem")


export class MetaInfo extends ts.TypeInformation{


    constructor(private _name: string,private _value: any){
        super(false)
    }

    value(){
        return this._value;
    }

    requiredType(){
        return ts.ANY;
    }
    facetName(){
        return this._name;
    }
}
export class Description extends MetaInfo{

    constructor(value:string){
        super("description",value)
    }
}

export class DisplayName extends MetaInfo{


    constructor(value:string){
        super("displayName",value)
    }
}
export class Annotation extends MetaInfo{

    constructor(name: string,value:string){
        super(name,value)
    }
}
export class Example extends MetaInfo{
    constructor(value:string){
        super("example",value)
    }
}

export class XMLInfo extends MetaInfo{
    constructor(){
        super("xml",this)
    }
}

export class Default extends MetaInfo{

    constructor(value:string){
        super("default",value)
    }

}