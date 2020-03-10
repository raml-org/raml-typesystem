import {XMLSchemaReference} from "raml-xml-validation";
import tsInterfaces = require("./typesystem-interfaces");

declare var global:any;
declare function require(s:string):any;

declare var Promise: any;

import _ = require("./utils");

import xmlUtil = require('./xmlUtil');
import jsonUtil = require('./jsonUtil');

var DOMParser = require('xmldom-alpha').DOMParser;
import ts = require("./typesystem");
import {messageRegistry} from "./typesystem";
var jsonToAST = require("json-to-ast");
import customValidation = require("./jsonSchemaValidation")

export class ValidationResult{
    result:any;
    num:number;
}

var domParserOptions: any = {
    errorHandler:{
        warning:(): any => null,
        error:(): any => null,
        fatalError:(): any => null
    }
}

var useLint=true;

var CACHE_SIZE_BARRIER = 5*1024*1024;

class ErrorsCache {
    errors:{[key:string]:ErrorsEntry} = {};

    last:ErrorsEntry;
    top:ErrorsEntry;
    size:number = 0;

    getValue(key: any): any {
        var e = this.errors[key];
        if(!e){
            return null;
        }
        return e.value;
    }

    setValue(key: any, value: any) {
        var e = this.errors[key];
        if(!e){
            e = {
                key: key,
                value: value
            };
            if(this.top) {
                this.top.next = e;
            }
            this.top = e;
            if(!this.last){
                this.last = e;
            }
            this.errors[key] = e;
            this.size += key.length;
            while(this.size > CACHE_SIZE_BARRIER){
                if(!this.last){
                    break;
                }
                var k = this.last.key;
                delete this.errors[k];
                this.size -= k.length;
                this.last = this.last.next;
            }
        }
        else{
            e.value = value;
        }
    }
}

interface ErrorsEntry{

    value:any;

    key:string;

    next?:ErrorsEntry;
}

var globalCache = new ErrorsCache();

global.cleanCache=function (){
    globalCache=new ErrorsCache();
}

export interface Promise {
    then(instance: any, reject?: any): any;

    resolve(arg: any): any;
}

export interface IContentProvider {
    contextPath(): string;

    normalizePath(url: string): string;

    content(reference: string): string;

    hasAsyncRequests(): boolean;

    resolvePath(context: string, relativePath: string): string;

    isAbsolutePath(uri: string): boolean;

    contentAsync(arg: any): Promise;

    promiseResolve(arg: any): Promise;
}

export interface IExtendedContentProvider extends IContentProvider {

    rootPath():string

    isWebPath(p:string):boolean

    relativePath(from: string, to: string): string;
}

function isExtendedContentProvider(x:IContentProvider){
    const hasRootPath = (<any>x).rootPath != null && (typeof (<any>x).rootPath === "function");
    const hasIsWebPath = (<any>x).isWebPath != null && (typeof (<any>x).isWebPath === "function");
    const hasRelativePath = (<any>x).relativePath != null && (typeof (<any>x).relativePath === "function");
    return hasRootPath && hasIsWebPath && hasRelativePath;
}

class DummyProvider implements  IContentProvider {
    contextPath(): string {
        return "";
    }

    normalizePath(url: string): string {
        return "";
    }

    content(reference: string): string {
        return "";
    }

    hasAsyncRequests(): boolean {
        return false;
    }

    resolvePath(context: string, relativePath: string): string {
        return "";
    }

    isAbsolutePath(uri: string): boolean {
        return false;
    }

    contentAsync(reference: string): Promise {
        return {
            then: arg => arg(this.content(reference)),

            resolve: () => null
        };
    }

    promiseResolve(arg: any): Promise {
        return {
            then: arg1 => arg1(arg),

            resolve: () => null
        }
    }
}

var exampleKey = function (content:any, schema:string, contextPath:string) {
    return "__EXAMPLE_" + (""+content).trim() + schema.trim() + contextPath;
};
export class JSONSchemaObject {
    jsonSchema: any;

    private graph:SchemaGraph;

    private customErrors: customValidation.IJSONSchemaError[] = []

    constructor(private schema:string, private provider: IContentProvider){
        if(!provider) {
            this.provider = new DummyProvider();
        } else {
            this.provider = provider;
        }

        if(!schema||schema.trim().length==0||schema.trim().charAt(0)!='{'){
            throw new ts.ValidationError(messageRegistry.INVALID_JSON_SCHEMA);
        }

        tryParseJSON(schema,false);
        let jsonSchemaObject = JSON.parse(schema);
        if(!jsonSchemaObject){
            return;
        }

        try{
            var api: any = require('json-schema-compatibility');

            const contextPath = this.provider.contextPath();
            this.setupId(jsonSchemaObject, contextPath);
            this.updateGraph(jsonSchemaObject, contextPath);
            var schemaVer=""+jsonSchemaObject["$schema"];
            if (schemaVer.indexOf("http://json-schema.org/draft-04/")==-1){
                this.customErrors = new customValidation.Draft3Validator().validate(schema)
                jsonSchemaObject =api.v4(jsonSchemaObject);
            }
            else{
                this.fixRequired(jsonSchemaObject);
            }
        } catch (e){
            if(ts.ValidationError.isInstance(e)){
                throw e;
            }
            throw new ts.ValidationError(messageRegistry.INVALID_JSON_SCHEMA_DETAILS,{msg:e.message});
        }

        delete jsonSchemaObject['$schema']

        this.jsonSchema=jsonSchemaObject;
    }

