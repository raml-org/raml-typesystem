/// <reference path="../typings/main.d.ts" />
declare function require(s:string):any;

var xmllint1 = require('libxml-xsd');
var xmllint2 = require('xmllint');

export class XMLValidator {
    private schemaObject: any;
    
    constructor(private schema:string) {
        this.schemaObject = xmllint1.parse(schema);
    }

    validate(xml: string): Error[] {
        if(isAtom()) {
            return [];
        }
        
        if(isBrowser()) {
            return xmllint2.validateXML({xml: xml, schema: this.schema});
        }
        
        return this.schemaObject.validate(xml);
    }
}

function objectToXml(object: any) {
    if(!object) {
        return '';
    }

    var nodeName = Object.keys(object)[0];
    var root = object[nodeName];

    if(!root && root !== '') {
        return '';
    }

    var result = '<' + nodeName;

    var attributes = root['$'] || {};

    Object.keys(attributes).forEach(key => {
        result = result + ' ' + key  + '="' + attributes[key] + '"';
    });

    result = result + '>';

    if (typeof root === 'string') {
        result = result + root;
    } else {

        Object.keys(root).forEach((key:any) => {
            if (key === '$') {
                return;
            }

            if (typeof root[key] === 'object' && !root[key].length) {
                var child:any = {};

                child[key] = root[key];

                result = result + objectToXml(child);
            }  else if(typeof root[key] === 'string' || !root[key]) {
                var child:any = {};

                child[key] = root[key] || '';

                result = result + objectToXml(child);
            } else if(typeof root[key] === 'array' || root[key].length) {
                var children: any[] = root[key];

                for(var i = 0; i < children.length; i++) {
                    var member:any = children[i];

                    var child:any = {};

                    child[key] = member;

                    result = result + objectToXml(child);
                }
            }
        });
    }

    result = result + '</' + nodeName + '>';

    return result;
}

function isBrowser() {
    typeof window !== "undefined" && window && !(<any>window).atom;
}

function isAtom() {
    typeof window !== "undefined" && window && (<any>window).atom;
}

function isNode() {
    typeof window === "undefined";
}

export function jsonToXml(jsonObject: any) {
    return objectToXml(jsonObject);
}