import * as vscode from "vscode";
import * as os from "os";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import { URL } from "url";
import * as crypto from "crypto";
import * as path from "path";
import ISimpleTextDocument from "./parse-engines/common/simple-text-document";
import * as cheerio from 'cheerio';
import * as fsExtra from "fs-extra";

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

    const prefix = crypto.createHash("md5").update(vscode.workspace.name || 'global').digest("hex")

    console.log("SCSS-EVERYWHERE-DEBUG: ", "PREFIX_SET", prefix)

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

    const remoteStyleSheets = configuration.get<Array<string>>(
      "html-css-class-completion.remoteStyleSheets"
    );

    const localFiles = await vscode.workspace.findFiles(
      `${includeGlobPattern}`,
      `${excludeGlobPattern}`
    );

    console.log("SCSS-EVERYWHERE-DEBUG: ", "CONFIG_SET", remoteStyleSheets, localFiles)

    if (remoteGlobPattern && remoteGlobPattern !== '') {
      console.log("SCSS-EVERYWHERE-DEBUG: ", "REMOTE_GLOB_PATTERN_FOUND", remoteGlobPattern)

      const contentFiles = await vscode.workspace.findFiles(
        `${remoteGlobPattern}`,
        `${excludeGlobPattern}`
      );

      console.log("SCSS-EVERYWHERE-DEBUG: ", "REMOTE_GLOB_PATTERN_FILES", contentFiles)

      for (let parsedFile of contentFiles) {
        try {
          console.log("SCSS-EVERYWHERE-DEBUG: ", "REMOTE_GLOB_PATTERN_FILE:", parsedFile)
          const textDocument = await this.createSimpleTextDocument(parsedFile);
          const $ = cheerio.load(textDocument.getText());
          // remoteDynamicStyleSheets.push(remote);
          $('link[rel=stylesheet]').each((key, item) => {
            let url: string = item.attribs["href"]
            if (url.startsWith('//')) {
              url = url.replace('//', 'https://');
            }
            remoteStyleSheets.push(url);
            console.log("SCSS-EVERYWHERE-DEBUG: ", "REMOTE_GLOB_PATTERN_FILE_URL:", url)
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
      fsExtra.ensureDirSync(folder);
      console.log("SCSS-EVERYWHERE-DEBUG: ", "REMOTE_TMP_FOLDER_ENSURE:", folder)

      for (const remoteFile of remoteStyleSheets) {
        try {
          const filename = this.getFilename(remoteFile);
          console.log("SCSS-EVERYWHERE-DEBUG: ", "REMOTE_TMP_FOLDER_GET_FILE:", remoteFile, filename)
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
                console.log("SCSS-EVERYWHERE-DEBUG: ", "REMOTE_TMP_FOLDER_GET_FILE_HTTPS_WRITE:", remoteFile, path.join(folder, filename))
                response.pipe(file);
              }
            );
          } else {
            http.get(remoteFile, function (response) {
              const file = fs.createWriteStream(path.join(folder, filename));
              console.log("SCSS-EVERYWHERE-DEBUG: ", "REMOTE_TMP_FOLDER_GET_FILE_HTTP_WRITE:", remoteFile, path.join(folder, filename))
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
        console.log("SCSS-EVERYWHERE-DEBUG: ", "REMOTE_TMP_FOLDER_APPEND_FILE:", parsedFile)
        localFiles[localFiles.length] = parsedFile;
      }
    }

    console.log("SCSS-EVERYWHERE-DEBUG: ", "REMOTE_AND_LOCAL_FINISH:", localFiles)
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
