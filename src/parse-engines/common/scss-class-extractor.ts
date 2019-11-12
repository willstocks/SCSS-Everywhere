import * as vscode from "vscode";

import CssClassDefinition from "../../common/css-class-definition";

export default class ScssClassExtractor {
    /**
     * @description Extracts class names from CSS AST
     */
    public static extract(scss: string): CssClassDefinition[] {
        const classNameRegex: RegExp = /:([^,]*);$|[.|\#]-?[_a-zA-Z]+[_a-zA-Z0-9-]*/g;
        const definitions: CssClassDefinition[] = [];

        let item: RegExpExecArray = classNameRegex.exec(scss);
        while (item) {
            const cls: string = item[0];
            if(!/[#]+\b[0-9A-Fa-f]{3,6}\b/.test(cls)) {
                definitions.push(new CssClassDefinition(cls));
            }
            item = classNameRegex.exec(scss);
        }
        return definitions;
    }
}
