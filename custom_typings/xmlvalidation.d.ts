declare module "raml-xml-validation" {
    export class XMLValidator {
        constructor(schema:string);

        validate(xml: string, references?: XMLSchemaReference[]): Error[];
    }

    export class XMLSchemaReference {
        originalPath: string;
        virtualIndex: number;
        patchedContent: string;
        
        constructor(originalPath: string, virtualIndex: number, patchedContent: string);
    }
}