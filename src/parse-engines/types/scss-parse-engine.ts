import * as vscode from "vscode";
import CssClassDefinition from "../../common/css-class-definition";
import ScssClassExtractor from "../common/scss-class-extractor";
import IParseEngine from "../common/parse-engine";
import ISimpleTextDocument from "../common/simple-text-document";

class ScssParseEngine implements IParseEngine {
    public languageId: string = "scss";
    public extension: string = "scss";

    public async parse(textDocument: ISimpleTextDocument): Promise<CssClassDefinition[]> {
        const code: string = textDocument.getText().replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '');
        return ScssClassExtractor.extract(code);
    }
}

export default ScssParseEngine;
