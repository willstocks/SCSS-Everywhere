import * as vscode from "vscode";
import CssClassDefinition from "../../common/css-class-definition";
import IParseEngine from "../common/parse-engine";
import ISimpleTextDocument from "../common/simple-text-document";
import XhtmlClassExtractor from "../common/xhtml-class-extractor";

class ReactTsxParseEngine implements IParseEngine {
    public languageId: string = "tsx";
    public extension: string = "tsx";

    public async parse(textDocument: ISimpleTextDocument): Promise<CssClassDefinition[]> {
        const code: string = textDocument.getText();
        return XhtmlClassExtractor.extract(code);
    }
}

export default SvelteParseEngine;
