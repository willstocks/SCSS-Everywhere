import * as vscode from "vscode";

import CssClassDefinition from "../../common/css-class-definition";

export default class XhtmlClassExtractor {
    /**
     * @description Extracts class names from CSS AST
     */
    public static extract(html: string): CssClassDefinition[] {
        const classNameRegex: RegExp = /(class|id|className)=["|']([^"^']*$)/i;
        const referencedDefs: CssClassDefinition[] = [];

        let item: RegExpExecArray = classNameRegex.exec(html);
        while (item) {
            referencedDefs.push(new CssClassDefinition(item[1]));
            item = classNameRegex.exec(html);
        }

        return referencedDefs;
    }
}
