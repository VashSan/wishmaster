import * as fs from "fs";
import * as path from "path";

export interface IFileSystem {
    createDirectory(path: string): void;
    exists(path: string): boolean;
    readAll(path: string): string;
    writeAll(path: string, text: string): void;
    joinPaths(...paths: string[]): string;
}

export class FileSystem implements IFileSystem {
    private readonly encoding = "utf8";

    createDirectory(path: string): void {
        fs.mkdirSync(path);
    }

    exists(path: string): boolean {
        return fs.existsSync(path);
    }

    readAll(path: string): string {
        let buffer = fs.readFileSync(path);
        let content = buffer.toString(this.encoding);
        return content;
    }

    writeAll(path: string, text: string): void {
        const options = {encoding: this.encoding};
        fs.writeFileSync(path, text, options);
    }

    joinPaths(...paths: string[]): string {
        return path.resolve(...paths);
    }
}

export default FileSystem;