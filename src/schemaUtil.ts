/// <reference path="../typings/main.d.ts" />

var lru=  require("lrucache");
var ZSchema=require("z-schema")


export class ValidationResult{
    result:any;
    num:number;
}

var globalCache=lru(400);
var useLint=true;
export class JSONSchemaObject{

    jsonSchema:any;

    constructor(private schema:string){
        if (!schema||schema.trim().length==0||schema.trim().charAt(0)!='{'){
            throw new Error("Invalid JSON schema content");
        }
        var jsonSchemaObject:any
        try {
            var jsonSchemaObject = JSON.parse(schema);
        }
        catch(err){
            throw new Error("It is not JSON schema");
        }
        if(!jsonSchemaObject){
            return
        }

        try{
            var api = require('json-schema-compatibility');
            jsonSchemaObject =api.v4(jsonSchemaObject);
            //so['$ref']="http://json-schema.org/draft-04/schema#"
        }catch (e){
            throw new Error('Can not parse schema'+schema)
        }

        delete jsonSchemaObject['$schema']
        //delete jsonSchemaObject['required']
        this.jsonSchema=jsonSchemaObject;
    }

    getType() : string {
        return "source.json";
    }
    validateObject (object:any){
        //TODO Validation of objects
        //xmlutil(content);
        this.validate(JSON.stringify(object));
    }

    validate (content:string){
        var key=content+this.schema;
        var c=globalCache.get(key);
        if (c){
            if (c instanceof Error){
                throw c;
            }
            return;
        }
        var validator=new ZSchema();
        var valid = validator.validate(JSON.parse(content), this.jsonSchema);
        var errors:{code:string
            params:string[]
            message:string}[] = validator.getLastErrors();
        if (errors&&errors.length>0){
            var res= new Error("Content is not valid according to schema:"+errors.map(x=>x.message+" "+x.params).join(", "));
            (<any>res).errors=errors;
            globalCache.set(key,res);
            throw res;
        }
        globalCache.set(key,1);

    }
}
export interface ValidationError{
    code:string
    params:string[]
    message:string
    path:string
}

export class XMLSchemaObject{
    constructor(private schema:string){
        if (schema.charAt(0)!='<'){
            throw new Error("Invalid JSON schema")
        }
        //xmlutil(schema);
    }

    getType() : string {
        return "text.xml";
    }

    validate (content:string){

        //xmlutil(content);
    }

    validateObject (object:any){
        //TODO Validation of objects
        //xmlutil(content);
    }
}
export interface Schema {
    getType(): string;
    validate(content: string): void;
    validateObject(object:any):void;
}
export function getJSONSchema(content: string) {
    var rs = useLint ? globalCache.get(content) : false;
    if (rs) {
        return rs;
    }
    var res = new JSONSchemaObject(content);
    globalCache.set(content, res);
    return res;
}

export function getXMLSchema(content: string) {
    var rs = useLint ? globalCache.get(content) : false;
    if (rs) {
        return rs;
    }
    var res = new XMLSchemaObject(content);
    if (useLint) {
        globalCache.set(content, res);
    }
}

export function createSchema(content: string): Schema {

    var rs = useLint ? globalCache.get(content) : false;
    if (rs) {
        return rs;
    }
    try {
        var res: Schema = new JSONSchemaObject(content);
        if (useLint) {
            globalCache.set(content, res);
        }
        return res;
    }
    catch (e) {
        try {
            var res: Schema = new XMLSchemaObject(content);
            if (useLint) {
                globalCache.set(content, res);
            }
            return res;
        }
        catch (e) {
            if (useLint) {
                globalCache.set(content, new Error("Can not parse schema"))
            }
            return null;
        }
    }
}