import * as os from "os";
import * as tmp from "tmp";
import * as rmdir from "rimraf";
import * as fs from "fs";
import * as path from "path";
import { IFile, FileAccess } from ".";


// beforeEach(() => {
//     let prefix = path.join(os.tmpdir(), "wish-");

// });

test('file exists', () => {
    const file = new FileAccess() as IFile;
    const existingFile = tmp.fileSync();
    const result = file.exists(existingFile.name);
    existingFile.removeCallback();

    expect(result).toBe(true);
});

test('file does not exists', () => {
    const fileReader = new FileAccess() as IFile;
    const missingFile = tmp.tmpNameSync();
    const result = fileReader.exists(missingFile);

    expect(result).toBe(false);
});

// test('read file', () => {
//     let fileReader = new FileAccessor() as IFileReader;
// });