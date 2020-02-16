import { mock, MockProxy } from "jest-mock-extended";
import { IConfiguration, IContext, ISongRequestConfig, IFileSystem } from "../../shared";
import { SongRequest, IApiWrapper } from "../SongRequest";
import { ILogger } from "psst-log";
import { IPlaylist } from "../SongRequest/PlayList";

let api: MockProxy<IApiWrapper> & IApiWrapper;
let logger: MockProxy<ILogger> & ILogger;
let playlist: MockProxy<IPlaylist> & IPlaylist;

beforeEach(() => {
    api = mock<IApiWrapper>();
    logger = mock<ILogger>();
    playlist = mock<IPlaylist>();
});


test('construction with no init', () => {
    // Arrange
    let songConfig = mock<ISongRequestConfig>();

    let config = mock<IConfiguration>();
    config.getSongRequest.mockReturnValue(songConfig);

    let fs = mock<IFileSystem>();

    let context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);
    context.getFileSystem.mockReturnValue(fs);

    // Act & Assert
    expect(() => new SongRequest(context, api, playlist, logger)).not.toThrow();
});