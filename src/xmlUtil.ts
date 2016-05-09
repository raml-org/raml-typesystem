/// <reference path="../typings/main.d.ts" />
declare function require(s:string):any;

var validator = require('xmllint-hack');

export class XMLValidator {
    private schemaObject: any;
    
    constructor(private schema:string) {
        
    }

    validate(xml: string): Error[] {
        var result = validator.validateXML({xml: xml, schema: this.schema});

        return (result && result.errors && result.errors.map((error: any) => new Error(error))) || [];
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

export function jsonToXml(jsonObject: any) {
    var nodeName = jsonObject && Object.keys(jsonObject)[0];

    if(nodeName) {
        var root = jsonObject[nodeName];

        checkAttributes(root);
    }
    
    return objectToXml(jsonObject);
}

function checkAttributes(root: any) {
    if(!root || typeof root === 'string') {
        return;
    }
    
    var attributes: any[] = [];

    Object.keys(root).forEach(key => {
        if(key.indexOf('@') === 0) {
            var attribute = {key: key, value: root[key]};

            attributes.push(attribute);
        } else {
            if(isArray(root[key])) {
                var elements = root[key];

                elements.forEach((element: any) => checkAttributes(element));
            } else if(typeof root[key] !== 'string') {
                checkAttributes(root[key]);
            }
        }
    });

    if(!root['$']) {
        root['$'] = {};
    }

    var newAttributes = root['$'];

    attributes.forEach(attribute => {
        delete root[attribute.key];

        var newKey: string = attribute.key.substring(1);

        newAttributes[newKey] = attribute.value;
    });
}

function isArray(instance: any): boolean {
    if(!instance) {
        return false;
    }

    return typeof instance === 'object' && typeof instance.length === 'number';
}