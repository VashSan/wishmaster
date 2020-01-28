import * as fs from "fs";

export interface IFileSystem {
    createDirectory(path: string): void;
    exists(path: string): boolean;
    readAll(path: string): string
}

export class FileSystem implements IFileSystem {
    createDirectory(path: string): void {
        fs.mkdirSync(path);
    }

    exists(path: string): boolean {
        return fs.existsSync(path);
    }

    readAll(path: string): string {
        let buffer = fs.readFileSync(path);
        let content = buffer.toString("utf8");
        return content;
    }
}

export default FileSystem;