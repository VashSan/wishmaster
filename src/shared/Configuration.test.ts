import * as os from "os";
import * as rmdir from "rimraf";
import * as fs from "fs";
import * as path from "path";

import { ILogger } from "psst-log";
import { Configuration, IConfiguration } from "./Configuration";
import { mock, MockProxy } from "jest-mock-extended";
import { IFileSystem } from "./FileSystem";

let tmpDir: string;
let fileSystem: IFileSystem & MockProxy<IFileSystem>;

beforeEach(() => {
    let prefix = path.join(os.tmpdir(), "wish-");
    tmpDir = fs.mkdtempSync(prefix);
    fileSystem = mock<IFileSystem>();
});

afterEach(() => {
    rmdir(tmpDir, (err: Error) => {
        if (err != null) {
            console.error(err.message);
        }
    });
});

test('construction', () => {
    // Arrange
    let logger = mock<ILogger>();
    fileSystem.exists.mockReturnValue(true);
    fileSystem.readAll.mockReturnValueOnce("{}");

    // Act & Assert
    expect(() => new Configuration(tmpDir, fileSystem, logger)).not.toThrow();
});

test('construction throws if config is missing', () => {
    // Arrange
    let logger = mock<ILogger>();
    fileSystem.exists.mockReturnValue(false);
    fileSystem.readAll.mockReturnValueOnce("{}");

    // Act & Assert
    expect(() => new Configuration(tmpDir, fileSystem, logger)).toThrow();
});

test('getConfigDir', () => {
    // Arrange
    let logger = mock<ILogger>();
    fileSystem.exists.mockReturnValue(true);
    fileSystem.readAll.mockReturnValueOnce("{}");

    let config = new Configuration(tmpDir, fileSystem, logger);

    // Act
    let dir = config.getConfigDir();

    // Assert
    expect(dir).toBeDefined();
});

test('getConfiguration', () => {
    // Arrange
    let logger = mock<ILogger>();
    fileSystem.exists.mockReturnValue(true);
    fileSystem.readAll.mockReturnValueOnce("{}");
    let config = new Configuration(tmpDir, fileSystem, logger);

    // Act & Assert
    expect(config.getServiceName()).toBe("Configuration");
})

test('server', () => {
    // Arrange
    let logger = mock<ILogger>();
    fileSystem.exists.mockReturnValue(true);
    fileSystem.readAll.mockReturnValueOnce('{ "server": "x" }');

    // Act
    let config = new Configuration(tmpDir, fileSystem, logger);

    // Assert
    const c = config as IConfiguration;
    expect(c.getServer()).toBe("x");
})