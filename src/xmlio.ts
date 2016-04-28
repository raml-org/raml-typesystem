/// <reference path="../typings/main.d.ts" />
import xml2js=require("xml2js");
import ts=require("./typesystem");
import _=require("underscore");

import {PropertyIs, ComponentShouldBeOfType} from "./restrictions";
import {XMLInfo} from "./metainfo";
import {Status} from "./typesystem";

var XML_ERRORS = '@unexpected_root_attributes_and_elements';

export function readObject(content:string,t:ts.AbstractType):any{
    var result:any=null;
    var opts:xml2js.Options={};
    opts.explicitChildren=false;
    opts.explicitArray=false;
    opts.explicitRoot= isSchema(t) || !t.isExternal();
    xml2js.parseString(content,opts,function (err,res){
        result=res;
        if (err){
            throw new Error();
        }
    });
    result = isSchema(t) ? result: postProcess(result,t);
    return result;
}

export function getXmlErrors(root: any): Status[] {
    var errors: any[] = root[XML_ERRORS];

    delete root[XML_ERRORS];

    if(!errors || errors.length === 0) {
        return null;
    }

    return errors.map(error => new Status(Status.ERROR, 0, <string>error, {}))
}


function isSchema(t: ts.AbstractType): boolean {
    if(isXmlContent(t)) {
        return true;
    }

    return _.find(t.allSuperTypes(), supertype => isXmlContent(supertype)) ? true : false;
}

function isXmlContent(t: ts.AbstractType): boolean {
    if(t.isExternal() && (<any>t)._content && typeof (<any>t)._content === 'string' && (<any>t)._content.trim().indexOf('<') === 0) {
        return true;
    }
    
    return false;
}

function postProcess(result: any, t: ts.AbstractType):any{
    var rootNodeName = Object.keys(result)[0];

    var rootNode = result[rootNodeName];

    var errors: string[] = [];

    var expectedRootNodeName = rootXmlName(t);

    if(expectedRootNodeName !== rootNodeName) {
        errors.push('Unexpected root node "' + rootNodeName + '", "' + expectedRootNodeName + '" is expected.');
    }

    var newJson: any;

    if(t.isArray()) {
        var expectedAttributeNames: string[] = [];
        var expectedElementNames: string[] = [];

        var componentMeta = t.meta().filter(metaInfo => metaInfo instanceof ComponentShouldBeOfType)[0];

        var typeName = componentMeta && componentMeta.value().name();

        expectedElementNames.push(typeName);

        newJson = getArray(rootNode, t, errors, true);
        
        fillExtras(rootNode, errors, expectedAttributeNames, expectedElementNames);
    } else {
        newJson = buildJson(rootNode, t, errors);
    }

    newJson[XML_ERRORS] = errors;
    
    return newJson;
}

function buildJson(node: any, type: ts.AbstractType, errors: string[]) {
    var initialRoot: any = {
        
    };

    if(!type) {
        return node;
    }

    if(type.isScalar()) {
        return toPrimitiveValue(type, node);
    }

    var infos: PropertyIs[] = getInfos(type);

    var expectedAttributeNames: string[] = [];
    var expectedElementNames: string[] = [];
    
    getAttributes(node, infos, expectedAttributeNames).forEach(attribute => initialRoot[Object.keys(attribute)[0]] = attribute[Object.keys(attribute)[0]]);
    getElements(node, infos, expectedElementNames, errors).forEach(element => initialRoot[Object.keys(element)[0]] = element[Object.keys(element)[0]]);

    fillExtras(node, errors, expectedAttributeNames, expectedElementNames);

    return initialRoot;
}

function fillExtras(node: any, errors: string[], expectedAttributeNames: string[], expectedElementNames: string[]) {
    if(typeof node !== "object") {
        return;
    }

    if(!node['$']) {
        node['$'] = {};
    }
    
    expectedAttributeNames.forEach(name => {
        delete node['$'][name];
    });

    expectedElementNames.forEach(name => {
        delete node[name];
    });

    var extraAttributes = Object.keys(node['$']);

    delete node['$'];

    var extraElements = Object.keys(node);

    extraAttributes.forEach(name => {
        errors.push('Unexpected attribute "' + name + '".');
    });

    extraElements.forEach(name => {
        errors.push('Unexpected element "' + name + '".');
    });
}

