let jsonToAST = require("json-to-ast")
let messageRegistry = require("../../resources/errorMessages")
let schemaUtil = require("./schemaUtil")
import tsInterfaces = require("./typesystem-interfaces")

export interface IJSONSchemaError {
    entry:any
    params:any
    path:string
    range:tsInterfaces.RangeObject
    isWarning:boolean
}

class JSONSchemaError implements IJSONSchemaError{
    constructor(
        public entry:any,
        public params:any,
        public path:string,
        public range:tsInterfaces.RangeObject,
        public isWarning:boolean){}
}

export interface JSONSchemaObjectValidator {
    validate(content:String):IJSONSchemaError[]
}

abstract class RecursiveValidator implements JSONSchemaObjectValidator {

    validate(content:string):IJSONSchemaError[] {
        let jsonObj:any = jsonToAST(content, {verbose:true});
        let obj = JSON.parse(content)
        var result:JSONSchemaError[] = []
        this.validateInternal(obj,jsonObj,result,"")
        return result
    }

    private validateInternal(obj:any, rootObj: any, errors:JSONSchemaError[], _jsonPath:string):void {

        let jsonPath = _jsonPath.length==0
            ? ""
            : ((_jsonPath.charAt(_jsonPath.length-1)=="/")
                ? _jsonPath
                : (_jsonPath + "/"))

        this.doValidate(obj,rootObj,jsonPath).forEach(x=>errors.push(x))

        if(typeof obj != "object"){
            return
        }

        Object.keys(obj).forEach(x=>{
            let val=obj[x];
            if (val != null && typeof val == "object" && (x === "properties" || x === "patternProperties")) {
                for (let pName of Object.keys(val)) {
                    let propPath = jsonPath + "properties/" + pName;
                    this.validateInternal(val[pName], rootObj, errors, propPath)
                }
            }
            else if (x === "items" || x === "additionalItems" || x == "additionalProperties") {
                this.validateInternal(val, rootObj, errors, jsonPath + "/" + x)
            }
        })
    }

    protected createError(entry:any, params:any, rootObj:any, jsonPath:string, isWarning:boolean):JSONSchemaError {
        let range = schemaUtil.getJSONRange("", rootObj, jsonPath)
        let result = new JSONSchemaError(entry, params, jsonPath, range, isWarning)
        return result
    }

    protected abstract doValidate(obj:any, rootObj: any, jsonPath:string):JSONSchemaError[]
}

export class Draft4Validator extends RecursiveValidator {

    protected doValidate(obj:any, rootObj: any, jsonPath:string):JSONSchemaError[] {
        let result:JSONSchemaError[] = []
        if(typeof obj != "object" || Array.isArray(obj)){
            return result
        }
        let requiredObj = obj['required']
        if (requiredObj != null && !Array.isArray(requiredObj)) {
            let errPath = jsonPath + "required"
            let err = this.createError(messageRegistry.REQUIRED_MUST_BE_ARRAY_IN_DRAFT_4,{}, rootObj, errPath, false)
            result.push(err)
        }
        return result
    }
}

export class Draft3Validator extends RecursiveValidator {

    protected doValidate(obj:any, rootObj: any, jsonPath:string):JSONSchemaError[] {
        let result: JSONSchemaError[] = []
        if (typeof obj != "object" || Array.isArray(obj)) {
            return result
        }
        let requiredObj = obj['required']
        if (requiredObj != null && typeof requiredObj != "boolean") {
            let errPath = jsonPath + "required"
            let err = this.createError(messageRegistry.REQUIRED_MUST_BE_BOOLEAN_IN_DRAFT_3,{}, rootObj, errPath, false)
            result.push(err)
        }
        return result
    }
}