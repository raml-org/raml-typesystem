/// <reference path="../typings/main.d.ts" />
import xml2js=require("xml2js");
import ts=require("./typesystem");
import _=require("underscore");

import {PropertyIs, ComponentShouldBeOfType} from "./restrictions";
import {XMLInfo} from "./metainfo";
import {Status} from "./typesystem";

var XML_ERRORS = '@unexpected_root_attributes_and_elements';

var bodyNames: string[] = [
    'application/x-www-form-urlencoded',
    'application/json',
    'application/xml',
    'multipart/form-data'
];

function xmlOpen(tagname: string, attributes: any, level: number = 0, newLine: boolean = true) {
    var result: string = '<' + tagname;
    
    for(var i = 0; i < level; i++) {
        result = '    ' + result;
    }
    
    if(attributes && Object.keys(attributes).length > 0) {
        Object.keys(attributes).forEach((key: string) => {
            if(typeof attributes[key] !== 'string') {
                return;
            }
            
            result = result + ' ' + key + '="' + attributes[key] + '"';
        });
    }
    
    result = result + '>' + (newLine ? '\n' : '');
    
    return result ;
};

function xmlClose(tagname: string, level: number = 0): string {
    var result: string = '</' + tagname;

    for(var i = 0; i < level && i > -1; i++) {
        result = '    ' + result;
    }

    var result = (level > -1 ? '\n' : '') + result + '>\n';

    return result;
}

export function serializeToXML(object: any, type: ts.AbstractType) {
    type = actualType(type);

    var expectedRootNodeName = rootXmlName(type);

    var infos: PropertyIs[] = getInfos(type);

    var result = xmlOpen(expectedRootNodeName, getAttributesFromJson(object, infos));

    var valueWrapper: any = {};

    valueWrapper[expectedRootNodeName] = object;

    if(type.isArray()) {
        var componentMeta = type.meta().filter((metaInfo: any) => metaInfo instanceof ComponentShouldBeOfType)[0];

        result = result + getArrayFromJson(valueWrapper, type, 1, true);
    } else {
        result = result + getElementsFromJson(object, infos, 1);
    }
    
    var result = result + xmlClose(expectedRootNodeName);

    return result;
}

function getAttributesFromJson(node: any, infos: PropertyIs[]): any[] {
    var nodeAttributes: any = {};

    var attributeInfos: PropertyIs[] = _.filter(infos, info => xmlDescriptor(info.value()).attribute);

    attributeInfos.forEach(info => {
        var key = info.propId();

        var xmlKey = xmlName(info);

        if(node[key]) {
            nodeAttributes[xmlKey] = node[key].toString();
        }
    });

    return nodeAttributes;
}

function getElementFromJson(node: any, type: ts.AbstractType, level: number): string {
    var jsonKey = Object.keys(node)[0];

    var jsonValue = node[jsonKey];
    
    var result: string = null;
    
    if(type.isScalar()) {
        var infos: PropertyIs[] = getInfos(type);

        result = xmlOpen(jsonKey, getAttributesFromJson(jsonValue, infos), level, !type.isScalar()) + jsonValue.toString();
    } else if(type.isUnion()) {
        return getElementFromJson(node, selectTypeFromJson(jsonValue, type), level);
    } else {
        var infos: PropertyIs[] = getInfos(type);

        result = xmlOpen(jsonKey, getAttributesFromJson(jsonValue, infos), level, !type.isScalar()) + getElementsFromJson(jsonValue, infos, level + 1);
    }
    
    result = result + xmlClose(jsonKey, type.isScalar() ? -1 : level);

    return result;
}

function selectTypeFromJson(value: any, unionType: ts.AbstractType): ts.AbstractType {
    var canBeTypes: ts.AbstractType[] = unionType.typeFamily();
    
    var results: any[] = [];
    
    var result: any = null;
    
    canBeTypes.forEach((type: ts.AbstractType) => {
        var xmlValue = serializeToXML(value, type);
        
        if(!xmlValue) {
            return;
        }
        
        var jsonValue = readObject(xmlValue, type);
        
        if(jsonValue) {
            var errors = getXmlErrors(jsonValue);

            results.push({type: type, errors: (errors && errors.length) || 0});
        }
    });
    
    result = results.length > 0 ? results[0] : {type: canBeTypes[0]};

    results.forEach((canBe: any) => {
        if(canBe.errors < result.errors) {
            result = canBe;
        }
    });
    
    return result.type;
}

