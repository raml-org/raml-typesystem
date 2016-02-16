import typeExpression=require("./typeExpressionParser")
import ts=require("./typesystem")
export interface BaseNode{
    type:string
}
export interface Union extends BaseNode{
    first: BaseNode
    rest: BaseNode
}

export interface Parens{
    expr:  BaseNode
    arr: number
}
export interface Literal{
    value: string
    arr?: number
    params?:BaseNode[];
}

export function parseToType(val:string,t:ts.TypeRegistry):ts.AbstractType{
    var node:BaseNode=typeExpression.parse(val);
    return parseNode(node,t);
}

function parseNode(node:BaseNode,t:ts.TypeRegistry):ts.AbstractType
{
    if (node.type=="union"){

    }
    else if (node.type=="parens"){

    }
    else{

    }
    return null;
}
