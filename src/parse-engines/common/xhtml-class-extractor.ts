import * as vscode from "vscode";

import CssClassDefinition from "../../common/css-class-definition";

export default class XhtmlClassExtractor {
    /**
     * @description Extracts class names from CSS AST
     */
    public static extract(html: string): CssClassDefinition[] {
        const classNameRegex: RegExp = /(?<=(class|className)=\")[^"]+(?=\")/igm;
        const idRegex: RegExp = /(?<=(id)=\")[^"]+(?=\")/igm;

        let item: RegExpExecArray = classNameRegex.exec(html);
        const classes: string[] = [];
        while (item) {
            classes.push(item[0]);
            item = classNameRegex.exec(html);
        }

        let itemIds: RegExpExecArray = idRegex.exec(html);
        const ids: string[] = [];
        while (itemIds) {
            ids.push(itemIds[0]);
            itemIds = classNameRegex.exec(html);
        }

        let referencedDefs: CssClassDefinition[] = [];
        referencedDefs = referencedDefs.concat(this.process(false, classes));
        referencedDefs = referencedDefs.concat(this.process(true, ids));

        return referencedDefs;
    }

    private static process(id: boolean, items: string[]): CssClassDefinition[] {
        const referencedDefs: CssClassDefinition[] = [];
        items.forEach((elem) => {
            const words: string[] = elem.split(" ");
            words.forEach((e) => {
                // we will extract kind from first char
                e = (id) ? `#${e}` :  `.${e}`;
                referencedDefs.push(new CssClassDefinition(e));
            });
        });
        return referencedDefs;
    }

}