    private EXAMPLE_ERROR_ENTRY = messageRegistry.CONTENT_DOES_NOT_MATCH_THE_SCHEMA;

    private SCHEMA_ERROR_ENTRY = messageRegistry.INVALID_JSON_SCHEMA_DETAILS;

    fixRequired(obj:any){
        // Object.keys(obj).forEach(x=>{
        //     var val=obj[x];
        //     if (x==="required"){
        //         if (typeof val==="string"){
        //             obj[x]=[val];
        //         }
        //     }
        //     if (x==="properties"||x==="items"||x==="additionalItems"||x==="patternProperties"){
        //         this.fixRequired(val);
        //     }
        //
        // })
    }

    getType() : string {
        return "source.json";
    }

    validateObject (object:any): any{
        //TODO Validation of objects
        //xmlutil(content);
        this.validate(JSON.stringify(object));
    }

    getMissingReferences(references: any[], normalize: boolean = false): any[] {
        var result: any[] = [];

        var validator = jsonUtil.getValidator();

        references.forEach(reference => validator.setRemoteReference(reference.reference, reference.content || {}));

        var schemaUrl : string = null;
        if (this.jsonSchema.id && typeof(this.jsonSchema.id)==="string") {
            schemaUrl = this.jsonSchema.id;
            var innerPos = schemaUrl.indexOf("#");
            if (innerPos != -1) {
                schemaUrl = schemaUrl.substr(0, innerPos);
            }

            //adding reference to the schema itself
            // validator.setRemoteReference(innerPos, this.jsonSchema);
        }

        try {
            validator.validateSchema(this.jsonSchema);
        } catch (Error) {
            //we should never be exploding here, instead we'll report this error later
            return []
        }

        var result = <any[]>validator.getMissingRemoteReferences();
        var filteredReferences : string[] = [];
        if (result) filteredReferences = _.filter(result, referenceUrl=>{
            return !validator.isResourceLoaded(referenceUrl) && referenceUrl != schemaUrl;
        })

        return normalize ? filteredReferences.map(reference => this.provider.normalizePath(reference)) : filteredReferences;
    }

    private getSchemaPath(schema: any, normalize: boolean = false): string {
        if(!schema) {
            return "";
        }

        if(!schema.id) {
            return "";
        }

        var id = schema.id.trim();

        if(!(id.lastIndexOf('#') === id.length - 1)) {
            return id;
        }

        var result =  id.substr(0, id.length - 1);

        if(!normalize) {
            return result;
        }

        return this.provider.normalizePath(result);
    }

    private patchSchema(schema: any): any {
        if(!schema) {
            return schema;
        }

        if(!schema.id) {
            return schema;
        }

        var id = schema.id.trim();

        if(!(id.lastIndexOf('#') === id.length - 1)) {
            id = id + '#';

            schema.id = id;
        };

        var currentPath = id.substr(0, id.length -1);

        if(!this.provider.isAbsolutePath(currentPath)) {
            return schema;
        }

        currentPath = this.provider.normalizePath(currentPath);

        var refContainers: any[] = [];

        this.collectRefContainers(schema, refContainers);

        refContainers.forEach(refConatiner => {
            var reference = refConatiner['$ref'];

            if(typeof reference !== 'string') {
                return;
            }

            if(reference.indexOf('#') === 0) {
                return;
            }

            if(reference.indexOf('#') === -1) {
                reference = reference + '#';
            }
            let resolvedRef:string;
            if(this.provider.isAbsolutePath(reference)){
                resolvedRef = toProperWebURL(reference);
            }
            else {
                resolvedRef = this.provider.resolvePath(currentPath, reference);
            }
            refConatiner['$ref'] = resolvedRef;
        });
    }

    private removeFragmentPartOfIDs(obj:any){

        if(!obj){
            return;
        }

        if(Array.isArray(obj)){
            obj.forEach((x:any)=>this.removeFragmentPartOfIDs(x));
            return;
        }
        else if(typeof obj != "object"){
            return;
        }

        let idValue = obj.id;
        if(idValue && typeof obj.id=="string"){
            let ind = idValue.indexOf("#");
            if(ind>=0){
                idValue = idValue.substring(0,ind).trim();
                if(!idValue){
                    delete obj.id;
                }
                else{
                    obj.id = idValue;
                }
            }
        }
        Object.keys(obj).forEach(x=>this.removeFragmentPartOfIDs(obj[x]));
    }

    private collectRefContainers(rootObject: any, refContainers: any): void {
        Object.keys(rootObject).forEach(key => {
            if(key === '$ref') {
                refContainers.push(rootObject);

                return;
            }

            if(!rootObject[key]) {
                return;
            }

            if(typeof rootObject[key] === 'object') {
                this.collectRefContainers(rootObject[key], refContainers);
            }
        });
    }

