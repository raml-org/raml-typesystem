/// <reference path="../typings/main.d.ts" />

import {XMLValidator} from "raml-xml-validation";
import {XMLSchemaReference} from "raml-xml-validation";

declare var global:any;
declare function require(s:string):any;

declare var Promise: any;

import _ = require("./utils");

import xmlUtil = require('./xmlUtil');
import jsonUtil = require('./jsonUtil');

var DOMParser = require('xmldom').DOMParser;
import ts = require("./typesystem");
import {messageRegistry} from "./typesystem";

export class ValidationResult{
    result:any;
    num:number;
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
    return "__EXAMPLE_" + content + schema + contextPath;
};
export class JSONSchemaObject {
    jsonSchema: any;

    constructor(private schema:string, private provider: IContentProvider){
        if(!provider) {
            this.provider = new DummyProvider();
        } else {
            this.provider = provider;
        }

        if(!schema||schema.trim().length==0||schema.trim().charAt(0)!='{'){
            throw new ts.ValidationError(messageRegistry.INVALID_JSON_SCHEMA);
        }

        var jsonSchemaObject: any;

        try {
            var jsonSchemaObject = JSON.parse(schema);
        } catch(err){
            throw new ts.ValidationError(messageRegistry.INVALID_JSON_SCHEMA_DETAILS,{msg:err.message});
        }

        if(!jsonSchemaObject){
            return
        }

        try{
            var api: any = require('json-schema-compatibility');

            this.setupId(jsonSchemaObject, this.provider.contextPath());
            var schemaVer=""+jsonSchemaObject["$schema"];
            if (schemaVer.indexOf("http://json-schema.org/draft-04/")==-1){
                jsonSchemaObject =api.v4(jsonSchemaObject);
            }
            else{
                this.fixRequired(jsonSchemaObject);
            }
        } catch (e){
            throw new ts.ValidationError(messageRegistry.INVALID_JSON_SCHEMA_DETAILS,{msg:e.message});
        }

        delete jsonSchemaObject['$schema']

        this.jsonSchema=jsonSchemaObject;
    }

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
            var resolvedRef = this.provider.resolvePath(currentPath, reference);
            refConatiner['$ref'] = resolvedRef;
        });
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

        var validator = jsonUtil.getValidator();

        alreadyAccepted.forEach(accepted => validator.setRemoteReference(accepted.reference, accepted.content));

        validator.validate(JSON.parse(content), this.jsonSchema);

        var missingReferences = validator.getMissingRemoteReferences().filter((reference: any) => !_.find(alreadyAccepted, (acceptedReference: any) => reference === acceptedReference.reference));

        if(!missingReferences || missingReferences.length === 0) {
            this.acceptErrors(key, validator.getLastErrors(), true);

            return;
        }

        var acceptedReferences: any = [];

        missingReferences.forEach((reference: any) => {
            var remoteSchemeContent: any;

            var result: any = {reference: reference};

            try {
                var api = require('json-schema-compatibility');

                var jsonObject = JSON.parse(this.provider.content(reference));

                this.setupId(jsonObject, this.provider.normalizePath(reference));

                remoteSchemeContent = api.v4(jsonObject);

                delete remoteSchemeContent['$schema'];

                result.content = remoteSchemeContent;
            } catch(exception){
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

    private setupId(json: any, path: string): any {
        if(!path) {
            return;
        }

        if(!json) {
            return;
        }

        if(json.id) {
            json.id = json.id.trim();

            if(json.id.indexOf('#')< 0) {
                json.id = json.id + '#';
            }

            return;
        }

        json.id = path.replace(/\\/g,'/') + '#';

        this.patchSchema(json);
    }

    private acceptErrors(key: any, errors: any[], throwImmediately = false): void {
        if(errors && errors.length>0){
            var msg = errors.map(x=>x.message+" "+x.params).join(", ");
            var res= new ts.ValidationError(messageRegistry.CONTENT_DOES_NOT_MATCH_THE_SCHEMA,{msg : msg});
            (<any>res).errors=errors;
            globalCache.setValue(key, res);
            if(throwImmediately) {
                throw res;
            }
            return;
        }

        globalCache.setValue(key, 1);
    }

    contentAsync(reference: any): Promise {
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
            var content: any = {reference: reference};

            try {
                var jsonObject = JSON.parse(cnt);

                this.setupId(jsonObject, this.provider.normalizePath(reference));

                remoteSchemeContent = api.v4(jsonObject);

                delete remoteSchemeContent['$schema'];

                content.content = remoteSchemeContent;
            } catch(exception) {
                content.error = exception;
            }

            return content;
        });

        return result;
    }
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

        doc = new DOMParser().parseFromString(xmlString);

        var schema = elementChildrenByName(doc, 'schema', this.namspacePrefix)[0];

        var imports: any[] = elementChildrenByName(schema, 'import', this.namspacePrefix);
        var includes: any[] = elementChildrenByName(schema, 'include', this.namspacePrefix);

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

                    reference = new XMLSchemaReference(fullPath, index, patchedContent);

                    references[fullPath] = reference;
                }

                refElement.setAttribute('schemaLocation', "file_" + reference.virtualIndex + ".xsd");
            }
        });
        
        return doc.toString();
    }

    getMissingReferences(): string[] {
        var doc: any;

        doc = new DOMParser().parseFromString(this.schemaString);

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

        doc = new DOMParser().parseFromString(xmlString);

        var schema = elementChildrenByName(doc, 'schema', this.namspacePrefix)[0];

        var imports: any[] = elementChildrenByName(schema, 'import', this.namspacePrefix);
        var includes: any[] = elementChildrenByName(schema, 'include', this.namspacePrefix);

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

                        reference = new XMLSchemaReference(fullPath, index, patchedContent);

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
            
            var validator = new XMLValidator(patchedSchema);

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
        var doc = new DOMParser().parseFromString(content);
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
    var key = "__SCHEMA_" + content + contextPath;
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
        try {
            var res:Schema = new XMLSchemaObject(content, provider);
            if (useLint) {
                globalCache.setValue(key, res);
            }
            return res;
        } catch (e) {
            if (useLint) {
                globalCache.setValue(key, new ts.ValidationError(messageRegistry.CAN_NOT_PARSE_SCHEMA));
            }
            return null;
        }
    }
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