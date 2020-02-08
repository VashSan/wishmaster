import * as os from "os";
import * as rmdir from "rimraf";
import * as fs from "fs";
import * as path from "path";

import { ILogger } from "psst-log";
import { Configuration, IConfiguration, DefeatableFeature } from "./Configuration";
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

test('properties', () => {
    // Arrange
    let logger = mock<ILogger>();
    fileSystem.exists.mockReturnValue(true);
    fileSystem.readAll.mockReturnValueOnce(`{ 
        "enabledFeatures": ["Alerts"],
        "server": "a", 
        "nickname": "b", 
	    "password": "c",
	    "channel": "d",
	    "msgLimitPer30Sec": 1,
	    "createLogFile": true,
	    "createLogConsole": true,
	    "verbosity": "e",
	    "maxLogAgeDays": 2,
	    "mediaPlayer": "f",
        "mediaPlayerArgs": [],
        "email": null,
        "alerts": [],
        "obs": null,
        "urlWhiteList": [],
        "staticAnswers": [],
        "stomt": null,
        "songRequest": null,
        "messageProcessorConfig": null }`);

    // Act
    let config = new Configuration(tmpDir, fileSystem, logger);

    // Assert
    const c = config as IConfiguration;
    expect(c.getConfigDir()).toBe(tmpDir);
    
    expect(c.getEmail()).toBe(null);
    expect(c.getObs()).toBe(null);
    expect(c.getSongRequest()).toBe(null);
    expect(c.getStomt()).toBe(null);
    expect(c.getMessageProcessorConfig()).toBe(null);

    expect(c.getServer()).toBe("a");
    expect(c.getNickname()).toBe("b");
    expect(c.getPassword()).toBe("c");
    expect(c.getChannel()).toBe("d");
    expect(c.getCreateLogFile()).toBe(true);
    expect(c.getCreateLogConsole()).toBe(true);
    expect(c.getVerbosity()).toBe("e");
    expect(c.getMaxLogAgeDays()).toBe(2);
    expect(c.getMediaPlayer()).toBe("f");

    expect(c.getMediaPlayerArgs()).toStrictEqual([]);
    expect(c.getUrlWhiteList()).toStrictEqual([]);
    expect(c.getStaticAnswers()).toStrictEqual([]);
    expect(c.getAlerts()).toStrictEqual([]);
    
    expect(c.getEnabledFeatures()).toStrictEqual([DefeatableFeature.Alerts]);
})