    validate(content: any, alreadyAccepted: any[] = []): void {
        var key = exampleKey(content,this.schema,this.provider.contextPath());

        var error = globalCache.getValue(key);

        if(error) {
            if(error instanceof Error) {
                throw error;
            }

            return;
        }
        else{
            let schKey = exampleKey("__SCHEMA_VALIDATION__",this.schema,this.provider.contextPath());
            let schError = globalCache.getValue(schKey);
            if(schError) {
                if(schError instanceof Error) {
                    if(ts.ValidationError.isInstance(schError)){
                        let ve = <ts.ValidationError>schError;
                        let newVe = new ts.ValidationError(ve.messageEntry,ve.parameters);
                        newVe.filePath = ve.filePath;
                        newVe.additionalErrors = ve.additionalErrors;
                        newVe.internalPath = ve.internalPath;
                        newVe.isWarning = ve.isWarning;
                        schError = newVe;
                    }
                    throw schError;
                }
            }
        }

        if(alreadyAccepted.length==0){
            tryParseJSON(content,true);
            if(this.jsonSchema.id){
                let schemaId = this.jsonSchema.id;
                if(schemaId.charAt(schemaId.length-1)=="#"){
                    let schemaId1 = schemaId.substring(0,schemaId.length-1);
                    alreadyAccepted.push({
                        reference: schemaId1,
                        content: this.jsonSchema
                    });
                }
            }
        }

        let exampleObject = JSON.parse(content);


        var validator = jsonUtil.getValidator();

        alreadyAccepted.forEach(accepted => validator.setRemoteReference(accepted.reference, accepted.content));
        validator.validate(exampleObject, this.jsonSchema);

        var missingReferences = validator.getMissingRemoteReferences().filter((reference: any) => !_.find(alreadyAccepted, (acceptedReference: any) => reference === acceptedReference.reference));

        if(!missingReferences || missingReferences.length === 0) {
            this.acceptErrors(key, validator.getLastErrors(), content, true);
            return;
        }

        var acceptedReferences: any = [];

        missingReferences.forEach((_reference: any) => {
            var remoteSchemeContent: any;

            let reference = decodeURL(_reference);
            var result: any = {reference: _reference};

            try {
                var api = require('json-schema-compatibility');

                let content = this.provider.content(reference);
                tryParseJSON(content,true);
                var jsonObject = JSON.parse(content);

                const nRef = this.provider.normalizePath(reference);
                this.setupId(jsonObject, nRef);
                this.updateGraph(jsonObject, nRef);

                remoteSchemeContent = api.v4(jsonObject);

                delete remoteSchemeContent['$schema'];

                result.content = remoteSchemeContent;
            } catch(exception){
                if(ts.ValidationError.isInstance(exception)){
                    (<ts.ValidationError>exception).filePath = reference;
                    globalCache.setValue(key, exception);
                    throw exception;
                }
                result.error = exception;
            } finally {
                acceptedReferences.push(result);
            }
        });

        if(this.provider.hasAsyncRequests()) {
            return;
        }

        acceptedReferences.forEach((accepted: any) => {
            alreadyAccepted.push(accepted);
        });

        this.validate(content, alreadyAccepted);
    }

    /**
     * Checks for z-schema messages related to the inability to assign to a property of non-object variables.
     * @param message
     *
     * @returns null if related message is not detected, assigned value if it can be detected, and empty string
     * if related message is detected, but assigned value can not be found.
     */
    public static checkIfNonObjectAssignmentFailure(message : string) : string {
        const underscoreValidatedMessage = "__$validated";
        const nonObjectMessage = "called on non-object";

        if (!message) return null;

        if (message.indexOf(underscoreValidatedMessage) != -1) {
            const messageBeginning1 = "Cannot assign to read only property '__$validated' of ";
            const messageBeginning2 = "Cannot create property '__$validated' on string '";
            if(message.indexOf(messageBeginning1) == 0
                && message.length > messageBeginning1.length) {

                return message.substr(messageBeginning1.length,
                    message.length - messageBeginning1.length);

            } else if (message.indexOf(messageBeginning2) == 0
                && message.length > messageBeginning2.length + 1 &&
                message.charAt(message.length-1) == "'") {

                return message.substr(messageBeginning2.length,
                    message.length - messageBeginning2.length - 1);
            }

            return "";
        } else if (message.indexOf(nonObjectMessage) != -1) {
            return "";
        } else {
            return null;
        }
    }

