# RAML Data Type System

This module contains a lightweight implementation of the type system that was introduced with [RAML 1.0](http://raml.org).

It allows you to to parse, validate , modify RAML types, as well as store them back to JSON.

## Installation

```
npm install raml-typesystem --save
```

## Usage

Parsing and validating a single type:

```js
import ts = require("raml-typesystem")

var personType = ts.loadType( {
    type: "string[]",
    minItems:3,
    maxItems:2
})

var isValid = personType.validateType();
```

Parsing and validating a `types` collection:

```js
import ts = require("raml-typesystem")

var typeCollection = ts.loadTypeCollection({
    types: {
        Person: {
            type: "object",
            properties:{
                kind: "string"
            }
        },
        Man: {
            type: "Person",
            discriminator: "kind"
        }
    }
})
var isValid = typeCollection.getType("Person").validateType()
```


Validating object against type:

```js
import ts = require("raml-typesystem")

var typeCollection = ts.loadTypeCollection({
    types: {
        Person: {
            type: "object",
            properties:{
                kind: "string"
            }
        },
        Man: {
            type: "Person",
            discriminator: "kind"
        }
    }
})
var isValid = typeCollection.getType("Person").validate({dd: true})
```
