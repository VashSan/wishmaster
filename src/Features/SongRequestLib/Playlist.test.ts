import { Playlist, ISongInfo, IPlaylistConfig, MediaLibrary } from "./Playlist";
import { mock, MockProxy } from "jest-mock-extended";
import { IApiWrapper } from "../SongRequest";
import { ILogger } from "psst-log";
import { Seconds } from "../../shared";

let api: MockProxy<IApiWrapper> & IApiWrapper;
let logger: MockProxy<ILogger> & ILogger;
let song: MockProxy<ISongInfo> & ISongInfo;
let song2: MockProxy<ISongInfo> & ISongInfo;
let config: MockProxy<IPlaylistConfig> & IPlaylistConfig;
let playlist: Playlist;

beforeEach(() => {
    api = mock<IApiWrapper>();
    api.getRemainingTrackTime.mockResolvedValue(new Seconds(0));

    logger = mock<ILogger>();
    song = mock<ISongInfo>();
    song2 = mock<ISongInfo>();
    config = {
        maxEntriesPerUser: 5,
        maxQueueLength: 10,
        updateIntervalInSeconds: 0.1
    }

    playlist = new Playlist(api, config, logger);
});

afterEach(() => {
    playlist.stop();
});

test('enqueue to stopped playlist', () => {
    // Arrange


    // Act
    const wasQueued = playlist.enqueue(song);

    // Assert
    expect(wasQueued).toBe(false);
});

test('enqueue to running playlist', () => {
    // Arrange
    playlist.start();

    // Act
    const wasQueued = playlist.enqueue(song);

    // Assert
    expect(wasQueued).toBe(true);
});

test('stop', () => {
    // Arrange
    playlist.start();
    playlist.enqueue(song);
    // Act

    playlist.stop();
    const wasQueued = playlist.enqueue(song2);

    // Assert
    expect(wasQueued).toBe(false);
});

test('getCurrent', (done) => {
    // Arrange
    api.getRemainingTrackTime.mockResolvedValueOnce(new Seconds(0));
    api.getRemainingTrackTime.mockResolvedValue(new Seconds(3));

    const currentSongBeforeStart = playlist.getCurrent();
    expect(currentSongBeforeStart).toBeNull();

    playlist.start();
    const currentSongAfterStart = playlist.getCurrent();
    expect(currentSongAfterStart).toBeNull();

    playlist.enqueue(song);

    setTimeout(() => {
        // Act
        const currentSong = playlist.getCurrent();

        // Assert
        expect(api.playNow).toBeCalledTimes(1);
        expect(currentSong).toBe(song);
        done();
    }, 200);
});

test('skip', (done) => {
    // Arrange
    api.getRemainingTrackTime.mockResolvedValueOnce(new Seconds(0));
    api.getRemainingTrackTime.mockResolvedValue(new Seconds(3));

    playlist.start();

    playlist.enqueue(song);

    playlist.enqueue(song2);

    // Act
    playlist.skip();

    setTimeout(() => {

        const secondSong = playlist.getCurrent();

        // Assert
        expect(api.playNow).toBeCalledTimes(2);
        expect(secondSong).toBe(song2);
        done();
    }, 200);
});

test('remove last song', (done) => {
    // Arrange
    const alice = "alice";
    api.getRemainingTrackTime.mockResolvedValueOnce(new Seconds(0));
    api.getRemainingTrackTime.mockResolvedValue(new Seconds(3));

    song.requestedBy = alice;
    song.title = "1";
    song2.requestedBy = alice;
    song2.title = "2";
    let initialSong = mock<ISongInfo>();
    initialSong.requestedBy = "anyone";

    playlist.start();

    // Act    
    playlist.enqueue(initialSong);
    playlist.enqueue(song);
    playlist.enqueue(song2);
    playlist.removeLastSongFromUser(alice);
    playlist.skip(); // skip the first song, so alice next song should be active

    setTimeout(() => {
        const currentSong = playlist.getCurrent();

        // Assert
        expect(currentSong?.title).toBe("1");
        done();
    }, 200);
});

test('isInQueue', (done) => {
    // Arrange
    playlist.start();

    // Act
    const isInQueue1 = playlist.isInQueue(song);

    playlist.enqueue(song);
    playlist.enqueue(song2);


    // Assert
    expect(isInQueue1).toBe(false);

    setTimeout(() => { // check after some time to ensure the current song is set
        const isInQueue2 = playlist.isInQueue(song2);
        const isInQueue3 = playlist.isInQueue(song);

        expect(isInQueue2).toBe(true);
        expect(isInQueue3).toBe(true);
        done();
    }, new Seconds(0.1).inMilliseconds());


});