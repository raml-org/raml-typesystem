RAML TypeSystem

This module contains an lightweight implementation of typesystem for [RAML 1.0](http://raml.org)

It allows you to do following things:

 * [parse](./globals.html#parse)/[dump](./globals.html#dump) types from JSON or abstract AST like interface using [parseFromAST](./globals.html#parseFromAST) function
 
 * [validate](./globals.html#validate) instances against type definitions
 
 * [check](./globals.html#validateTypeDefinition) that your type definitions and type hierarchies are valid 
 
 * [perform](./globals.html#performAC) automatic classification of the instance 
 
 * [check](./globals.html#checkACStatus) that the type is suitable to serve for automatic classification
 
You also can introspect type system by calling [builtinFacets](./globals.html#allBuiltinFacets)
and [builtInTypes](./globals.html#builtInTypes) functions

You may compose types manually by [deriving](./globals.html#derive) from already defined types or [unifying](./globals.html#unify) them 
and adding restrictions and meta information to them by using [TypeConstructor](./classes/typeconstructor.html)