function getElementsFromJson(node: any, infos: PropertyIs[], level: number): string {
    var elementInfos: PropertyIs[] = _.filter(infos, info => !xmlDescriptor(info.value()).attribute);
    
    var result = '';
    
    elementInfos.forEach(info => {
        var xmlKey = xmlName(info);

        var key = info.propId();

        var value: any = {};
        
        value[xmlKey] = node[key];

        if(info.value().isArray()) {
            result = result + getArrayFromJson(value, info.value(), level);
        } else {
            result = result + ((node[key] || node[key] === '') ? getElementFromJson(value, info.value(), level) : '');
        }        
    });
    
    return result;
}

function getArrayFromJson(values: any, type: ts.AbstractType, level: number, rootNode: boolean = false): string {
    var jsonKey = Object.keys(values)[0];

    var jsonValue = values[jsonKey];

    var descriptor = xmlDescriptor(type);

    var isWrapped = rootNode || descriptor.wrapped;
    
    var result = '';

    var componentType = arrayElementType(type);
    
    var typeName = componentType && componentType.name();
    
    var elementsLevel = level;
    
    if(isWrapped && !rootNode) {
        result = xmlOpen(jsonKey, null, level);

        elementsLevel = elementsLevel + 1;
    }
    
    if(jsonValue && isArray(jsonValue)) {
        jsonValue.forEach((item: any) => {
            var itemWrapper: any = {};

            itemWrapper[isWrapped ? typeName : jsonKey] = item;
            
            result = result + getElementFromJson(itemWrapper, componentType, elementsLevel);
        });
    }
    
    if(isWrapped) {
        result = result + xmlClose(jsonKey, level);
    }
    
    return result;
}

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
    result = isSchema(t) ? result: postProcess(result, actualType(t));
    return result;
}

export function getXmlErrors(root: any): Status[] {
    var errors: any[] = root[XML_ERRORS];

    delete root[XML_ERRORS];

    if(!errors || errors.length === 0) {
        return null;
    }

    return errors.map(error => new Status(Status.ERROR, "", <string>error, {}))
}

function actualType(type: ts.AbstractType): ts.AbstractType {
    if(!type) {
        return type;
    }

    if(isBodyLike(type)) {
        if(!type.superTypes() || type.superTypes().length === 0) {
            return type;
        }
        
        if(type.superTypes().length === 1) {
            return type.superTypes()[0];
        }
        
        return _.find(type.allSuperTypes(), superType => superType.name() === 'object') || type;
    }
    
    return type;
}

