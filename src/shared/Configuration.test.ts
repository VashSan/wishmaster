import * as os from "os";
import * as rmdir from "rimraf";
import * as fs from "fs";
import * as path from "path";
import { mock } from "jest-mock-extended";
import { ILogger } from "psst-log";
import { Configuration } from "./Configuration";

let tmpDir: string;

beforeEach(() => {
    let prefix = path.join(os.tmpdir(), "wish-");
    tmpDir = fs.mkdtempSync(prefix);
});

afterEach(() => {
    rmdir(tmpDir, (err: Error) => {
        if (err != null) {
            console.error(err.message);
        }
    });
});

test('construction', () => {
    let logger = mock<ILogger>();
    expect(() => new Configuration()).not.toThrow();
    expect(() => new Configuration(tmpDir, logger)).not.toThrow();
});

test('getConfigDir', () => {
    let logger = mock<ILogger>();
    let config = new Configuration(tmpDir, logger);

    let dir = config.getConfigDir();

    expect(dir).toBeDefined();

    let stats = fs.statSync(dir);
    expect(stats.isDirectory()).toBe(true);

    let configFile = path.join(dir, "wishmaster.json");
    let statsConfig = fs.statSync(configFile);
    expect(statsConfig.isFile()).toBe(true);

    let logFolder = path.join(dir, "log");
    let statsLog = fs.statSync(logFolder);
    expect(statsLog.isDirectory()).toBe(true);
});