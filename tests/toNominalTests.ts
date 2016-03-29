import ps= require("./actualParse")
import ts = require("../src/typesystem")
import chai = require("chai");
import assert = chai.assert;
import nm=require("../src/nominals")
describe("To nominals",function() {
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
    it("built in types exist", function () {
        var tp = ps.parseJSON("Person", {
            type: "object",
            properties:{
                name: "string"
            },
            facets:{
                "a": "number"
            }
        })
        var nt=nm.toNominal(tp,x=>null);
        assert.isNotNull(nt);
        assert(nt.allFacets()[0].range().nameId()=="number");
    });
    it("built in types exist", function () {
        var tp = ps.parseJSON("Person", {
            type: "object",
            properties:{
                name: "string"
            },
            facets:{
                "a": "number"
            }
        })
        var nt=nm.toNominal(tp,x=>null);
        assert.isNotNull(nt);
        assert(nt.allFacets()[0].range().nameId()=="number");
    });
    it("prop not optional", function () {
        var tp = ps.parseJSON("Person", {
            type: "object",
            properties:{
                name: "string"
            }
        })
        var nt=nm.toNominal(tp,x=>null);
        assert.isNotNull(nt);
        assert.equal(nt.properties().length,1);
        assert.isTrue(nt.properties()[0].isRequired());
    });
    it("prop optional", function () {
        var tp = ps.parseJSON("Person", {
            type: "object",
            properties:{
                "name?": "string"
            }
        })
        var nt=nm.toNominal(tp,x=>null);
        assert.isNotNull(nt);
        assert.equal(nt.properties().length,1);
        assert.isTrue(!nt.properties()[0].isRequired());
    });
    it("object hiearchy", function () {
        var tps = ps.parseJSONTypeCollection({
            types:{
                A: "object",
                B: "A"

            }
        },ts.builtInRegistry())
        var tp=tps.getType("B")
        var nt=nm.toNominal(tp,x=>null);
        assert.isNotNull(nt);
        assert.equal(nt.superTypes().length,1);
        assert.equal(nt.allSuperTypes().length,3);
    });
    it("all properties", function () {
        var tps = ps.parseJSONTypeCollection({
            types:{
                A: {type:"object","properties":{"z":"number"}},
                B: "A"

            }
        },ts.builtInRegistry())
        var tp=tps.getType("B")
        var nt=nm.toNominal(tp,x=>null);
        assert.isNotNull(nt);
        assert.equal(nt.allProperties().length,1);

    });
    it("print details", function () {
        var tps = ps.parseJSONTypeCollection({
            types:{
                A: {type:"object","properties":{"z":"number"}},
                B: "A"

            }
        },ts.builtInRegistry())
        var tp=tps.getType("B")
        var nt=nm.toNominal(tp,x=>null);
        var details=nt.printDetails();
        assert.isTrue(details.indexOf("z : number[ValueType]")!=-1);
    });
    it("fixed facets acccess", function () {
        var tps = ps.parseJSONTypeCollection({
            types:{
                A: {type:"object","properties":{"z":"number"},"facets": {"rr": "number"}},
                B: { type:"A",rr: 3}

            }
        },ts.builtInRegistry())
        var tp=tps.getType("B")
        var nt=nm.toNominal(tp,x=>null);

        assert.isTrue(nt.getFixedFacets()["rr"]==3);
    });
    it("is External", function () {
        var tps = ps.parseJSONTypeCollection({
            types:{
                A: {type:"{}"},
                B: { type:"A",rr: 3}

            }
        },ts.builtInRegistry())
        var tp=tps.getType("B")
        var nt=nm.toNominal(tp,x=>null);

        assert.isTrue(!nt.isExternal());
        assert.isTrue(nt.hasExternalInHierarchy());
    });

});