import { mock } from "jest-mock-extended";
import { IConfiguration, IContext, ISongRequestConfig } from "../../shared";
import { SongRequest } from "../SongRequest";
import { ILogger } from "psst-log";


test('construction with no init', () => {
    // Arrange   
    let logger = mock<ILogger>();
    let songConfig = mock<ISongRequestConfig>();

    let config = mock<IConfiguration>();
    config.getSongRequest.mockReturnValue(songConfig);
    
    let context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);

    // Act & Assert
    expect(() => new SongRequest(context, logger)).not.toThrow();
});