function getInfos(type: ts.AbstractType): PropertyIs[] {
    return type.meta().filter((info: any) => info instanceof PropertyIs).map((info: any) => <PropertyIs>info) || [];
}

function getAttributes(node: any, infos: PropertyIs[], expectedNames: string[]): any[] {
    var nodeAttributes: any = node['$'];

    if(!nodeAttributes) {
        return [];
    }

    var attributeInfos: PropertyIs[] = _.filter(infos, info => xmlDescriptor(info.value()).attribute);

    return attributeInfos.map(info => {
        var attribute: any = {};

        var key = info.propId();

        var xmlKey = xmlName(info);

        expectedNames.push(xmlKey);

        var value = nodeAttributes[xmlKey];

        attribute[key] = toPrimitiveValue(info.value(), value);

        return attribute[key] === null ? null : attribute;
    }).filter((attribute: any) => attribute);
}

function getElements(node: any, infos: PropertyIs[], expectedNames: string[], errors: string[]): any[] {
    var elementInfos: PropertyIs[] = _.filter(infos, info => !xmlDescriptor(info.value()).attribute);

    return elementInfos.map(info => {
        var element: any = {};

        var descriptor = xmlDescriptor(info.value());

        var key = info.propId();

        var xmlKey = xmlName(info);

        expectedNames.push(xmlKey);

        var value = node[xmlKey];

        if(info.value().isArray()) {
            element[key] = getArray(node[xmlKey], info.value(), errors);
        } else {
            element[key] = (value || value === '') ? buildJson(value, info.value(), errors) : null;
        }

        return element[key] === null ? null : element;
    }).filter((info: any) => info);
}

function getArray(value: any, type: ts.AbstractType, errors: string[], forceWrapped: boolean = false) {
    if(!value || (typeof value === 'string' && value.trim() === '')) {
        return [];
    }
    
    var descriptor = xmlDescriptor(type);
    
    var isWrapped = forceWrapped || descriptor.wrapped;

    var componentMeta = type.meta().filter(metaInfo => metaInfo instanceof ComponentShouldBeOfType)[0];

    var typeName = componentMeta && componentMeta.value().name();

    var values = isWrapped ? value[typeName] : value;

    values = isArray(values) ? values : ((Object.keys(values).length === 1 && [values[Object.keys(values)[0]]]) || values);

    if(isArray(values)) {
        values = values.map((value: any) => buildJson(value, componentMeta && componentMeta.value(), errors))
    } else {
        values = (typeof values === 'object' && values) || [];
    }
    
    return values;
}

function xmlName(property: PropertyIs): string {
    var descriptor: any = xmlDescriptor(property.value());

    var ramlName: string = property.propId();
    
    var actualName = descriptor.name || ramlName;
    
    return (descriptor.prefix || '') + actualName;
}

function rootXmlName(type: ts.AbstractType): string {
    var descriptor: any = xmlDescriptor(type);

    var ramlName: string = type.name();

    var actualName = descriptor.name || ramlName;

    return (descriptor.prefix || '') + actualName;
}

function xmlDescriptor(type: ts.AbstractType): any {
    var info: XMLInfo = type.meta().filter((xmlInfo: any) => xmlInfo instanceof XMLInfo).map((xmlInfo: any) => <XMLInfo>xmlInfo)[0];

    var result: any = {
        attribute: false,
        wrapped: false,
        name: false,
        namespace: false,
        prefix: false
    }

    if(!info) {
        return result;
    }

    var infoValue = info.value();

    if(!infoValue) {
        return result;
    }

    Object.keys(result).forEach((key: string) => {
        result[key] = infoValue[key] || result[key];
    });
    
    return result;
}

function toPrimitiveValue(type: ts.AbstractType, actual: any): any {
    if(typeof actual === 'object') {
        return null;
    }

    if(!actual) {
        return null;
    }

    if(type.isNumber()) {
        var parsedValue:number = parseFloat(actual);

        if(!isNaN(parsedValue)) {
            return parsedValue;
        }
    }

    if(type.isBoolean()) {
        if (actual === 'true') {
            return true;
        }

        if (actual === 'false') {
            return false;
        }
    }

    return (typeof actual === 'string' && (actual || '')) || null;
}

function isArray(instance: any): boolean {
    if(!instance) {
        return false;
    }

    return typeof instance === 'object' && typeof instance.length === 'number';
}