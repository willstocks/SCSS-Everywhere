import * as Bluebird from "bluebird";
import * as _ from "lodash";
import "source-map-support/register";
import * as VError from "verror";
import {
    commands, CompletionItem, CompletionItemKind, Disposable,
    ExtensionContext, Hover, languages, MarkdownString, Position, Range, TextDocument, Uri, window,
    workspace,
} from "vscode";
import * as vscode from "vscode";
import CssClassDefinition from "./common/css-class-definition";
import CssClassesStorage from "./css-classes-storage";
import Fetcher from "./fetcher";
import Notifier from "./notifier";
import ParseEngineGateway from "./parse-engine-gateway";

const notifier: Notifier = new Notifier("html-css-class-completion.cache");
let uniqueDefinitions: CssClassDefinition[] = [];

const completionTriggerChars = ["#", '"', "'", " ", "."];

let caching: boolean = false;
interface ICacheObject {
    uri: Uri;
    selectors: CssClassDefinition[];
}

interface IFileObject {
    [key: string]: ICacheObject;
}
interface ISelectorObject {
    [key: string]: Uri[];
}

const files: IFileObject = {};
let snapshot: IFileObject = {};
let selectors: ISelectorObject = {};

let definitions: CssClassDefinition[] = [];
const emmetDisposables: Array<{ dispose(): any }> = [];
const searchForIn: string[] = [".latte", ".twig", ".html", ".slim", ".php", ".scss"];

// hack into it
function endsWithAny(suffixes: string[], str: string) {
    return suffixes.some((suffix) => {
        return str.endsWith(suffix);
    });
}

async function cache(uris: Uri[], silent: boolean = false): Promise<void> {
    try {
        let rewamp = false;
        if (!silent) {
            notifier.notify("eye", "Looking for CSS classes in the workspace...");
        }

        console.log("Looking for parseable documents...");
        if (!uris || uris.length === 0) {
            uris = await Fetcher.findAllParseableDocuments();
            definitions = [];
            selectors = {};
        } else {
            rewamp = true;
        }

        if (!uris || uris.length === 0) {
            console.log("Found no documents");
            notifier.statusBarItem.hide();
            return;
        }

        console.log("Found all parseable documents.");

        let filesParsed: number = 0;
        let failedLogs: string = "";
        let failedLogsCount: number = 0;

        console.log("Parsing documents and looking for CSS class definitions...");

        let defs: CssClassDefinition[];

        try {
            await Bluebird.map(uris, async (uri) => {
                try {
                    defs = await ParseEngineGateway.callParser(uri);
                    const def: ICacheObject = { uri, selectors: defs };
                    files[uri.fsPath] = def;
                } catch (error) {
                    failedLogs += `${uri.path}\n`;
                    failedLogsCount++;
                }
                filesParsed++;
                const progress = ((filesParsed / uris.length) * 100).toFixed(2);
                if (!silent) {
                    notifier.notify("eye", "Looking for CSS classes in the workspace... (" + progress + "%)", false);
                }
            }, { concurrency: 30 });

            const isScssEnabled = workspace.getConfiguration()
                    .get<boolean>("html-css-class-completion.enableScssFindUsage");

            if (!isScssEnabled && searchForIn.indexOf(".scss") >= 0) {
                searchForIn.pop();
            }

            if (!rewamp) {
                snapshot = Object.assign({}, files);
                for (const path of Object.keys(files)) {
                    try {
                        Array.prototype.push.apply(definitions, files[path].selectors);
                    } catch (err) {
                        continue;
                    }
                    if (endsWithAny(searchForIn, path)) {
                        files[path].selectors.map((definition) => {
                            const className: string = definition.className.replace("#", "").replace(".", "");
                            if (selectors[className] === undefined) {
                                selectors[className] = [];
                            }
                            if (selectors[className].indexOf(files[path].uri) === -1) {
                                selectors[className].push(files[path].uri);
                            }
                        });
                    }
                }
            } else {
                Array.prototype.push.apply(definitions, defs);
                const current: Uri = uris[0];
                if (endsWithAny(searchForIn, uris[0].path)) {
                    if (defs) {
                        if (snapshot[current.fsPath] !== undefined) {
                            snapshot[current.fsPath].selectors.map((element) => {
                                const className: string = element.className.replace("#", "").replace(".", "");
                                if (selectors[className] !== undefined &&
                                    selectors[className].length === 1) {
                                    const indexElem: number = definitions.indexOf(element);
                                    if (indexElem !== -1) {
                                        definitions.splice(indexElem, 1);
                                        selectors[className] = [];
                                    }
                                }

                            });
                        }
                        defs.map((definition) => {
                            const className: string = definition.className.replace("#", "").replace(".", "");
                            if (selectors[className] === undefined) {
                                selectors[className] = [];
                            }
                            if (selectors[className].indexOf(current) === -1) {
                                selectors[className].push(current);
                            }
                            snapshot[current.fsPath] = files[current.fsPath];
                        });

                    }
                }
            }
        } catch (err) {
            notifier.notify("alert", "Failed to cache the CSS classes in the workspace (click for another attempt)");
            throw new VError(err, "Failed to parse the documents");
        }

        uniqueDefinitions = _.uniqBy(definitions, (def) => def.className.replace(".", "").replace("#", ""));

        console.log("Summary:");
        console.log(uris.length, "parseable documents found");
        console.log(definitions.length, "CSS class definitions found");
        console.log(uniqueDefinitions.length, "unique CSS class definitions found");
        console.log(failedLogsCount, "failed attempts to parse. List of the documents:");
        console.log(failedLogs);

        if (!silent) {
            notifier.notify("zap", "CSS/SCSS classes cached (click to cache again)");
        }
    } catch (err) {
        notifier.notify("alert", "Failed to cache the CSS classes in the workspace (click for another attempt)");
        throw new VError(err,
            "Failed to cache the class definitions during the iterations over the documents that were found");
    }
}

