import ps= require("../src/parse")
import ts = require("../src/typesystem")
import chai = require("chai");
import assert = chai.assert;
import nm=require("../src/nominals")
describe("Simple validation testing",function() {
    it("built in types exist", function () {
        var tp = ps.parseJSON("Person", {
            type: "object",
            properties:{
                name: "string"
            }
        })
        var nt=nm.toNominal(tp,x=>null);
        assert.isNotNull(nt);
        assert.equal(nt.properties().length,1);
        assert(nt.properties()[0].range().nameId()=="string");
    });
});