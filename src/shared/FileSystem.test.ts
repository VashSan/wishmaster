
import * as os from "os";
import * as tmp from "tmp";
import * as rmdir from "rimraf";
import * as fs from "fs";

import { mocked } from "ts-jest/utils";
import { IFileSystem, FileSystem } from ".";

import * as path from "path";


describe('path functions', () => {

    // jest.mock('path');
    // const pathMock = mocked(path, true);

    test('resolve', ()=>{
        const file = new FileSystem() as IFileSystem;
        
        let result = file.joinPaths(`\\test\\`, `a\\b`);
        expect(result).toBe(`\\test\\a\\b`);
    });
});

describe('file functions', () => {
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
});