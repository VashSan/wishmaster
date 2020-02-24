import { mock, MockProxy } from "jest-mock-extended";
import { IConfiguration, IContext, ISongRequestConfig, IFileSystem, IMessage, ITagReader, ISpotifyConfig } from "../../shared";
import { SongRequest, IApiWrapper } from "../SongRequest";
import { ILogger } from "psst-log";
import { IPlaylist, ISongInfo } from "../SongRequestLib/PlayList";

let api: MockProxy<IApiWrapper> & IApiWrapper;
let logger: MockProxy<ILogger> & ILogger;
let playlist: MockProxy<IPlaylist> & IPlaylist;
let context: MockProxy<IContext> & IContext;
let spotifyConfig: MockProxy<ISpotifyConfig> & ISpotifyConfig;

beforeEach(() => {
    api = mock<IApiWrapper>();
    logger = mock<ILogger>();
    playlist = mock<IPlaylist>();
    spotifyConfig = mock<ISpotifyConfig>();
    
    let songConfig = mock<ISongRequestConfig>();
    songConfig.spotify = spotifyConfig;

    let config = mock<IConfiguration>();
    config.getSongRequest.mockReturnValue(songConfig);

    let fs = mock<IFileSystem>();

    context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);
    context.getFileSystem.mockReturnValue(fs);
});

test('construction', () => {
    expect(() => new SongRequest(context, api, playlist, logger)).not.toThrow();
});

test('skip song from user', () => {
    // Arrange
    const sr = new SongRequest(context, api, playlist, logger);
    const msg: IMessage = { text: "!skip", from: "bob", channel: "" };

    const song = mock<ISongInfo>();
    song.requestedBy = "bob";
    playlist.getCurrent.mockReturnValue(song);

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.skip).toBeCalled();
});

test('skip song by mod or broadcaster', () => {
    // Arrange
    const sr = new SongRequest(context, api, playlist, logger);

    const modTags = mock<ITagReader>();
    modTags.isMod.mockReturnValue(true);
    const msgFromMod: IMessage = { text: "!skip", from: "mod", channel: "", tags: modTags };

    const broadcasterTags = mock<ITagReader>();
    broadcasterTags.isBroadcaster.mockReturnValue(true);
    const msgFromBroadcaster: IMessage = { text: "!skip", from: "broadcaster", channel: "", tags: broadcasterTags };

    const song = mock<ISongInfo>();
    song.requestedBy = "bob";
    playlist.getCurrent.mockReturnValue(song);

    // Act
    sr.act(msgFromMod);
    sr.act(msgFromBroadcaster);

    //Assert
    expect(playlist.skip).toBeCalledTimes(2);
});

test('skip song with no permission', () => {
    // Arrange
    const sr = new SongRequest(context, api, playlist, logger);

    const tags = mock<ITagReader>();
    tags.isMod.mockReturnValue(false);
    tags.isBroadcaster.mockReturnValue(false);
    const msg: IMessage = { text: "!skip", from: "weirdGuy", channel: "", tags: tags };

    const song = mock<ISongInfo>();
    song.requestedBy = "bob";
    playlist.getCurrent.mockReturnValue(song);

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.skip).not.toBeCalled();
});

test('remove last song from user', () => {
    // Arrange
    const sr = new SongRequest(context, api, playlist, logger);
    const msg: IMessage = { text: "!rs", from: "bob", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.removeLastSongFromUser).toBeCalledWith("bob");
});

test('stop', () => {
    // Arrange
    const sr = new SongRequest(context, api, playlist, logger);
    const msg: IMessage = { text: "!sr-stop", from: "bob", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.stop).toBeCalled();
});

test('start', () => {
    // Arrange
    const sr = new SongRequest(context, api, playlist, logger);
    const msg: IMessage = { text: "!sr-start", from: "bob", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.start).toBeCalled();
});

test('volume', () => {
    // Arrange
    const sr = new SongRequest(context, api, playlist, logger);
    const msg: IMessage = { text: "!volume 50", from: "alice", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(api.setVolume).toBeCalledWith(50);
});

test('volume > max', () => {
    // Arrange
    spotifyConfig.maxVolumeByCommand = 45;
    const sr = new SongRequest(context, api, playlist, logger);
    const msg: IMessage = { text: "!volume 50", from: "alice", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(api.setVolume).toBeCalledWith(45);
});

test('volume < min', () => {
    // Arrange
    spotifyConfig.minVolumeByCommand = 55;
    const sr = new SongRequest(context, api, playlist, logger);
    const msg: IMessage = { text: "!volume 50", from: "alice", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(api.setVolume).toBeCalledWith(55);
});