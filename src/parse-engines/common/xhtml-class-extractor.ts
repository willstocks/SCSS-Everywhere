import * as vscode from "vscode";

import CssClassDefinition from "../../common/css-class-definition";

export default class XhtmlClassExtractor {
    /**
     * @description Extracts class names from CSS AST
     */
    public static extract(html: string): CssClassDefinition[] {
        const classNameRegex: RegExp = /(?<=(class|id|className)=\")[^"]+(?=\")/igm;
        const referencedDefs: CssClassDefinition[] = [];

        let item: RegExpExecArray = classNameRegex.exec(html);
        while (item) {
            referencedDefs.push(new CssClassDefinition(item[0]));
            item = classNameRegex.exec(html);
        }
        return referencedDefs;
    }
}
