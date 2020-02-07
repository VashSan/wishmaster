import * as os from "os";
import * as path from "path";

import { mock } from "jest-mock-extended";
import { Context, Configuration, IFileSystem, IEmail, IDatabase, IObsController } from "../shared";
import { SongRequest } from "./SongRequest";
import { ILogger } from "psst-log";


test('construction with no init', () => {
    // Arrange
    let configDir = path.join(process.env.localappdata || os.homedir(), '.wishmaster');
    let fs = mock<IFileSystem>();
    fs.exists.mockReturnValue(true);
    fs.readAll.mockReturnValueOnce("{}");
    
    let configuration = new Configuration(configDir, fs);
    configuration.songRequest = null;
    
    let context = new Context(configuration, mock<ILogger>(), mock<IDatabase>(), mock<IObsController>(), mock<IEmail>());
    
    // Act & Assert
    expect(() => new SongRequest(context)).not.toThrow();
});