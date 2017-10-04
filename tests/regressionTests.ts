import ps= require("./actualParse")
import ts = require("../src/typesystem")
import chai = require("chai");
const assert = chai.assert;

describe("Simple validation testing",function() {
    it("Unknown property error message #8", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                XX:{
                  type:"object",
                  properties:{
                      c:"string",
                      y:"boolean"
                  },
                  example:{
                      c:"A",
                      vv:3
                  }
                }
            }
        });
        var t=tp.getType("XX");
        var st=t.validateType(ts.builtInRegistry());
        var f=false;
        st.getErrors().forEach((x: any)=>{
            if (x.getMessage().indexOf("Unknown property")!=-1){
                f=true;
            }
        });
        assert.isTrue(f);
    });
    it("Type error message #7", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                XX:{
                    type:"object",
                    properties:{
                        c:"string",
                    },
                    example:{
                        c:4,
                    }
                }
            }
        });
        var t=tp.getType("XX");
        var st=t.validateType(ts.builtInRegistry());
        var f=false;
        st.getErrors().forEach((x: any)=>{
            if (x.getMessage().indexOf("Expected type 'string' but got 'number'")!=-1){
                f=true;
            }
        });
        assert.isTrue(f);
    });
    it("Type error message #4", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                XX:{
                    type:"object",
                    properties:{
                        c:"string",
                    },
                    example:{

                    }
                }
            }
        });
        var t=tp.getType("XX");
        var st=t.validateType(ts.builtInRegistry());
        var f=false;
        st.getErrors().forEach((x: any)=>{
            if (x.getMessage().indexOf("Required property ")!=-1){
                f=true;
            }
        });
        assert.isTrue(f);
    });
    it("Builtins type of is validated only once", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                XX:{
                    type:"object",
                    properties:{
                        c:"string",
                    },
                    example:{
                        c:{ a: "3"}
                    }
                }
            }
        });
        var t=tp.getType("XX");
        var st=t.validateType(ts.builtInRegistry());
        var f=false;

        assert.isTrue(st.getErrors().length===1);
    });
    it("Incompatible typeof lead to confluent types", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                XX:{
                    type:["string","number"],

                }
            }
        });
        var t=tp.getType("XX");
        var st=t.validateType(ts.builtInRegistry());
        var f=false;

        assert.isTrue(st.getErrors().length===1);
    });
    it("Validating against properties of unknown type", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                XX:{
                    type:"object",
                    properties:{
                        "x":"Likes"
                    },
                    example:{
                        x:{z:2}
                    }
                }
            }
        });
        var t=tp.getType("XX");
        var st:ts.Status=t.validateType(ts.builtInRegistry());
        var f=false;

        assert.isTrue(st.getErrors().length===2);
        var err=false;
        st.getErrors().forEach(x=>{
            if (x.getMessage().indexOf("against")!=-1){
                err=true;
            }
        })
        assert.isTrue(err)
    });
    it("Validating array against  unknown type", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                XX:{
                    type:"object",
                    properties:{
                        "x":"Likes[]"
                    },
                    example:{
                        x:[{z:2}]
                    }
                }
            }
        });
        var t=tp.getType("XX");
        var st:ts.Status=t.validateType(ts.builtInRegistry());
        var f=false;

        assert.isTrue(st.getErrors().length===2);
        var err=false;
        st.getErrors().forEach(x=>{
            if (x.getMessage().indexOf("against")!=-1){
                err=true;
            }
        })
        assert.isTrue(err)
    });
    it("Validating recurrent types error count", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                A:{
                    type:"b",
                },
                B:"a[]"
            }
        });
        var t=tp.getType("B");
        var st=t.validateType(ts.builtInRegistry());
        var f=false;

        assert.isTrue(st.getErrors().length===1);

    });
    it("Validating recurrent types error count (union types)", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: "b | c",
                b: "a | c",
                c: "string"
            }
        });
        var t=tp.getType("b");
        var st=t.validateType(ts.builtInRegistry());
        var f=false;

        assert.isTrue(st.getErrors().length===1);

    });
    it("Validating recurrent types error count (array types)", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: "b[]",
                b: "a[]",
                c: "string"
            }
        });
        var t=tp.getType("b");
        var st=t.validateType(ts.builtInRegistry());
        var f=false;
        assert.isTrue(st.getErrors().length===1);

    });
    it("Validating incorrect JSON external type", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: "{ properties: {}}",

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        var f=false;
        assert.isTrue(st.getErrors().length===1);

    });
    it("Top level null is not allowed", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    "type":" object"
                    ,example: null
                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        var f=false;
        assert.isTrue(st.getErrors().length===1);

    });
    it("Invalid JSON example", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    "type":" object",
                    properties:{
                        x: "number"
                    }
                    ,example: "{ d: 5}"
                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        var f=false;
        assert.isTrue(st.getErrors().length===1);

    });
    it("Invalid JSON example 2", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    "type":`
                    {
                "$schema": "http://json-schema.org/draft-04/schema",
                "type": "object",
                "properties": {
                  "message": {
                    "type": "string"
                  }
                },
                "additionalProperties": false
              }`

                    ,example: `{ "message":"s" ,"r":2 }`
                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        var f=false;
        assert.isTrue(st.getErrors().length===1);
        assert.isTrue(st.getMessage()==="Content is not valid according to schema: Additional properties not allowed: r")
    });
    it("Valid example", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    "type":"object",
                    properties:{
                        x:"string[]"
                    },
                    example: {x:[]}
                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        assert.isTrue(st.getErrors().length===0);
    });
    it("Valid example of format property", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    type:"number",
                   format: "int16"
                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        assert.isTrue(st.getErrors().length===0);
    });
    it("Valid example of not using format property", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    type:"number",

                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        assert.isTrue(st.getErrors().length===0);
    });
    it("File related facets", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    type:"file",
                    fileTypes:["applicaiton/json"],
                    minLength:1,
                    maxLength:2000,
                    example: "some JSON content"
                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        assert.isTrue(st.getErrors().length===0);
    });
    it("File related facets negative test", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    type:"file",
                    fileTypes:["applicaiton/json"],
                    example: "some JSON content",
                    minLength:"1",
                    maxLength:2000
                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        assert.isTrue(st.getErrors().length===1);
    });
    it("not required property in long syntax", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    "type":"object",
                    properties:{
                        x:"string",
                        y:{
                            type:"string",
                            required: false
                        }
                    },
                    example: {x:"A"}
                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        assert.isTrue(st.getErrors().length===0);
    });
    it("strict false", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    "type":"object",
                    properties:{
                        x:"string",
                        y:{
                            type:"string",
                            required: false
                        }
                    },
                    example: {strict: false, value:"a"}
                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        assert.isTrue(st.getErrors().length===0);
    });
    it("strict should be boolean", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    "type":"object",
                    properties:{
                        x:"string",
                        y:{
                            type:"string",
                            required: false
                        }
                    },
                    example: {strict: 3, value:"a"}
                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        assert.isTrue(st.getErrors().length!==0);
    });
    it("strict in examples", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    "type":"object",
                    properties:{
                        x:"string",
                        y:{
                            type:"string",
                            required: false
                        }
                    },
                    examples: {a:{strict: false, value:"a"}}
                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        assert.isTrue(st.getErrors().length===0);
    });
    it("Null, 'false' or empty string value is examples with 'strict' set to 'false' 1", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                T1: {
                    "type":"object",
                    properties:{
                        x:"string",
                        y:{
                            type:"string",
                            required: false
                        }
                    },
                    examples: {
                        e1: {
                            strict: false,
                            value: null
                        },
                        e2: {
                            strict: false,
                            value: false
                        },
                        e3: {
                            strict: false,
                            value: ""
                        }
                    }
                }

            }
        });
        var t=tp.getType("T1");
        var st=t.validateType(ts.builtInRegistry());
        assert.isTrue(st.getErrors().length===0);
    });
    it("Null, 'false' or empty string value is examples with 'strict' set to 'false' 2", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                T1: {
                    "type":"object",
                    properties:{
                        x:"string",
                        y:{
                            type:"string",
                            required: false
                        }
                    },
                    example: {
                        strict: false,
                        value: null
                    }
                },
                T2: {
                    "type":"object",
                    properties:{
                        x:"string",
                        y:{
                            type:"string",
                            required: false
                        }
                    },
                    example: {
                        strict: false,
                        value: false
                    }
                },
                T3: {
                    "type":"object",
                    properties:{
                        x:"string",
                        y:{
                            type:"string",
                            required: false
                        }
                    },
                    example: {
                        strict: false,
                        value: ""
                    }
                }

            }
        });
        let t1=tp.getType("T1");
        let st1=t1.validateType(ts.builtInRegistry());
        assert.isTrue(st1.getErrors().length===0);
        let t2=tp.getType("T2");
        let st2=t2.validateType(ts.builtInRegistry());
        assert.isTrue(st2.getErrors().length===0);
        let t3=tp.getType("T3");
        let st3=t3.validateType(ts.builtInRegistry());
        assert.isTrue(st3.getErrors().length===0);
    });
    it("incorrect strict in examples", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    "type":"object",
                    properties:{
                        x:"string",
                        y:{
                            type:"string",
                            required: false
                        }
                    },
                    examples: {a:{strict: "false", value:"a"}}
                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        assert.isTrue(st.getErrors().length===2);
    });
    it("properties is map", function () {
        var tp = ps.parseJSONTypeCollection({

            types:{
                a: {
                    "type":"object",
                    properties:[],

                }

            }
        });
        var t=tp.getType("a");
        var st=t.validateType(ts.builtInRegistry());
        assert.isTrue(st.getErrors().length===1);
    });
});