    validateSelf(alreadyAccepted: any[] = []): void {
        var key = exampleKey("__SCHEMA_VALIDATION__",this.schema,this.provider.contextPath());

        var error = globalCache.getValue(key);

        if(error) {
            if(error instanceof Error) {
                throw error;
            }

            return;
        }
        else {

        }

        var validator = jsonUtil.getValidator();
        // if(alreadyAccepted.length==0&&this.jsonSchema.id){
        //     let schemaId = this.jsonSchema.id;
        //     if(schemaId.charAt(schemaId.length-1)=="#"){
        //         let schemaId1 = schemaId.substring(0,schemaId.length-1);
        //         alreadyAccepted.push({
        //             reference: schemaId1,
        //             content: this.jsonSchema
        //         });
        //     }
        // }

        alreadyAccepted.forEach(accepted => validator.setRemoteReference(accepted.reference, accepted.content));

        try {
            delete this.jsonSchema.id;
            validator.validateSchema(this.jsonSchema);
        } catch (error) {
            let illegalRequiredMessageStart = "Cannot assign to read only property '__$validated' of ";

            let nonObjectAssignmentCheck = JSONSchemaObject.checkIfNonObjectAssignmentFailure(error.message);
            if (nonObjectAssignmentCheck !== null) {

                let propertyName = nonObjectAssignmentCheck;

                let message = "Assignment to non-object.";
                if (propertyName) {
                    message = "Unexpected value '" + propertyName + "'"
                }

                this.acceptErrors(key,
                    [{
                        message : message,
                        params:[]
                    }], null, true, true);
            }

            throw error;
        }

        var missingReferences = validator.getMissingRemoteReferences().filter((reference: any) => !_.find(alreadyAccepted, (acceptedReference: any) => reference === acceptedReference.reference));

        if(!missingReferences || missingReferences.length === 0) {
            this.acceptErrors(key, validator.getLastErrors(), null, true, true);

            return;
        }

        var acceptedReferences: any = [];

        missingReferences.forEach((_reference: any,i) => {
            if(i>0){
                return;
            }
            var remoteSchemeContent: any;

            let reference = decodeURL(_reference);
            var result: any = {reference: _reference};

            try {
                var api = require('json-schema-compatibility');

                let content = this.provider.content(reference);
                tryParseJSON(content,true);
                var jsonObject = JSON.parse(content);

                const nRef = this.provider.normalizePath(reference);
                this.setupId(jsonObject, nRef);
                this.updateGraph(jsonObject, nRef);

                remoteSchemeContent = api.v4(jsonObject);

                delete remoteSchemeContent['$schema'];

                result.content = remoteSchemeContent;
            } catch(exception){
                if(ts.ValidationError.isInstance(exception)){
                    (<ts.ValidationError>exception).filePath = reference;
                    globalCache.setValue(key, exception);
                    throw exception;
                }
                result.error = exception;
            } finally {
                acceptedReferences.push(result);
            }
        });

        if(this.provider.hasAsyncRequests()) {
            return;
        }

        acceptedReferences.forEach((accepted: any) => {
            alreadyAccepted.push(accepted);
        });

        this.validateSelf(alreadyAccepted);
    }

    private setupId(json: any, path: string): any {
        if(!path) {
            return;
        }

        if(!json) {
            return;
        }

        this.removeFragmentPartOfIDs(json);

        if(json.id) {
            if(!this.provider.isAbsolutePath(json.id)){
                json.id = this.provider.resolvePath(path,json.id);
            }
        }

        json.id = path.replace(/\\/g,'/');
        if(json.id.charAt(json.id.length-1)!='#') {
            json.id = json.id + '#';
        }
        json.id = toProperWebURL(json.id);
        this.patchSchema(json);
    }

    private acceptErrors(
        key: any,
        errors: any[],
        exampleContent:string,
        throwImmediately = false,
        isWarning=false): void {

        let isExamplesMode = exampleContent != null;
        let jsonContent = exampleContent != null ? exampleContent : this.schema;

        if((errors && errors.length>0) || (exampleContent==null && this.customErrors.length > 0)){

            errors = errors || []
            let jsonObj:any = jsonToAST(jsonContent, {verbose:true});
            let vErrors = errors.map(x=>{
                let regEntry:any;
                let isInFactExampleMode = isExamplesMode && JSONSchemaObject.EXAMPLE_ERROR_CODES[x.code];
                if(isInFactExampleMode){
                    regEntry = this.EXAMPLE_ERROR_ENTRY;
                }
                else{
                    regEntry = this.SCHEMA_ERROR_ENTRY;
                }
                let ve = new ts.ValidationError(regEntry,{ msg : x.message });
                if(isInFactExampleMode || exampleContent==null) {
                    ve.internalRange = getJSONRange(jsonContent, jsonObj, <string>x.path);
                }
                ve.isWarning = isWarning;
                (<any>ve).error = x;
                ve.internalPath = x.path;
                return ve;
            });
            if(exampleContent==null){
                this.customErrors.forEach(ce=>{
                    let ve = new ts.ValidationError(ce.entry, ce.params);
                    ve.internalRange = ce.range
                    ve.isWarning = ce.isWarning;
                    (<any>ve).error = ce;
                    ve.internalPath = ce.path;
                    vErrors.push(ve)
                })
            }
            let res = vErrors[0];
            res.additionalErrors = vErrors.slice(1);
            globalCache.setValue(key, res);
            if(throwImmediately) {
                throw res;
            }
            return;
        }

        globalCache.setValue(key, 1);
    }

    contentAsync(_reference: any): Promise {
        let reference = decodeURL(_reference);
        var remoteSchemeContent: any;

        var api: any = require('json-schema-compatibility');

        var contentPromise = this.provider.contentAsync(reference);

        if(!contentPromise) {
            return this.provider.promiseResolve({
                reference: reference,
                content: null,
                error: new ts.ValidationError(messageRegistry.REFERENCE_NOT_FOUND, {ref:reference})
            });
        }

        var result = contentPromise.then((cnt: any) => {
            var content: any = {reference: _reference};

            try {
                tryParseJSON(cnt,true);
                var jsonObject = JSON.parse(cnt);

                const nRef = this.provider.normalizePath(reference);
                this.setupId(jsonObject, nRef);
                this.updateGraph(jsonObject, nRef);

                remoteSchemeContent = api.v4(jsonObject);

                delete remoteSchemeContent['$schema'];

                content.content = remoteSchemeContent;
            } catch(exception) {
                content.error = exception;
                content.reference = reference;
                throw exception;
            }

            return content;
        });

        return result;
    }

