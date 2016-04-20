/// <reference path="../typings/main.d.ts" />
declare function require(s:string):any;

var libxml = require('libxml-xsd');
var xmllint = require('xmllint');

export class XMLValidator {
    private schemaObject: any;
    
    constructor(private schema:string) {
        if(this.isAtom()) {
            this.schemaObject = libxml.parse(schema);
        }
    }

    validate(xml: string): Error[] {
        if(this.isAtom()) {
            return this.schemaObject.validate(xml);
        }

        return xmllint.validateXML({xml: xml, schema: this.schema});
    }

    private isAtom(): boolean {
        return (window && (<any>window).atom) ? true: false;
    }
}


export function jsonToXml(jsonObject: any) {
    return objectToXml(jsonObject);
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

                result = result + this.objectToXml(child);
            }  else if(typeof root[key] === 'string' || !root[key]) {
                var child:any = {};

                child[key] = root[key] || '';

                result = result + this.objectToXml(child);
            } else if(typeof root[key] === 'array' || root[key].length) {
                var children: any[] = root[key];

                for(var i = 0; i < children.length; i++) {
                    var member:any = children[i];

                    var child:any = {};

                    child[key] = member;

                    result = result + this.objectToXml(child);
                }
            }
        });
    }

    result = result + '</' + nodeName + '>';

    return result;
}