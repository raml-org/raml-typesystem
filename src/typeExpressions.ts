import typeExpression=require("./typeExpressionParser")
import ts=require("./typesystem")
import schemaUtil = require('./schemaUtil')
import {ComponentShouldBeOfType} from "./restrictions";
import {AdditionalPropertyIs} from "./restrictions";
import typeExpressionDefs = require("./typeExpressionUtil")

export type BaseNode = typeExpressionDefs.BaseNode;
export type Union = typeExpressionDefs.Union;
export type Literal = typeExpressionDefs.Literal;
export type Parens = typeExpressionDefs.Parens;


export function parseToType(val:string,t:ts.TypeRegistry, contentProvider: schemaUtil.IContentProvider = null,
    typeAttributeContentProvider: schemaUtil.IContentProvider = null):ts.AbstractType{
    try {
        
        var q=val.trim();
        
        if (q.length > 0) {
            var json=q.charAt(0)=='{';
            if (json || (q.charAt(0)=='<'&&q.length>1&&q.charAt(1)!='<')){

                return new ts.ExternalType("", q, json, contentProvider, typeAttributeContentProvider);
            }

            var node:BaseNode = typeExpression.parse(val);
            var result= parseNode(node, t);
            return result;    
        } else {
            return ts.derive(val,[ts.STRING])
        }
        
        
    } catch (e){
        return ts.derive(val,[ts.UNKNOWN]);
    }
}

function wrapArray(a:number, result:ts.AbstractType):ts.AbstractType {
    while (a > 0) {
        var nt = ts.derive("", [ts.ARRAY]);
        nt.addMeta(new ComponentShouldBeOfType(result));
        result = nt;
        a--;
    }
    return result;
}
function parseNode(node:BaseNode,t:ts.TypeRegistry):ts.AbstractType
{
    if (node.type=="union"){
        var ut=<Union>node;
        return ts.union("",[parseNode(ut.first,t),parseNode(ut.rest,t)]);
    }
    else if (node.type=="parens"){
        var ps=<Parens>node;
        var rs=parseNode(ps.expr,t);
        return wrapArray(ps.arr,rs);
    }
    else{
        var lit=(<Literal>node);
        if (lit.value.charAt(lit.value.length-1)=='?'){
            var result=t.get(lit.value.substr(0,lit.value.length-1));
            if (!result){
                result=ts.derive(lit.value,[ts.UNKNOWN]);
            }
            result=ts.union(lit.value,[result,ts.NIL]);
            var a=lit.arr;
            return wrapArray(a, result);
        }
        var result=t.get(lit.value);
        if (!result){
            result=ts.derive(lit.value,[ts.UNKNOWN]);
        }
        var a=lit.arr;
        return wrapArray(a, result);
    }
}


export function storeToString(t:ts.AbstractType):string{
    if (t.isSubTypeOf(ts.ARRAY)){
        var cm=t.oneMeta(ComponentShouldBeOfType);
        if (cm) {
            if (cm.value().isUnion()) {
                return "(" + storeToString(cm.value()) + ")" + "[]";

            }
            else return storeToString(cm.value()) + "[]";
        }
        return "array";
    }
    if (t instanceof ts.UnionType){
        var ut= <ts.UnionType>t;
        return ut.options().map(x=>storeToString(x)).join(" | ");
    }
    if (t.isAnonymous()){
        if (t.isEmpty()){
            return t.superTypes().map(x=>storeToString(x)).join(" , ");
        }
    }
    return t.name();
}

export function visit(node:BaseNode,action:(n:BaseNode)=>void){
    action(node);
    if(node.type=="union"){
        var union = <Union>node;
        visit(union.first,action);
        visit(union.rest,action);
    }
    else if(node.type=="parens"){
        var parens = <Parens>node;
        visit(parens.expr,action);
    }
}
export function serializeToString(node:BaseNode):string{
    var arr = 0;
    var str:string;
    if(node.type=="name"){
        var literal = <Literal>node;
        str = literal.value;
        arr = literal.arr;
    }
    else if(node.type=="union"){
        var union = <Union>node;
        str = serializeToString(union.first) + " | " + serializeToString(union.rest);
    }
    else if(node.type=="parens"){
        var parens = <Parens>node;
        str = "("+serializeToString(parens.expr)+")";
        arr = parens.arr;
    }
    while(--arr>=0){
        str += "[]";
    }
    return str;
}

export function parse(str:string):BaseNode{
    return typeExpression.parse(str);
}