    private static SCHEMA_ERROR_CODES:{[key:string]:boolean} = {
        "KEYWORD_TYPE_EXPECTED": true,
        "KEYWORD_MUST_BE": true,
        "KEYWORD_DEPENDENCY": true,
        "KEYWORD_PATTERN": true,
        "KEYWORD_UNDEFINED_STRICT": true,
        "KEYWORD_VALUE_TYPE": true,
        "CUSTOM_MODE_FORCE_PROPERTIES": true,
        "UNKNOWN_FORMAT": true,
        "PARENT_SCHEMA_VALIDATION_FAILED": true,
        "REF_UNRESOLVED": true,
        "KEYWORD_UNEXPECTED": true,

        "SCHEMA_NOT_AN_OBJECT": true,

        "SCHEMA_NOT_REACHABLE": true,
        "UNRESOLVABLE_REFERENCE": true,
    }

    private static EXAMPLE_ERROR_CODES:{[key:string]:boolean} = {
        "MULTIPLE_OF": true,
        "MAXIMUM": true,
        "MAXIMUM_EXCLUSIVE": true,
        "MAX_LENGTH": true,
        "MIN_LENGTH": true,
        "PATTERN": true,
        "ARRAY_ADDITIONAL_ITEMS": true,
        "ARRAY_LENGTH_LONG": true,
        "ARRAY_LENGTH_SHORT": true,
        "ARRAY_UNIQUE": true,
        "OBJECT_PROPERTIES_MAXIMUM": true,
        "OBJECT_PROPERTIES_MINIMUM": true,
        "OBJECT_MISSING_REQUIRED_PROPERTY": true,
        "OBJECT_ADDITIONAL_PROPERTIES": true,
        "OBJECT_DEPENDENCY_KEY": true,
        "ENUM_MISMATCH": true,
        "ANY_OF_MISSING": true,
        "ONE_OF_MISSING": true,
        "ONE_OF_MULTIPLE": true,
        "NOT_PASSED": true,
        "INVALID_FORMAT": true,
        "UNKNOWN_FORMAT": true,
        "INVALID_TYPE": true,
    }

    private updateGraph(json: any, schemaPath: string){
        if(schemaPath.indexOf("#")<0){
            schemaPath += "#";
        }
        if(!this.graph){
            this.graph = new SchemaGraph(schemaPath);
        }
        let cycle = this.graph.addNode(json,schemaPath);
        if(cycle){
            if(isExtendedContentProvider(this.provider)){
                let ep = <IExtendedContentProvider>this.provider;
                let rootPath = ep.rootPath();
                let rpl = rootPath.length;
                cycle = cycle.map(x=>{
                    let p = x.trim();
                    if(ep.isWebPath(p)){
                        if(ep.isWebPath(rootPath)&&p.length>=rpl&&p.substring(0,rpl)==rootPath){
                            p = p.substring(rpl);
                        }
                    }
                    else{
                        p = ep.relativePath(rootPath,p).replace(/\\/g,"/");
                    }
                    if(p.length && p.charAt(p.length-1)=='#'){
                        p = p.substring(0,p.length-1);
                    }
                    return p;
                });
            }
            let ve = new ts.ValidationError(messageRegistry.CIRCULAR_REFS_IN_JSON_SCHEMA_DETAILS,{
                cycle : cycle.join(" -> ")
            });

            throw ve;
        }
    }
}


function toProperWebURL(p:string):string{
    if(p==null||p.trim().length==0){
        return p;
    }
    let l = "https://".length;
    if(p.length>=l && p.substring(0,l)=="https://"){
        return p;
    }

    p = p.replace("//","__\/DOUBLESLASH\/__");
    p = p.replace(/^([a-zA-Z]):/,'$1__\/COLON\/__');

    let protoclStr = "https://__/APPENDED_PROTOCOL/__";
    if(p.charAt(0)!="/"){
        protoclStr += "/";
    }
    return protoclStr + p;
}

function decodeURL(p:string):string{
    if(p==null||p.trim().length==0){
        return p;
    }
    let protocolStr = "https://__/APPENDED_PROTOCOL/__";
    let l = protocolStr.length;
    if(p.length<l||p.substring(0,l)!=protocolStr){
        return p;
    }
    p = p.substring(l,p.length);
    if(p.indexOf("__/COLON/__")>0&&p.charAt(0)=="/"){
        p = p.substring(1);
    }
    p = p.replace("__/DOUBLESLASH/__","//").replace("__/COLON/__",":");
    return p;
}

export interface ValidationError{
    code:string
    params:string[]
    message:string
    path:string
}
var MAX_EXAMPLES_TRESHOLD=10;
export class XMLSchemaObject {
    private schemaString: string;

    private extraElementData: any = null;

    private namspacePrefix:string;

    references: any = {};

    constructor(private schema:string, private provider: IContentProvider) {
        if(!provider) {
            this.provider = new DummyProvider();
        }

        if(schema.charAt(0)!='<'){
            throw new ts.ValidationError(messageRegistry.INVALID_XML_SCHEMA);
        }

        this.schemaString = this.handleReferenceElement(schema);
    }

    getType() : string {
        return "text.xml";
    }

    private contentToResult:{[content:string]:Error|boolean}={}

    validateObject(object:any): any {
        if(this.extraElementData) {
            var objectName = Object.keys(object)[0];

            var err = new ts.ValidationError(messageRegistry.EXTERNAL_TYPE_ERROR,
                { typeName : this.extraElementData.requestedName, objectName : objectName });

            if(!this.extraElementData.type && !this.extraElementData.originalName) {
                this.acceptErrors("key", [err], true);
                return;
            }

            if(this.extraElementData.originalName && objectName !== this.extraElementData.originalName) {
                this.acceptErrors("key", [err], true);
                return;
            }

            if(this.extraElementData.type) {
                var root = object[objectName];

                delete object[objectName];

                object[this.extraElementData.name] = root;
            }
        }

        this.validate(xmlUtil.jsonToXml(object));
    }

