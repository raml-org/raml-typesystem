import ps= require("../src/parse")
import ts = require("../src/typesystem")
import chai = require("chai");
import assert = chai.assert;
import jsschema=require("../src/jsonSchemaWriter")
describe("Simple validation testing",function() {
    it("built in types exist", function () {
        var tp = ps.parseJSON("Person", {
            type: "object",
            properties:{
                name: "string"
            }
        })
        var wr=new jsschema.SchemaWriter();
        wr.store(tp)
        console.log(wr.getResult())
    });
});