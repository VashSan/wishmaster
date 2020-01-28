import * as fs from "fs";

export interface IFile {
    exists(path: string): boolean;
}

export class FileAccess implements IFile {
    constructor(){

    }
    
    exists(path: string): boolean {
        return fs.existsSync(path);
    }
}

export default FileAccess;