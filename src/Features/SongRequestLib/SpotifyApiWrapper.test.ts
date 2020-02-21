import { SpotifyApiWrapper, SongInfo } from ".";
import { ICanReply } from "../SongRequest";
import { mock, MockProxy } from "jest-mock-extended";
import SpotifyWebApi = require("spotify-web-api-node");
import { ILogger } from "psst-log";
import { Seconds, IMessage } from "../../shared";
import { IPlaylist } from "./Playlist";

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
        api = mock<SpotifyWebApi>();
        logger = mock<ILogger>();
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
        const wrapper = new SpotifyApiWrapper(chat, api, logger);

        wrapper.updateApiToken("token");

        expect(api.setAccessToken).toBeCalledWith("token");
    });

    test('usePlaylist, requestSong', (done) => {
        // Arrange
        const response = createSearchResponseMock();

        api.searchTracks.mockResolvedValue(response);

        const wrapper = new SpotifyApiWrapper(chat, api, logger);

        // Act
        const playlist = mock<IPlaylist>();
        wrapper.usePlaylist(playlist);

        const message: IMessage = { channel: "", from: "alice", text: "!sr Innuendo Queen" };
        wrapper.requestSong("Innuendo Queen", message);

        // Assert
        setTimeout(() => {
            expect(playlist.enqueue).toBeCalledTimes(1);
            done();
        }, new Seconds(0.1).inMilliseconds());
    });

    test('requestSong by URI', (done) => {
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
        const playlist = mock<IPlaylist>();
        playlist.enqueue.mockReturnValue(true);
        wrapper.usePlaylist(playlist);

        const message: IMessage = { channel: "", from: "alice", text: "!sr spotify:track:46gsGxk2iUctmgJUmQRTKz" };
        wrapper.requestSong("spotify:track:46gsGxk2iUctmgJUmQRTKz", message);

        // Assert
        setTimeout(() => {
            expect(playlist.enqueue).toBeCalledTimes(1);
            expect(chat.reply).toBeCalledTimes(1);

            done();
        }, new Seconds(1).inMilliseconds());
    });

});
