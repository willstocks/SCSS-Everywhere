import * as vscode from "vscode";

import CssClassDefinition from "../../common/css-class-definition";

export default class ScssClassExtractor {
    /**
     * @description Extracts class names from CSS AST
     */
    public static extract(scss: string): CssClassDefinition[] {
        const classNameRegex: RegExp = /:[^;]*;|([.#]-?[_a-zA-Z][_a-zA-Z0-9-]*)/g;

        const definitions: CssClassDefinition[] = [];

        let item: RegExpExecArray = classNameRegex.exec(scss);
        while (item) {
            definitions.push(new CssClassDefinition(item[1][0]));
            item = classNameRegex.exec(scss);
        }
        return definitions;
    }
}
