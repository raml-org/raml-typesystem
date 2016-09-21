declare module "raml-json-validation" {
    class JSONValidator {
        setRemoteReference(reference: string, content: any): void;

        validateSchema(jsonSchema: any): void;

        getMissingRemoteReferences(): any[];

        isResourceLoaded(reference: string): boolean;

        validate(content: any, schema: any): void;
        
        getLastErrors(): any[];
    }
}