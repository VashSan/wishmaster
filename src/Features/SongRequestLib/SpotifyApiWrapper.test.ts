import { SpotifyApiWrapper, SongInfo } from ".";
import { ICanReply } from "../SongRequest";
import { mock, MockProxy } from "jest-mock-extended";
import SpotifyWebApi = require("spotify-web-api-node");
import { ILogger } from "psst-log";
import { Seconds, IMessage } from "../../shared";
import { ISongInfo } from "./Playlist";

///<reference path="../../../node_modules/@types/spotify-api/index.d.ts" />
///<reference path="../../../node_modules/@types/spotify-web-api-node/index" />

describe('SongInfo', () => {
    test('does not throw if artists missing', () => {
        const track = mock<SpotifyApi.TrackObjectFull>();
        const logger = mock<ILogger>();

        expect(() => new SongInfo(track, "", logger)).not.toThrow();
        expect(logger.error).toBeCalledTimes(1);
    });

    test('does not throw if artists missing', () => {
        const artist = mock<SpotifyApi.ArtistObjectSimplified>();
        artist.name = "Queen";

        const track = mock<SpotifyApi.TrackObjectFull>();
        track.artists = [artist];
        const logger = mock<ILogger>();

        let songInfo: SongInfo = new SongInfo(track, "", logger);
        expect(logger.error).toBeCalledTimes(0);
        expect(songInfo.artist).toBe("Queen");
    });
});


describe('SpotifyApiWrapper', () => {
    let logger: MockProxy<ILogger> & ILogger;
    let chat: MockProxy<ICanReply> & ICanReply;
    let api: MockProxy<SpotifyWebApi> & SpotifyWebApi;

    function createCurrentPlaybackResponseMock() {
        let r = mock<Response<SpotifyApi.CurrentPlaybackResponse>>();
        r.body.is_playing = true;
        r.body.item = mock<SpotifyApi.TrackObjectFull>();
        r.body.item.duration_ms = new Seconds(3).inMilliseconds();
        r.body.progress_ms = new Seconds(1).inMilliseconds();
        return r;
    }

    function createSearchResponseMock() {
        const artist = mock<SpotifyApi.ArtistObjectSimplified>();
        artist.name = "Queen";

        const trackObject = mock<SpotifyApi.TrackObjectFull>();
        trackObject.uri = "uri";
        trackObject.name = "title";
        trackObject.artists = [artist];

        const tracks = mock<SpotifyApi.PagingObject<SpotifyApi.TrackObjectFull>>();
        tracks.items = [trackObject];

        const response = mock<Response<SpotifyApi.SearchResponse>>();
        response.body.tracks = tracks;

        return response;
    }


    interface Response<T> {
        body: T;
        headers: Record<string, string>;
        statusCode: number;
    }

    beforeEach(() => {
        chat = mock<ICanReply>();
        logger = mock<ILogger>();
        api = mock<SpotifyWebApi>();
        api.play.mockImplementation(() => new Promise<Response<void>>((resolve) => resolve()));
    });

    test('construction', () => {
        expect(() => { new SpotifyApiWrapper(chat, api, logger) }).not.toThrow();
    });

    test('getRemainingTrackTime', async () => {
        // Arrange
        const wrapper = new SpotifyApiWrapper(chat, api, logger);

        let currentPlaybackResponse = createCurrentPlaybackResponseMock();
        api.getMyCurrentPlaybackState.mockResolvedValue(currentPlaybackResponse);

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
        expect(api.play).toBeCalledWith({ uris: ["test"] });
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

    test('requestCurrentSongInfo', () => {
        // Arrange
        const currentPlayback = createCurrentPlaybackResponseMock();
        api.getMyCurrentPlaybackState.mockResolvedValue(currentPlayback);

        const artist = mock<SpotifyApi.ArtistObjectSimplified>();
        artist.name = "Hämatom";

        const track = mock<SpotifyApi.TrackObjectFull>();
        track.name = "boom boom boom";
        track.artists = [artist];

        const currentTrack = mock<Response<SpotifyApi.CurrentlyPlayingResponse>>();
        currentTrack.body.item = track;

        api.getMyCurrentPlayingTrack.mockResolvedValue(currentTrack);

        const wrapper = new SpotifyApiWrapper(chat, api, logger);

        // Act
        const message: IMessage = { channel: "", from: "lion", text: "!song" };
        wrapper.requestCurrentSongInfo(message);

        // Assert
        expect(api.getMyCurrentPlaybackState).toBeCalledTimes(1);
    });

    test('updateApiToken', () => {
        // Arrange
        const wrapper = new SpotifyApiWrapper(chat, api, logger);

        // Act
        wrapper.updateApiToken("token");

        // Assert
        expect(api.setAccessToken).toBeCalledWith("token");
    });

    test('setVolume', () => {
        // Arrange
        api.setVolume.mockImplementation(() => new Promise<Response<void>>((resolve, reject) => { resolve(); }));

        const wrapper = new SpotifyApiWrapper(chat, api, logger);

        // Act
        wrapper.setVolume(50);

        // Assert
        expect(api.setVolume).toBeCalledWith(50);
    });

    test('requestSong', async () => {
        // Arrange
        const response = createSearchResponseMock();

        api.searchTracks.mockResolvedValue(response);

        const wrapper = new SpotifyApiWrapper(chat, api, logger);

        // Act
        const message: IMessage = { channel: "", from: "alice", text: "!sr Innuendo Queen" };
        const act: () => Promise<ISongInfo> = () => wrapper.getSong("Innuendo Queen", message);

        // Assert
        await expect(act()).resolves.toBeDefined();
    });

    test('requestSong by URI', async () => {
        // Arrange
        const response = createSearchResponseMock();
        api.searchTracks.mockResolvedValue(response);

        const currentPlayback = createCurrentPlaybackResponseMock();
        api.getMyCurrentPlaybackState.mockResolvedValue(currentPlayback);

        const artist = mock<SpotifyApi.ArtistObjectSimplified>();
        artist.name = "Queen";

        const track = mock<Response<SpotifyApi.SingleTrackResponse>>();
        track.body.artists = [artist];

        api.getTrack.mockResolvedValue(track);

        const wrapper = new SpotifyApiWrapper(chat, api, logger);

        // Act
        const message: IMessage = { channel: "", from: "alice", text: "!sr spotify:track:46gsGxk2iUctmgJUmQRTKz" };
        const act: () => Promise<ISongInfo> = () => wrapper.getSong("spotify:track:46gsGxk2iUctmgJUmQRTKz", message);

        // Assert
        await expect(act()).resolves.toBeDefined();
    });

    test('setDevice', () => {
        // Arrange
        const wrapper = new SpotifyApiWrapper(chat, api, logger);

        // Act
        wrapper.setPlaybackDevice({ id: "id", name: "name" });
        wrapper.playNow("test");

        // Assert
        expect(api.play).toBeCalledTimes(1);
        expect(api.play).toBeCalledWith({ uris: ["test"], device_id: "id" });
    });

    test('getDeviceLice', async () => {
        // Arrange
        let testDevice = mock<SpotifyApi.UserDevice>();
        testDevice.id = "id";
        testDevice.name = "name";

        let response = mock<Response<SpotifyApi.UserDevicesResponse>>();
        response.body.devices = [testDevice];

        api.getMyDevices.mockResolvedValue(response);
        const wrapper = new SpotifyApiWrapper(chat, api, logger);

        // Act
        const act = () => wrapper.getPlaybackDevices();

        // Act & Assert
        const expectedResult = [{ id: "id", name: "name" }];
        await expect(act()).resolves.toEqual(expectedResult);
    });

});
