import te=require("./typeExpressions");

export interface BaseNode{
    type:string
}
export interface Union extends BaseNode{
    first: BaseNode
    rest: BaseNode
}

export interface Parens extends BaseNode{
    expr:  BaseNode
    arr: number
}
export interface Literal extends BaseNode{
    value: string
    arr?: number
    params?:BaseNode[];
}

export function visit(node:BaseNode,action:(n:BaseNode)=>void){
    te.visit(node,action);
}

export function serializeToString(node:BaseNode):string{
    return te.serializeToString(node);
}

export function parse(str:string):BaseNode{
    return te.parse(str);
}