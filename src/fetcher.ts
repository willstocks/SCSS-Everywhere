import * as vscode from "vscode";
import * as os from "os";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import ParseEngineRegistry from "./parse-engines/parse-engine-registry";
import { URL } from "url";
import * as crypto from "crypto";
import * as path from "path";
import IParseEngine from "./parse-engines/common/parse-engine";
import ISimpleTextDocument from "./parse-engines/common/simple-text-document";
import * as cheerio from 'cheerio'
const fsExtra = require('fs-extra')

class Fetcher {
  private static async readFile(file: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      fs.readFile(file, (err, data) => {
        if (err) {
          reject(err);
        }
        resolve(data.toString());
      });
    });
  }
  private static async createSimpleTextDocument(
    uri: vscode.Uri
  ): Promise<ISimpleTextDocument> {
    const text = await this.readFile(uri.fsPath);
    const simpleDocument: ISimpleTextDocument = {
      languageId: uri.fsPath.split(".").pop(),
      getText(): string {
        return text;
      },
    };
    return simpleDocument;
  }

  public static async findAllParseableDocuments(): Promise<vscode.Uri[]> {
    // There's a bug in the latest version of the API in which calling vscode.workspace.findFiles
    // when the extension is not being executed inside a workspace, causes a "Cannot read property
    // 'map' of undefined" error.
    // More info: https://github.com/zignd/HTML-CSS-Class-Completion/issues/114
    if (!vscode.workspace.name) {
      return [];
    }

    const prefix = crypto.createHash("md5").update(vscode.workspace.name).digest("hex")


    const configuration = vscode.workspace.getConfiguration();
    const includeGlobPattern = configuration.get(
      "html-css-class-completion.includeGlobPattern"
    );
    const remoteGlobPattern = configuration.get(
      "html-css-class-completion.searchRemoteGlobPattern"
    );
    const excludeGlobPattern = configuration.get(
      "html-css-class-completion.excludeGlobPattern"
    );
    let remoteStyleSheets = configuration.get<Array<string>>(
      "html-css-class-completion.remoteStyleSheets"
    );

    if (!remoteStyleSheets) remoteStyleSheets = []


    const localFiles = await vscode.workspace.findFiles(
      `${includeGlobPattern}`,
      `${excludeGlobPattern}`
    );

    if (remoteGlobPattern && remoteGlobPattern !== '') {

      const contentFiles = await vscode.workspace.findFiles(
        `${remoteGlobPattern}`,
        `${excludeGlobPattern}`
      );

      for (let parsedFile of contentFiles) {
        try {
          const textDocument = await this.createSimpleTextDocument(parsedFile);
          const $ = cheerio.load(textDocument.getText());
          // remoteDynamicStyleSheets.push(remote);
          $('link[rel=stylesheet]').each((key, item) => {
            let url: string = item.attribs["href"]
            if (url.startsWith('//')) {
              url = url.replace('//', 'https://');
            }
            remoteStyleSheets.push(url);
          })
        } catch (ex) {
          console.log("Found an error while processing remote meta link", ex)
          continue
        }
      }
    }

    let paths;
    if (remoteStyleSheets.length > 0) {

      const folder = path.join(os.tmpdir(), "html_css_slim", prefix);
      if (!fs.existsSync(folder)) {
        fsExtra.ensureDirSync(folder);
      }

      fsExtra.emptyDirSync(folder);

      for (const remoteFile of remoteStyleSheets) {
        try {
          const filename = this.getFilename(remoteFile);
          const url = new URL(remoteFile);
          if (url.protocol === "https:") {
            https.get(
              {
                host: url.host,
                path: url.pathname,
                method: "GET",
                port: 443,
              },
              function (response) {
                const file = fs.createWriteStream(path.join(folder, filename));
                response.pipe(file);
              }
            );
          } else {
            http.get(remoteFile, function (response) {
              const file = fs.createWriteStream(path.join(folder, filename));
              response.pipe(file);
            });
          }
        } catch (ex) {
          console.log('Invalid URL or failed to get content', ex);
          continue;
        }
      }

      const relativePattern = new vscode.RelativePattern(folder, "*.css");
      paths = await vscode.workspace.findFiles(relativePattern);

      for (let parsedFile of paths) {
        localFiles.push(parsedFile)
      }
    }

    return localFiles;
  }

  // Parse Filename from URL if not found (such as ends with folder) then md5(url) returns
  private static getFilename(url: string): string {
    const filename = decodeURIComponent(new URL(url).pathname.split("/").pop());
    if (!filename) {
      return crypto.createHash("md5").update(url).digest("hex");
    }
    return filename;
  }
}

export default Fetcher;