    collectReferences(xmlString: string, context: string, references: any): string {
        var doc: any;

        doc = new DOMParser(domParserOptions).parseFromString(xmlString);

        var schema = elementChildrenByName(doc, 'schema', this.namspacePrefix)[0];

        var imports: any[] = elementChildrenByNameIgnoringNamespace(schema, 'import');
        var includes: any[] = elementChildrenByNameIgnoringNamespace(schema, 'include');

        var refElements: any = imports.concat(includes);

        refElements.forEach((refElement: any) => {
            var refString = refElement.getAttribute('schemaLocation');

            if(refString) {
                var fullPath = this.provider.resolvePath(context, refString);

                var reference: XMLSchemaReference = references[fullPath];

                if(!reference) {
                    var index = Object.keys(references).length;

                    var loadedContent: string = this.provider.content(fullPath);

                    var patchedContent: string;

                    try {
                        patchedContent = this.collectReferences(loadedContent, fullPath, references);
                    } catch(exception) {
                        patchedContent = loadedContent;
                    }

                    reference = xmlUtil.createXmlSchemaReference(fullPath, index, patchedContent);

                    references[fullPath] = reference;
                }

                refElement.setAttribute('schemaLocation', "file_" + reference.virtualIndex + ".xsd");
            }
        });

        return doc.toString();
    }

    getMissingReferences(): string[] {
        var doc: any;

        doc = new DOMParser(domParserOptions).parseFromString(this.schemaString);

        var schema = elementChildrenByName(doc, 'schema', this.namspacePrefix)[0];

        var imports: any[] = elementChildrenByName(schema, 'import', this.namspacePrefix);
        var includes: any[] = elementChildrenByName(schema, 'include', this.namspacePrefix);

        var refElements: any = imports.concat(includes);

        var result: string[] = [];

        refElements.forEach((refElement: any) => {
            var refString = refElement.getAttribute('schemaLocation');

            if(refString) {
                var fullPath = this.provider.resolvePath(this.provider.contextPath(), refString);

                result.push(fullPath);
            }
        });

        return result;
    }

    private collectReferencesAsync(xmlString: string, context: string, references: any): Promise {
        var doc: any;

        doc = new DOMParser(domParserOptions).parseFromString(xmlString);

        var schema = elementChildrenByName(doc, 'schema', this.namspacePrefix)[0];

        var imports: any[] = elementChildrenByNameIgnoringNamespace(schema, 'import');
        var includes: any[] = elementChildrenByNameIgnoringNamespace(schema, 'include');

        var refElements: any = imports.concat(includes);

        return Promise.all(refElements.map((refElement: any) => {
            var refString = refElement.getAttribute('schemaLocation');

            if(refString) {
                var fullPath = this.provider.resolvePath(context, refString);

                var reference: XMLSchemaReference = references[fullPath];

                if(reference) {
                    refElement.setAttribute('schemaLocation', "file_" + reference.virtualIndex + ".xsd");

                    return {};
                }

                return this.provider.contentAsync(fullPath).then((loadedContent: string) => {
                    return this.collectReferencesAsync(loadedContent, fullPath, references).then((patchedContent: string) => {
                        return patchedContent;
                    }, (reject: any) => loadedContent).then((patchedContent: string) => {
                        var index = Object.keys(references).length;

                        reference = xmlUtil.createXmlSchemaReference(fullPath, index, patchedContent);

                        references[fullPath] = reference;

                        refElement.setAttribute('schemaLocation', "file_" + reference.virtualIndex + ".xsd");

                        return {};
                    });
                });
            }

            return {};
        })).then((resolve: any) => Promise.resolve(doc.toString()));
    }

    loadSchemaReferencesAsync(): Promise {
        return this.collectReferencesAsync(this.schemaString, this.provider.contextPath(), {});
    }

    validate(xml: any) {
        try {
            var rs = this.contentToResult[xml];

            if(rs === false) {
                return;
            }

            if(rs) {
                throw rs;
            }

            var references: any = {};

            var patchedSchema = this.collectReferences(this.schemaString, this.provider.contextPath(), references);

            var validator = xmlUtil.getValidator(patchedSchema);

            if(this.provider.hasAsyncRequests()) {
                return;
            }

            var validationErrors = validator.validate(xml, Object.keys(references).map((key: string) => references[key]));

            this.acceptErrors("key", validationErrors, true);

            this.contentToResult[xml]=false;

            if(Object.keys(this.contentToResult).length>MAX_EXAMPLES_TRESHOLD){
                this.contentToResult={}
            }
        } catch (e){
            this.contentToResult[xml]=e;

            throw e;
        }
    }

    private handleReferenceElement(content: string): string {
        var doc = new DOMParser(domParserOptions).parseFromString(content);
        this.namspacePrefix = extractNamespace(doc);

        var schema = elementChildrenByName(doc, 'schema', this.namspacePrefix)[0];

        var elements:any[] = elementChildrenByName(schema, 'element', this.namspacePrefix);

        var element = _.find(elements, (element:any) => element.getAttribute('extraelement') === 'true');

        if(!element) {
            return content;
        }

        var extraElementData: any = {};

        extraElementData.name = element.getAttribute('name');
        extraElementData.type = element.getAttribute('type');
        extraElementData.originalName = element.getAttribute('originalname');
        extraElementData.requestedName = element.getAttribute('requestedname');

        if(!extraElementData.type) {
            schema.removeChild(element);
        }

        element.removeAttribute('originalname');
        element.removeAttribute('requestedname');
        element.removeAttribute('extraelement');

        this.extraElementData = extraElementData;

        return doc.toString();
    }

