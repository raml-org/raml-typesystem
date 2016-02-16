import loader=require("yaml-ast-parser-test");
describe("Built-ins",function() {
    it("built in types exist", function () {
        var z=loader.load("d",{});
    });
})