function provideCompletionItemsGenerator(languageSelector: string, classMatchRegex: RegExp,
                                         classPrefix: string = "", splitChar: string = " ") {
    return languages.registerCompletionItemProvider(languageSelector, {
        provideCompletionItems(document: TextDocument, position: Position): CompletionItem[] {
            const start: Position = new Position(position.line, 0);
            const range: Range = new Range(start, position);
            const text: string = document.getText(range);

            // Check if the cursor is on a class attribute and retrieve all the css rules in this class attribute
            const rawClasses: RegExpMatchArray = text.match(classMatchRegex);
            const excluded: RegExpMatchArray = text.match(/[\"\(\{]/);
            if (!rawClasses || rawClasses.length === 1 ||
                (languageSelector === "slim" && excluded != null && !text.endsWith("class=\""))) {
                return [];
            }

            // Will store the classes found on the class attribute
            const classesOnAttribute = rawClasses[1].split(splitChar);

            // Creates a collection of CompletionItem based on the classes already cached
            const completionItems = uniqueDefinitions.map((definition) => {
                const className = definition.className.replace(".", "").replace("#", "");
                const completionItem = new CompletionItem(className, CompletionItemKind.Variable);
                let completionClassName = `${classPrefix}${className}`;

                let loadFiles = selectors[className];

                let classPrefixOriginal: string = "#";
                if (definition.className.startsWith("#") || classPrefix === "#") {
                    completionItem.kind = CompletionItemKind.Method;
                } else {
                    classPrefixOriginal = ".";
                }
                
                if (definition.className.startsWith("#") && classPrefix === "#") {
                    completionItem.filterText = completionClassName;
                    completionItem.insertText = completionClassName;
                } else if (!definition.className.startsWith("#") && classPrefix === ".") {
                    completionItem.filterText = completionClassName;
                    completionItem.insertText = completionClassName;
                } else if (classPrefix !== "#") {
                    completionItem.filterText = completionClassName;
                    completionItem.insertText = completionClassName;
                }
                loadFiles = _.uniqBy(loadFiles, (file) => file.fsPath );

                if (loadFiles !== undefined && loadFiles.length > 0) {
                    const markdownDoc = new MarkdownString(
                        "`" + classPrefixOriginal + className + "`\r\n\r\n" +
                        loadFiles.length + " occurences in files:\r\n\r\n",
                    );
                    const basePath: string = vscode.workspace.rootPath;
                    loadFiles.forEach((value) => {
                        const path = value.fsPath.replace(basePath, "");
                        markdownDoc.appendMarkdown("\r\n\r\n[" + path + "](" + value.path + ")");
                    });
                    completionItem.documentation = markdownDoc;
                }

                return completionItem;
            });

            // Removes from the collection the classes already specified on the class attribute
            for (const classOnAttribute of classesOnAttribute) {
                for (let j = 0; j < completionItems.length; j++) {
                    if (completionItems[j].insertText === classOnAttribute) {
                        completionItems.splice(j, 1);
                    }
                }
            }

            return completionItems;
        },
    }, ...completionTriggerChars);
}

function enableEmmetSupport(disposables: Disposable[]) {
    const emmetRegex = /(?=\.)([\w-\. ]*$)/;
    const languageModes = ["slim", "html", "razor", "php", "latte", "blade", "vue", "twig", "markdown", "erb",
        "handlebars", "ejs", "typescriptreact", "javascript", "javascriptreact", "scss", "sass", "css"];
    languageModes.forEach((language) => {
        emmetDisposables.push(provideCompletionItemsGenerator(language, emmetRegex, "", "."));
    });
}

function disableEmmetSupport(disposables: Disposable[]) {
    for (const emmetDisposable of disposables) {
        emmetDisposable.dispose();
    }
}

export async function activate(context: ExtensionContext): Promise<void> {
    const disposables: Disposable[] = [];
    const onSave = vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {
        if (["twig", "html", "latte", "slim", "xhtml", "css", "scss"].indexOf(e.languageId) > -1) {
            cache([e.uri], true);
        }
    });

    context.subscriptions.push(onSave);

    workspace.onDidChangeConfiguration(async (e) => {
        try {
            if (e.affectsConfiguration("html-css-class-completion.includeGlobPattern") ||
                e.affectsConfiguration("html-css-class-completion.excludeGlobPattern")) {
                await cache([]);
            }

            if (e.affectsConfiguration("html-css-class-completion.enableEmmetSupport")) {
                const isEnabled = workspace.getConfiguration()
                    .get<boolean>("html-css-class-completion.enableEmmetSupport");
                isEnabled ? enableEmmetSupport(emmetDisposables) : disableEmmetSupport(emmetDisposables);
            }
        } catch (err) {
            err = new VError(err, "Failed to automatically reload the extension after the configuration change");
            console.error(err);
            window.showErrorMessage(err.message);
        }
    }, null, disposables);
    context.subscriptions.push(...disposables);

    context.subscriptions.push(commands.registerCommand("html-css-class-completion.cache", async () => {
        if (caching) {
            return;
        }

        caching = true;
        try {
            await cache([]);
        } catch (err) {
            err = new VError(err, "Failed to cache the CSS classes in the workspace");
            console.error(err);
            window.showErrorMessage(err.message);
        } finally {
            caching = false;
        }
    }));

    // Javascript based extensions
    ["typescriptreact", "javascript", "javascriptreact"].forEach((extension) => {
        context.subscriptions.push(provideCompletionItemsGenerator(extension, /(class|id|className)=["|']([\w- ]*$)/));
    });

    // HTML based extensions
    // tslint:disable-next-line:max-line-length
    ["slim", "html", "latte", "razor", "php", "blade", "vue", "twig", "markdown", "erb", "handlebars", "ejs"].forEach((extension) => {
        context.subscriptions.push(provideCompletionItemsGenerator(extension, /(class|className)=["|']([^"^']*$)/i));
        context.subscriptions.push(provideCompletionItemsGenerator(extension, /(id)=["|']([^"^']*$)/i, "#"));
    });

    // SLIM based extensions
    ["slim"].forEach((extension) => {
        // tslint:disable-next-line:max-line-length
        context.subscriptions.push(provideCompletionItemsGenerator(extension, /(\#|\.)[^\s]*$/i, ""));
        context.subscriptions.push(provideCompletionItemsGenerator(extension, /(\B#\S+)[^\s]*$/i, "#"));
    });
    // CSS/SCSS based vice-versa extensions
    ["css", "sass", "scss"].forEach((extension) => {
        // tslint:disable-next-line:max-line-length
        context.subscriptions.push(provideCompletionItemsGenerator(extension, /(\.)[^\s]*$/i, "."));
        context.subscriptions.push(provideCompletionItemsGenerator(extension, /(\#)[^\s]*$/i, "#"));
        context.subscriptions.push(provideCompletionItemsGenerator(extension, /@apply ([\.\w- ]*$)/, "."));
    });

    caching = true;
    try {
        await cache([]);
    } catch (err) {
        err = new VError(err, "Failed to cache the CSS classes in the workspace for the first time");
        console.error(err);
        window.showErrorMessage(err.message);
    } finally {
        caching = false;
    }
}

export function deactivate(): void {
    emmetDisposables.forEach((disposable) => disposable.dispose());
}