    private acceptErrors(key: any, errors: any[], throwImmediately = false): void {
        if(errors && errors.length>0){
            var msg = errors.map(x=>x.message).join(", ");
            var res= new ts.ValidationError(messageRegistry.CONTENT_DOES_NOT_MATCH_THE_SCHEMA,{msg : msg});
            (<any>res).errors=errors;

            globalCache.setValue(key, res);

            if(throwImmediately) {
                throw res;
            }

            return;
        }
    }
}
export interface Schema {
    getType(): string;
    validate(content: string): void;
    validateObject(object:any):void;
}
export function getJSONSchema(content: string, provider: IContentProvider) {
    var key = schemaKey(provider, content);
    var rs = useLint ? globalCache.getValue(key) : false;
    if (rs && rs.provider) {
        return rs;
    }
    var res = new JSONSchemaObject(content, provider);
    globalCache.setValue(key, res);
    return res;
}

var schemaKey = function (provider:IContentProvider, content:string) {
    var contextPath = "";
    if (provider) {
        contextPath = provider.contextPath();
    }
    var key = "__SCHEMA_" + (""+content).trim() + contextPath.trim();
    return key;
};
export function getXMLSchema(content: string, provider: IContentProvider) {
    var key = schemaKey(provider, content);
    var rs = useLint ? globalCache.getValue(content) : false;
    if (rs) {
        return rs;
    }
    var res = new XMLSchemaObject(content, provider);

    if (useLint) {
        globalCache.setValue(content, res);
    }

    return res;
}

export function createSchema(content: string, provider: IContentProvider): Schema {

    let isJSON = content && content.trim().length >0 && content.trim().charAt(0)=="{";
    var key = schemaKey(provider, content);
    var rs = useLint ? globalCache.getValue(key) : false;
    if (rs) {
        return rs;
    }
    try {
        var res:Schema = new JSONSchemaObject(content, provider);
        if (useLint) {
            globalCache.setValue(key, res);
        }
        return res;
    }
    catch (e) {
        if (useLint && ts.ValidationError.isInstance(e) && isJSON) {
            globalCache.setValue(key, e);
            return <any>e;
        }
        else {
            try {
                var res: Schema = new XMLSchemaObject(content, provider);
                globalCache.setValue(key, res);
                return res;
            } catch (e) {
                if (useLint) {
                    let rs = new ts.ValidationError(messageRegistry.CAN_NOT_PARSE_SCHEMA);
                    globalCache.setValue(key, rs);
                    return <any>rs;
                }
            }
        }
    }
}


function elementChildrenByNameIgnoringNamespace(parent: any, tagName: string): any[] {

    var elements = parent.getElementsByTagNameNS("*", tagName);

    var result: any[] = [];

    for(var i: number = 0; i < elements.length; i++) {
        var child = elements[i];

        if(child.parentNode === parent) {
            result.push(child);
        }
    }

    return result;
}

function elementChildrenByName(parent: any, tagName: string, ns:string): any[] {

    if(ns==null) {
        ns = extractNamespace(parent);
    }
    if(ns.length>0){
        ns += ":";
    }

    var elements = parent.getElementsByTagName(ns+tagName);

    var result: any[] = [];

    for(var i: number = 0; i < elements.length; i++) {
        var child = elements[i];

        if(child.parentNode === parent) {
            result.push(child);
        }
    }

    return result;
}

function extractNamespace(documentOrElement:any){
    var ns = "";
    if(documentOrElement) {
        var doc = documentOrElement;
        if (documentOrElement.ownerDocument) {
            doc = documentOrElement.ownerDocument;
        }
        if (doc) {
            var docElement = doc.documentElement;
            if (docElement) {
                ns = docElement.prefix;
            }
        }
    }
    return ns;
}

const JSON_TO_AST_MESSAGE1 = "Cannot tokenize symbol";
const JSON_TO_AST_MESSAGE2 = "Unexpected token";

