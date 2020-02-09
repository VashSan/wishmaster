import { mock } from "jest-mock-extended";
import { IConfiguration, IContext, ISongRequestConfig, IFileSystem } from "../../shared";
import { SongRequest } from "../SongRequest";
import { ILogger } from "psst-log";


test('construction with no init', () => {
    // Arrange
    let logger = mock<ILogger>();
    let songConfig = mock<ISongRequestConfig>();

    let config = mock<IConfiguration>();
    config.getSongRequest.mockReturnValue(songConfig);
    
    let fs = mock<IFileSystem>();

    let context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);
    context.getFileSystem.mockReturnValue(fs);

    // Act & Assert
    expect(() => new SongRequest(context, logger)).not.toThrow();
});