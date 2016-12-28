/// <reference path="../typings/main.d.ts" />

import {JSONValidator} from "raml-json-validation";

declare function require(s:string):any;

var JSONValidatorConstructor: any;

try {
    JSONValidatorConstructor = require("raml-json-validation").JSONValidator;
} catch(exception) {
}
if (!JSONValidatorConstructor) {
    class JSONValidatorDummyImpl {
        setRemoteReference(reference: string, content: any): void {
            
        }

        validateSchema(jsonSchema: any): void {
            
        }

        getMissingRemoteReferences(): any[] {
            return [];
        }

        isResourceLoaded(reference: string): boolean {
            return true;
        }

        validate(content: any, schema: any): void {
            
        }

        getLastErrors(): any[] {
            return [];
        }
    }

    JSONValidatorConstructor = JSONValidatorDummyImpl;
}

export function getValidator(): JSONValidator {
    return new JSONValidatorConstructor();
}