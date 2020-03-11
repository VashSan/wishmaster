import { mock, MockProxy } from "jest-mock-extended";
import { IConfiguration, IContext, ISongRequestConfig, IFileSystem, IMessage, ITagReader, ISpotifyConfig, IFeatureResponse, Seconds, IObsController } from "../../shared";
import { SongRequest, IApiWrapper } from "../SongRequest";
import { ILogger } from "psst-log";
import { IPlaylist, ISongInfo } from "../SongRequestLib/PlayList";
import { ISongListWriter } from "../SongRequestLib/SongListWriter";
import { IWebAuth, IAccessToken } from "../SongRequestLib";

let api: MockProxy<IApiWrapper> & IApiWrapper;
let apiAuth: MockProxy<IWebAuth> & IWebAuth;
let accessToken: MockProxy<IAccessToken> & IAccessToken;
let logger: MockProxy<ILogger> & ILogger;
let playlist: MockProxy<IPlaylist> & IPlaylist;
let context: MockProxy<IContext> & IContext;
let obs: MockProxy<IObsController> & IObsController;
let fileSystem: MockProxy<IFileSystem> & IFileSystem;
let spotifyConfig: MockProxy<ISpotifyConfig> & ISpotifyConfig;
let songListWriter: MockProxy<ISongListWriter> & ISongListWriter;
let songConfig: MockProxy<ISongRequestConfig> & ISongRequestConfig;

const broadcasterTags = mock<ITagReader>();
broadcasterTags.isBroadcaster.mockReturnValue(true);

const modTags = mock<ITagReader>();
modTags.isMod.mockReturnValue(true);

function createSongRequest() {
    return new SongRequest(context, apiAuth, api, playlist, logger, songListWriter);
}

beforeEach(() => {
    api = mock<IApiWrapper>();
    api.getPlaylist.mockResolvedValue([]);
    accessToken = mock<IAccessToken>();

    apiAuth = mock<IWebAuth>();
    apiAuth.getAccessToken.mockReturnValue(accessToken);

    logger = mock<ILogger>();
    playlist = mock<IPlaylist>();
    spotifyConfig = mock<ISpotifyConfig>();
    songListWriter = mock<ISongListWriter>();

    songConfig = mock<ISongRequestConfig>();
    songConfig.spotify = spotifyConfig;

    let config = mock<IConfiguration>();
    config.getSongRequest.mockReturnValue(songConfig);

    fileSystem = mock<IFileSystem>();

    obs = mock<IObsController>();

    context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);
    context.getFileSystem.mockReturnValue(fileSystem);
    context.getObs.mockReturnValue(obs);
});

test('construction', () => {
    expect(() => createSongRequest()).not.toThrow();
});

test('request song updates song list', (done) => {
    // Arrange
    const song = mock<ISongInfo>();
    song.requestedBy = "bob";

    api.getSong.mockResolvedValue(song);

    playlist.isInQueue.mockReturnValue(false);
    playlist.enqueue.mockReturnValue(true);

    const sr = createSongRequest();
    const msg: IMessage = { text: "!sr Innuendo Queen", from: "alice", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    setTimeout(() => {
        expect(playlist.enqueue).toBeCalled();
        expect(songListWriter.update).toBeCalled();
        done();
    }, new Seconds(0.1).inMilliseconds());
});

test('skip song from user', () => {
    // Arrange
    const sr = createSongRequest();
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
    const sr = createSongRequest();

    const msgFromMod: IMessage = { text: "!skip", from: "mod", channel: "", tags: modTags };

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
    const sr = createSongRequest();

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

test('removeLastSongFromUser', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!rs   ", from: "bob", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.removeLastSongFromUser).toBeCalledWith("bob");
});

test('removeLastSongFromUser is ignored if a text is passed', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!rs  unexpected text  ", from: "alice", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.removeLastSongFromUser).not.toBeCalledWith("alice");
});

test('stop', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!sr-stop", from: "bob", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.stop).toBeCalled();
});

test('start', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!sr-start", from: "bob", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(playlist.start).toBeCalled();
});

test('volume', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!volume 50", from: "alice", channel: "", tags: modTags };

    // Act
    sr.act(msg);

    //Assert
    expect(api.setVolume).toBeCalledWith(50);
});

test('volume byUser', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!volume 50", from: "alice", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(api.setVolume).not.toBeCalled();
});

test('get volume', (done) => {
    // Arrange
    let theResponse: IFeatureResponse;
    const sr = createSongRequest();
    sr.setup((err, response) => {
        theResponse = response;
    });
    const msg: IMessage = { text: "!volume", from: "alice", channel: "", tags: modTags };
    api.getVolume.mockResolvedValue(44);

    // Act
    sr.act(msg);

    //Assert
    setTimeout(() => {
        expect(api.getVolume).toBeCalled();
        expect(theResponse.message.text).toMatch(/44/);
        done();
    }, new Seconds(0.1).inMilliseconds());
});

