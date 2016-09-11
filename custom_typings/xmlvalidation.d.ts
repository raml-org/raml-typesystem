declare module "raml-xml-validation" {
    export class XMLValidator {
        constructor(schema:string);

        validate(xml: string): Error[];
    }
}