export function messageToValidationError(message:string,isExample=false){

    let regEntry = isExample ? messageRegistry.CAN_NOT_PARSE_JSON
        : messageRegistry.INVALID_JSON_SCHEMA_DETAILS;

    let l1 = JSON_TO_AST_MESSAGE1.length;
    let l2 = JSON_TO_AST_MESSAGE2.length;
    let msg:string,l:number;
    if(message.substring(0,l1)==JSON_TO_AST_MESSAGE1){
        msg = JSON_TO_AST_MESSAGE1;
        l = l1;
    }
    else if(message.substring(0,l2)==JSON_TO_AST_MESSAGE2){
        msg = JSON_TO_AST_MESSAGE2;
        l = l2;
    }
    else{
        return new ts.ValidationError(regEntry,{msg:message});;
    }

    if(msg && l){
        let end = message.indexOf("\n",l);
        if(end<0){
            end = message.length;
        }
        let str = message.substring(l).trim();
        let i0 = str.indexOf("<");
        if(i0<0){
            i0 = 0;
        }
        else{
            i0++;
        }
        let i3 = str.indexOf("\n");
        if(i3<0){ i3 = str.length; }
        let i2 = str.lastIndexOf("at",i3);
        if(i2<0){
            i2 = i3;
        }
        else{
            i2 += "at".length;
        }
        let i1 = str.lastIndexOf(">",i2);
        if(i1<0){ i1 = i2; }
        let ch = str.substring(i0,i1);
        let posStr = str.substring(i2,i3).trim();
        let colonInd = posStr.indexOf(":");
        try{
            let line = parseInt(posStr.substring(0,colonInd))-1;
            let col = parseInt(posStr.substring(colonInd+1,posStr.length))-1;
            let newMessage = `${msg} '${ch}'`;
            let result = new ts.ValidationError(regEntry,{msg:newMessage});
            result.internalRange = {
                start: {
                    line: line,
                    column: col,
                    position: null
                },
                end: {
                    line: line,
                    column: col+ch.length,
                    position: null
                }
            };
            return result;
        }
        catch(err){}
    }
    return new ts.ValidationError(messageRegistry.INVALID_JSON_SCHEMA_DETAILS,{msg:message});;
}

export function getJSONRange(jsonStrig:string, jsonObj:any, jsonPath:string):tsInterfaces.RangeObject{

    if(!jsonPath||typeof jsonPath != "string"){
        return null;
    }
    jsonObj = jsonObj || jsonToAST(jsonStrig,{verbose:true});

    if(jsonPath.charAt(0)=="#"){
        jsonPath = jsonPath.substring(1);
    }
    if(jsonPath.charAt(0)=="/"){
        jsonPath = jsonPath.substring(1);
    }
    let obj = jsonObj;

    if(jsonPath.length>0) {
        let segments = jsonPath.split("/");
        for (var seg of segments) {
            let nextObj = getJOSNValue(obj, seg);
            if(nextObj==null){
                break;
            }
            obj = nextObj;
        }
    }

    let sLoc = obj.loc.start;
    let eLoc = obj.loc.end;

    return {
        start: {
            line: sLoc.line-1,
            column: sLoc.column-1,
            position: sLoc.offset
        },
        end: {
            line: eLoc.line-1,
            column: eLoc.column-1,
            position: eLoc.offset
        }
    }
}

function getJOSNValue(obj:any,key:string):any{
    if(obj.type == "property"){
        obj = obj.value;
    }
    if(obj.type=="object"){
        return _.find(obj.children,x=>(<any>x).key.value==key);
    }
    else if(obj.type=="array"){
        return obj.children[key];
    }
    else if(obj.type=="array"){
        return obj;
    }
    return null;
}

export function tryParseJSON(content: any, isExample:boolean) {
    try {
        if(typeof content != "string"){
            return;
        }
        jsonToAST(content, {verbose: true});
    } catch (err) {
        let ve = messageToValidationError(err.message, isExample);
        throw ve;
    }
}

class RefPath {
    constructor(public segments:string[]){}

    length(){
        return this.segments.length
    }
}

class SchemaNode {

    constructor(public url:string){}

    processed = false;

    refFromRoot:RefPath = new RefPath([])

    refsOut: {[key:string]:RefPath} = {}

    referees: {[key:string]:SchemaNode} = {}
}

class SchemaGraph {

    constructor(public rootPath:string){}

    private nodes:{[key:string]:SchemaNode} = {}

    node(url:string){
        return this.nodes[url];
    }

    addNode(json:any,schemaPath:string):string[]{

        let node = this.nodes[schemaPath];
        if(node){
            if(node.processed){
                return;
            }
        }
        else{
            node = new SchemaNode(schemaPath);
            this.nodes[schemaPath] = node;
        }
        let refs = extractRefs(json);
        let referees = Object.keys(node.referees).map(x=>node.referees[x]);
        let cycle:string[] = null;
        for(let ref of refs){
            const referee = node.referees[ref];
            if(referee){
                cycle = [this.rootPath].concat(referee.refFromRoot.segments).concat(referee.refsOut[schemaPath].segments).concat([ref]);
            }
            let refNode = this.nodes[ref];
            if(!refNode){
                refNode = new SchemaNode(ref);
                refNode.refFromRoot = new RefPath(node.refFromRoot.segments.concat([ref]));
                this.nodes[ref] = refNode;
            }
            const newReferees:SchemaNode[] = referees.filter(x=>!refNode.referees[x.url]);
            for(let r of newReferees){
                refNode.referees[r.url] = r;
                r.refsOut[ref] = new RefPath(r.refsOut[schemaPath].segments.concat([ref]));
            }
            node.refsOut[ref] = new RefPath([ref]);
            refNode.referees[node.url] = node;
        }
        node.processed = true;
        return cycle;
    }
}
function extractRefs(obj:any):string[]{
    return _.unique(doExtractRefs(obj,[]))
}
function doExtractRefs(obj:any,refs:string[]):string[]{
    if(Array.isArray(obj)){
        obj.forEach(x=>doExtractRefs(x,refs));
    }
    else if(obj != null && typeof obj === "object"){
        Object.keys(obj).forEach(x=>{
            if(x === "$ref" && typeof obj[x] === "string"){
                refs.push(decodeURL(obj[x]));
            }
            else if(typeof obj[x] === "object"){
                doExtractRefs(obj[x],refs);
            }
        });
    }
    return refs;
}