function isBodyLike(type: ts.AbstractType): boolean {
    if(!type) {
        return false;
    }

    return _.find(bodyNames, name => type.name() === name) ? true : false;
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

function postProcess(result: any, type: ts.AbstractType):any{
    var rootNodeName = Object.keys(result)[0];

    var rootNode = result[rootNodeName];

    var errors: string[] = [];

    var expectedRootNodeName = rootXmlName(type);

    if(expectedRootNodeName !== rootNodeName) {
        errors.push('Unexpected root node "' + rootNodeName + '", "' + expectedRootNodeName + '" is expected.');
    }

    var newJson: any;

    if(type.isArray()) {
        var expectedAttributeNames: string[] = [];
        var expectedElementNames: string[] = [];

        var componentMeta = type.meta().filter(metaInfo => metaInfo instanceof ComponentShouldBeOfType)[0];

        var typeName = componentMeta && componentMeta.value().name();

        expectedElementNames.push(typeName);

        newJson = getArray(rootNode, type, errors, true);
        
        fillExtras(rootNode, errors, expectedAttributeNames, expectedElementNames);
    } else {
        newJson = buildJson(rootNode, type.isUnion() ? selectFromUnion(rootNode, type) : type, errors);
    }

    newJson[XML_ERRORS] = errors;
    
    return newJson;
}

function checkErrors(rootNode: any, actualType: ts.AbstractType): number {
    var errors: string[] = [];

    var newJson: any;

    newJson = buildJson(rootNode, actualType, errors);
    
    var validationErrors = actualType.validateDirect(newJson, true, false).getErrors();
    
    return errors.length + (validationErrors && validationErrors.length);
}

function selectFromUnion(rootNode: any, union: ts.AbstractType): ts.AbstractType {
    var results: any[] = [];
    
    union.typeFamily().forEach(type => results.push({type: type, errors: checkErrors(JSON.parse(JSON.stringify(rootNode)), type)}));
    
    if(results.length === 0) {
        return union;
    }    
    
    var result: any = results[0];
    
    results.forEach((oneOf: any) => {
        if(oneOf.errors < result.errors) {
            result = oneOf;
        }
    });

    return result.type;
}

function buildJson(node: any, type: ts.AbstractType, errors: string[]): any {
    var initialRoot: any = {
        
    };

    if(!type) {
        return node;
    }

    if(type.isScalar()) {
        return toPrimitiveValue(type, node, errors);
    }

    if(type.isUnion()) {
        return buildJson(node, selectFromUnion(node, type), errors);
    }

    var infos: PropertyIs[] = getInfos(type);

    var expectedAttributeNames: string[] = [];
    var expectedElementNames: string[] = [];
    
    getAttributes(node, infos, expectedAttributeNames).forEach(attribute => initialRoot[Object.keys(attribute)[0]] = attribute[Object.keys(attribute)[0]]);
    getElements(node, infos, expectedElementNames, errors).forEach(element => initialRoot[Object.keys(element)[0]] = element[Object.keys(element)[0]]);

    fillExtras(node, errors, expectedAttributeNames, expectedElementNames);

    return initialRoot;
}

function fillExtras(node: any, errors: string[], expectedAttributeNames: string[], expectedElementNames: string[], remove: boolean = false) {
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

        if(remove) {
            delete node[name];
        }
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

function getArray(values: any, type: ts.AbstractType, errors: string[], rootNode: boolean = false) {
    var descriptor = xmlDescriptor(type);
    
    var isWrapped = rootNode || descriptor.wrapped;

    var componentType = arrayElementType(type);

    var typeName = componentType && componentType.name();

    if(isWrapped) {
        var valuesWrapper = values;
        
        values = values && values[typeName];

        fillExtras(valuesWrapper, errors, [], [typeName], true);
    }

    if(!values) {
        return [];
    }

    values = getArrayValues(values);

    if(isArray(values)) {
        values = values.map((value: any) => buildJson(value, componentType, errors))
    } else {
        values = (typeof values === 'object' && values) || [];
    }
    
    return values;
}

function getArrayValues(preValues: any) {
    if(isArray(preValues)) {
        return preValues;
    }

    if(typeof preValues === 'object') {
        return [preValues];
    }

    return [];
}

function arrayElementType(arrayType: ts.AbstractType) {
    if(!arrayType || !arrayType.isArray()) {
        return null;
    }

    var componentMetas: ComponentShouldBeOfType[] = <ComponentShouldBeOfType[]>arrayType.meta().filter(metaInfo => metaInfo instanceof ComponentShouldBeOfType);

    return componentMetas && componentMetas.length > 0 && componentMetas[0].value();
}

function xmlName(property: PropertyIs): string {
    var descriptor: any = xmlDescriptor(property.value());

    var ramlName: string = property.propId();
    
    var actualName = descriptor.name || ramlName;

    if(descriptor.namespace) {
        actualName = descriptor.namespace + ':' + actualName;
    }
    
    return (descriptor.prefix || '') + actualName;
}

function rootXmlName(type: ts.AbstractType): string {
    var descriptor: any = xmlDescriptor(type);

    var ramlName: string = type.name();

    if(ramlName === '' && type.isUnion()) {
        ramlName = 'object'
    }

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

function toPrimitiveValue(type: ts.AbstractType, actual: any, errors: string[] = []): any {
    if(typeof actual === 'object') {
        var result = toPrimitiveValue(type, actual['_']);

        delete actual['_'];

        fillExtras(actual, errors, [], [], true);

        return result;
    }

    if(!actual && actual.trim() !== '') {
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

    if(typeof actual === 'string') {
        return actual;
    }

    return null;
}

function isArray(instance: any): boolean {
    if(!instance) {
        return false;
    }

    return typeof instance === 'object' && typeof instance.length === 'number';
}