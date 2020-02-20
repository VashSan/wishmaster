import { SpotifyApiWrapper } from ".";
import { ICanReply } from "../SongRequest";
import { mock, MockProxy } from "jest-mock-extended";
import SpotifyWebApi = require("spotify-web-api-node");
import { ILogger } from "psst-log";
import { Seconds } from "../../shared";

///<reference path="../../../node_modules/@types/spotify-api/index.d.ts" />
///<reference path="../../../node_modules/@types/spotify-web-api-node/index" />



let logger: MockProxy<ILogger> & ILogger = mock<ILogger>();
let chat: MockProxy<ICanReply> & ICanReply = mock<ICanReply>();
let api: MockProxy<SpotifyWebApi> & SpotifyWebApi = mock<SpotifyWebApi>();

interface Response<T> {
    body: T;
    headers: Record<string, string>;
    statusCode: number;
}

beforeEach(() => {
    chat = mock<ICanReply>();
    api = mock<SpotifyWebApi>();
    logger = mock<ILogger>();
});

test('construction', () => {
    expect(() => { new SpotifyApiWrapper(chat, api, logger) }).not.toThrow();
});

test('getRemainingTrackTime', async () => {
    // Arrange
    const wrapper = new SpotifyApiWrapper(chat, api, logger);

    let r = mock<Response<SpotifyApi.CurrentPlaybackResponse>>();
    r.body.is_playing = true;
    r.body.item = mock<SpotifyApi.TrackObjectFull>();
    r.body.item.duration_ms = new Seconds(3).inMilliseconds();
    r.body.progress_ms = new Seconds(1).inMilliseconds();

    api.getMyCurrentPlaybackState.mockResolvedValue(r);

    // Act & Assert
    await expect(wrapper.getRemainingTrackTime()).resolves.toEqual({ "seconds": 2 });
});

test('play', () => {
    // Arrange
    const wrapper = new SpotifyApiWrapper(chat, api, logger);

    // Act
    wrapper.playNow("test");

    // Assert
    expect(api.play).toBeCalledTimes(1);
});

test('isPausedOrStopped isPlaying', async () => {
    // Arrange
    const wrapper = new SpotifyApiWrapper(chat, api, logger);

    let r = mock<Response<SpotifyApi.CurrentPlaybackResponse>>();
    r.body.is_playing = true;

    api.getMyCurrentPlaybackState.mockResolvedValue(r);

    // Act & Assert
    await expect(wrapper.isPausedOrStopped()).resolves.toBe(false);
});

test('isPausedOrStopped stopped', async () => {
    // Arrange
    const wrapper = new SpotifyApiWrapper(chat, api, logger);

    let r = mock<Response<SpotifyApi.CurrentPlaybackResponse>>();
    r.body.is_playing = false;

    api.getMyCurrentPlaybackState.mockResolvedValue(r);

    // Act & Assert
    await expect(wrapper.isPausedOrStopped()).resolves.toBe(true);
});

test('isPausedOrStopped undefined', async () => {
    // Arrange
    const wrapper = new SpotifyApiWrapper(chat, api, logger);

    // Act & Assert
    await expect(wrapper.isPausedOrStopped()).rejects.toBeTruthy();
});

test.todo('requestCurrentSongInfo');
test.todo('requestSong');
test.todo('updateApiToken');
test.todo('usePlaylist');