test('get volume fails', (done) => {
    // Arrange
    let theResponse: IFeatureResponse;
    const sr = createSongRequest();
    sr.setup((err, response) => {
        theResponse = response;
    });
    const msg: IMessage = { text: "!volume", from: "alice", channel: "", tags: modTags };
    api.getVolume.mockRejectedValue("err");

    // Act
    sr.act(msg);

    //Assert
    setTimeout(() => {
        expect(api.getVolume).toBeCalled();
        expect(theResponse).not.toBeDefined();
        done();
    }, new Seconds(0.1).inMilliseconds());
});

test('volume > max', () => {
    // Arrange
    spotifyConfig.maxVolumeByCommand = 45;
    const sr = createSongRequest();
    const msg: IMessage = { text: "!volume 50", from: "alice", channel: "", tags: modTags };

    // Act
    sr.act(msg);

    //Assert
    expect(api.setVolume).toBeCalledWith(45);
});

test('volume < min', () => {
    // Arrange
    spotifyConfig.minVolumeByCommand = 55;
    const sr = createSongRequest();
    const msg: IMessage = { text: "!volume 50", from: "alice", channel: "", tags: modTags };

    // Act
    sr.act(msg);

    //Assert
    expect(api.setVolume).toBeCalledWith(55);
});

test('request song list', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!songlist", from: "bob", channel: "" };

    let repliesReceived = 0;
    sr.setup(() => { repliesReceived += 1 });

    // Act
    sr.act(msg);
    sr.act(msg); // the second is timed out

    //Assert
    expect(repliesReceived).toBe(1);
});

test('add song', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!songlist", from: "bob", channel: "" };

    let repliesReceived = 0;
    sr.setup(() => { repliesReceived += 1 });

    // Act
    sr.act(msg);
    sr.act(msg); // the second is timed out

    // Assert
    expect(repliesReceived).toBe(1);
});

test('connect', (done) => {
    // Arrange
    spotifyConfig.device = "id";
    apiAuth.authenticate.mockImplementation((authCallback) => authCallback());
    api.getPlaybackDevices.mockResolvedValue([{ id: "id", name: "name" }]);
    const sr = createSongRequest();

    // Act
    sr.connect();

    // Assert
    setTimeout(() => {
        expect(api.updateApiToken).toBeCalledWith(expect.any(String));
        expect(api.setPlaybackDevice).toBeCalledWith({ id: "id", name: "name" });
        done();
    });
});

test('on next update overlay', (done) => {
    // Arrange
    const song = mock<ISongInfo>();
    song.requestedBy = "bob";
    song.artist = "Hämatom";
    song.title = "Eva";

    api.getSong.mockResolvedValue(song);

    let onNextCallback: ((song: ISongInfo | null) => void) | undefined;
    playlist.onNext.mockImplementation(callback => onNextCallback = callback);
    playlist.isInQueue.mockReturnValue(false);
    playlist.enqueue.mockReturnValue(true);
    playlist.getCurrent.mockReturnValue(song);

    fileSystem.readAll.mockReturnValue("[[TITLE]] [[ARTIST]]");

    const sr = createSongRequest();

    // Act
    if (onNextCallback) {
        onNextCallback(song);
    }

    //Assert
    setTimeout(() => {
        expect(songListWriter.update).toBeCalled();
        expect(obs.setSourceVisible).toHaveBeenNthCalledWith(1, undefined, false);
        expect(obs.setSourceVisible).toHaveBeenNthCalledWith(2, undefined, true);
        expect(fileSystem.readAll).toBeCalledWith(undefined);
        expect(fileSystem.writeAll).toBeCalledWith(undefined, "Eva Hämatom");
        done();
    }, new Seconds(0.2).inMilliseconds());
});

test('play default song', (done) => {
    songConfig.defaultPlaylist = "default";

    const song = mock<ISongInfo>();
    song.requestedBy = "bob";
    song.artist = "Hämatom";
    song.title = "Eva";

    api.getPlaylist.mockResolvedValue([song]);
    api.getPlaybackDevices.mockResolvedValue([]);

    let onNextCallback: ((song: ISongInfo | null) => void) | undefined;
    playlist.onNext.mockImplementation(callback => onNextCallback = callback);
    playlist.isInQueue.mockReturnValue(false);
    playlist.enqueue.mockReturnValue(true);
    playlist.getCurrent.mockReturnValue(song);

    fileSystem.readAll.mockReturnValue("[[TITLE]] [[ARTIST]]");


    apiAuth.authenticate.mockImplementation((authCallback) => authCallback());

    const sr = createSongRequest();
    sr.connect();

    // Act
    setTimeout(() => {
        if (onNextCallback) {
            onNextCallback(null);
        }
    }, new Seconds(0.075).inMilliseconds());

    //Assert
    setTimeout(() => {
        expect(playlist.enqueue).toBeCalledTimes(1);
        done();
    }, new Seconds(0.15).inMilliseconds());

});

test('setPlaylist', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!playlist spotify:playlist:1234", from: "alice", channel: "", tags: modTags };

    // Act
    sr.act(msg);

    //Assert
    expect(api.getPlaylist).toBeCalledWith("spotify:playlist:1234");
});

test('setPlaylist without Mod', () => {
    // Arrange
    const sr = createSongRequest();
    const msg: IMessage = { text: "!playlist spotify:playlist:1234", from: "bob", channel: "" };

    // Act
    sr.act(msg);

    //Assert
    expect(api.getPlaylist).not.toBeCalled();
});