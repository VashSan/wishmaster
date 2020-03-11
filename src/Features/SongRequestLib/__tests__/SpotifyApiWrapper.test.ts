import { SpotifyApiWrapper, SongInfo } from "..";
import { mock, MockProxy } from "jest-mock-extended";
import SpotifyWebApi = require("spotify-web-api-node");
import { ILogger } from "psst-log";
import { Seconds, IMessage } from "../../../shared";
import { ISongInfo, MediaLibrary } from "../Playlist";
import { response } from "express";

///<reference path="../../../node_modules/@types/spotify-api/index.d.ts" />
///<reference path="../../../node_modules/@types/spotify-web-api-node/index" />

describe('SongInfo', () => {
    test('does not throw if artists missing', () => {
        const track = mock<SpotifyApi.TrackObjectFull>();
        const logger = mock<ILogger>();

        expect(() => new SongInfo(track, "", logger)).not.toThrow();
        expect(logger.error).toBeCalledTimes(1);
    });

    test('create song info', () => {
        const artist = mock<SpotifyApi.ArtistObjectSimplified>();
        artist.name = "Queen";

        const track = mock<SpotifyApi.TrackObjectFull>();
        track.artists = [artist];
        track.album = mock<SpotifyApi.AlbumObjectSimplified>();

        const image = mock<SpotifyApi.ImageObject>();
        image.url = "xxx";
        track.album.images = [image];

        const logger = mock<ILogger>();

        let songInfo: SongInfo = new SongInfo(track, "", logger);
        expect(logger.error).toBeCalledTimes(0);
        expect(songInfo.artist).toBe("Queen");
        expect(songInfo.imageUrl).toBe("xxx");
    });
});


describe('SpotifyApiWrapper', () => {
    let logger: MockProxy<ILogger> & ILogger;
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
        logger = mock<ILogger>();
        api = mock<SpotifyWebApi>();
        api.play.mockImplementation(() => new Promise<Response<void>>((resolve) => resolve()));
    });

    test('construction', () => {
        expect(() => { new SpotifyApiWrapper(api, logger) }).not.toThrow();
    });

    test('getRemainingTrackTime', async () => {
        // Arrange
        const wrapper = new SpotifyApiWrapper(api, logger);

        let currentPlaybackResponse = createCurrentPlaybackResponseMock();
        api.getMyCurrentPlaybackState.mockResolvedValue(currentPlaybackResponse);

        // Act & Assert
        await expect(wrapper.getRemainingTrackTime()).resolves.toEqual(new Seconds(2));
    });

    test('play', () => {
        // Arrange
        const wrapper = new SpotifyApiWrapper(api, logger);

        // Act
        wrapper.playNow("test");

        // Assert
        expect(api.play).toBeCalledTimes(1);
        expect(api.play).toBeCalledWith({ uris: ["test"] });
    });

    test('isPausedOrStopped isPlaying', async () => {
        // Arrange
        const wrapper = new SpotifyApiWrapper(api, logger);

        let r = mock<Response<SpotifyApi.CurrentPlaybackResponse>>();
        r.body.is_playing = true;

        api.getMyCurrentPlaybackState.mockResolvedValue(r);

        // Act & Assert
        await expect(wrapper.isPausedOrStopped()).resolves.toBe(false);
    });

    test('isPausedOrStopped stopped', async () => {
        // Arrange
        const wrapper = new SpotifyApiWrapper(api, logger);

        let r = mock<Response<SpotifyApi.CurrentPlaybackResponse>>();
        r.body.is_playing = false;

        api.getMyCurrentPlaybackState.mockResolvedValue(r);

        // Act & Assert
        await expect(wrapper.isPausedOrStopped()).resolves.toBe(true);
    });

    test('isPausedOrStopped undefined', async () => {
        // Arrange
        const wrapper = new SpotifyApiWrapper(api, logger);

        // Act & Assert
        await expect(wrapper.isPausedOrStopped()).rejects.toBeTruthy();
    });

    test('updateApiToken', () => {
        // Arrange
        const wrapper = new SpotifyApiWrapper(api, logger);

        // Act
        wrapper.updateApiToken("token");

        // Assert
        expect(api.setAccessToken).toBeCalledWith("token");
    });

    test('getVolume', () => {
        // Arrange
        const r = mock<Response<SpotifyApi.CurrentPlaybackResponse>>();
        r.statusCode = 200;
        r.body.device = mock<SpotifyApi.UserDevice>();
        r.body.device.volume_percent = 33;
        api.getMyCurrentPlaybackState.mockResolvedValue(r);

        const wrapper = new SpotifyApiWrapper(api, logger);

        // Act
        const act = () => wrapper.getVolume();

        // Assert
        expect(act()).resolves.toBe(33);
    });

    test('setVolume', () => {
        // Arrange
        api.setVolume.mockImplementation(() => new Promise<Response<void>>((resolve, reject) => { resolve(); }));

        const wrapper = new SpotifyApiWrapper(api, logger);

        // Act
        wrapper.setVolume(50);

        // Assert
        expect(api.setVolume).toBeCalledWith(50);
    });

    test('requestSong', async () => {
        // Arrange
        const response = createSearchResponseMock();

        api.searchTracks.mockResolvedValue(response);

        const wrapper = new SpotifyApiWrapper(api, logger);

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

        const wrapper = new SpotifyApiWrapper(api, logger);

        // Act
        const message: IMessage = { channel: "", from: "alice", text: "!sr spotify:track:46gsGxk2iUctmgJUmQRTKz" };
        const act: () => Promise<ISongInfo> = () => wrapper.getSong("spotify:track:46gsGxk2iUctmgJUmQRTKz", message);

        // Assert
        await expect(act()).resolves.toBeDefined();
    });

    test('setDevice', () => {
        // Arrange
        const wrapper = new SpotifyApiWrapper(api, logger);

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
        const wrapper = new SpotifyApiWrapper(api, logger);

        // Act
        const act = () => wrapper.getPlaybackDevices();

        // Act & Assert
        const expectedResult = [{ id: "id", name: "name" }];
        await expect(act()).resolves.toEqual(expectedResult);
    });

    test('getPlaylist', async () => {
        // Arrange
        const track = mock<SpotifyApi.TrackObjectFull>();
        track.uri = "trackid";
        track.name = "trackname";
        track.artists = [];

        const trackObject = mock<SpotifyApi.PlaylistTrackObject>();
        trackObject.track = track;

        const responseBody = mock<SpotifyApi.PlaylistTrackResponse>();
        responseBody.items = [trackObject];

        const apiResponse = mock<Response<SpotifyApi.PlaylistTrackResponse>>();
        apiResponse.body = responseBody;

        api.getPlaylistTracks.mockResolvedValue(apiResponse);
        const wrapper = new SpotifyApiWrapper(api, logger);

        // Act
        const act = () => wrapper.getPlaylist("spotify:playlist:id");

        // Assert
        const expectedResult: ISongInfo[] = [{ uri: "trackid", source: MediaLibrary.Spotify, title: "trackname", artist: "", requestedBy: "", imageUrl: "" }];
        await expect(act()).resolves.toEqual(expectedResult);
    });

    test('getPlaylist with wrong id format', async () => {
        // Arrange
        const wrapper = new SpotifyApiWrapper(api, logger);

        // Act
        const act = () => wrapper.getPlaylist("id");

        // Assert
        await expect(act()).rejects.toEqual("Wrong id format");
    });
});
