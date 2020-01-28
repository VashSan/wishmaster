import * as os from "os";
import * as tmp from "tmp";
import * as rmdir from "rimraf";
import * as fs from "fs";
import * as path from "path";
import { IFileSystem, FileSystem } from ".";

test('file exists', () => {
    const file = new FileSystem() as IFileSystem;
    const existingFile = tmp.fileSync();
    const result = file.exists(existingFile.name);
    existingFile.removeCallback();

    expect(result).toBe(true);
});

test('file does not exists', () => {
    const fileReader = new FileSystem() as IFileSystem;
    const missingFile = tmp.tmpNameSync();
    const result = fileReader.exists(missingFile);

    expect(result).toBe(false);
});

test('read all', () => {
    const file = new FileSystem() as IFileSystem;
    const existingFile = tmp.fileSync();
    const testData = "ABC123";
    fs.writeFileSync(existingFile.name, testData);

    const result = file.readAll(existingFile.name);
    existingFile.removeCallback();

    expect(result).toBe(testData);
});