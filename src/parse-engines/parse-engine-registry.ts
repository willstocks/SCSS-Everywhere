import * as vscode from "vscode";
import IParseEngine from "./common/parse-engine";
import CssParseEngine from "./types/css-parse-engine";
import HtmlParseEngine from "./types/html-parse-engine";
import LatteParseEngine from "./types/latte-parse-engine";
import PhpParseEngine from "./types/php-parse-engine";
import ScssParseEngine from "./types/scss-parse-engine";
import SlimParseEngine from "./types/slim-parse-engine";
import EexParseEngine from "./types/eex-parse-engine";
import SvelteParseEngine from "./types/svelte-parse-engine";
import SmartyParseEngine from "./types/smarty-parse-engine";
import HeexParseEngine from "./types/heex-parse-engine";

class ParseEngineRegistry {
    public static getParseEngine(languageId: string): IParseEngine {
        const foundParseEngine = ParseEngineRegistry.registry.find((value) => value.languageId === languageId);

        if (!foundParseEngine) {
            throw new Error(`Could not find a parse engine for the provided language id ("${languageId}").`);
        }

        return foundParseEngine;
    }

    public static get supportedLanguagesIds(): string[] {
        if (!ParseEngineRegistry.languagesIds) {
            ParseEngineRegistry.languagesIds = ParseEngineRegistry.registry.map(
                (parseEngine) => parseEngine.languageId);
        }
        return ParseEngineRegistry.languagesIds;
    }

    private static languagesIds: string[];
    private static registry: IParseEngine[] = [
        new CssParseEngine(),
        new LatteParseEngine(),
        new SmartyParseEngine(),
        new EexParseEngine(),
        new HeexParseEngine(),
        new SvelteParseEngine(),
        new ScssParseEngine(),
        new HtmlParseEngine(),
        new SlimParseEngine(),
        new PhpParseEngine(),
    ];
}

export default ParseEngineRegistry;
