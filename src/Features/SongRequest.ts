
import SpotifyWebApi = require("spotify-web-api-node");
import { ILogger, LogManager } from "psst-log";


import { IContext, IMessage, ISpotifyConfig } from "../shared";
import { FeatureBase } from "./FeatureBase";
import { SpotifyAuth, IAccessToken } from "./SongRequest/SpotifyAuth";
import { Playlist, IPlaylist, ISongInfo, MediaLibrary } from "./SongRequest/PlayList";

export interface ISongRequest {
    /** Invoke first to initialize the connection to spotify api */
    connect(): void;
}

export interface IApiWrapper {
    /**
     * Instead of directly playing requested songs, the API will use the provided
     * instance to enqueue songs.
     * @param playlist 
     */
    usePlaylist(playlist: IPlaylist): void;
    updateApiToken(token: string): void;
    requestSong(request: string, msg: IMessage): void;
    requestCurrentSongInfo(msg: IMessage): void;

    isPausedOrStopped(): Promise<boolean>;
    playNow(uri: string): void;
}

interface ICanReply {
    reply(text: string): void;
}

class SongInfo implements ISongInfo {
    constructor(track: SpotifyApi.TrackObjectFull, requestBy: string) {
        this.uri = track.uri;
        this.source = MediaLibrary.Spotify;
        this.title = track.name;
        this.artist = track.artists[0].name;
        this.requestedBy = requestBy;
    }

    uri: string;
    source: MediaLibrary;
    title: string;
    artist: string;
    requestedBy: string;
}

class SpotifyApiWrapper implements IApiWrapper {

    private readonly api: SpotifyWebApi;
    private readonly logger: ILogger;
    private readonly chat: ICanReply;
    private playlist: IPlaylist | undefined;

    constructor(chat: ICanReply, api?: SpotifyWebApi, logger?: ILogger) {
        this.chat = chat;
        this.api = api ? api : new SpotifyWebApi();
        this.logger = logger ? logger : LogManager.getLogger();
    }

    public usePlaylist(playlist: IPlaylist) {
        this.playlist = playlist;
    }

    public updateApiToken(token: string): void {
        this.api.setAccessToken(token);
    }

    public requestSong(request: string, msg: IMessage) {
        const spotifyRegex = /spotify:track:([A-Za-z0-9]+)|https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]+)/;
        const result = spotifyRegex.exec(request);
        if (result != null && result.length > 1) {
            let songId = result[1] ? result[1] : result[2];
            this.requestSongById(songId, msg);
        } else {
            this.requestSongByName(request, msg);
        }
    }

    private requestSongByName(request: string, msg: IMessage) {

        const pl = this.playlist;
        const api = this.api;
        function searchTracks() {
            if (pl) {
                return api.searchTracks(request);
            } else {
                return api
                    .getMyCurrentPlaybackState()
                    .then((state) => {
                        if (!state.body.is_playing) {
                            return api.searchTracks(request);
                        } else {
                            return Promise.reject("Currently only one song is allowed in the queue.");
                        }
                    });
            }
        }

        searchTracks()
            .then((result) => {
                const track = result?.body.tracks?.items[0];
                if (track != undefined) {
                    const song = new SongInfo(track, msg.from);
                    return this.playOrEnqueueTrack(song);
                }
            })
            .catch((err) => this.handleRequestError(msg, err));
    }

    private requestSongById(songId: string, msg: IMessage) {
        this.api.getMyCurrentPlaybackState()
            .then((state) => {
                if (!state.body.is_playing) {
                    return this.api.getTrack(songId);
                }
            })
            .then((track) => {
                if (track && track.body) {
                    const song = new SongInfo(track.body, msg.from);
                    return this.playOrEnqueueTrack(song);
                }
            })
            .catch((err) => this.handleRequestError(msg, err));
    }

    private playOrEnqueueTrack(song: ISongInfo): Promise<void> | PromiseLike<void | undefined> {
        if (this.playlist) {
            this.playlist.enqueue(song);
            return Promise.resolve();
        } else {
            // API has an own response type I cannot use, so translate with this thingy
            return this.api
                .play({ uris: [song.uri] })
                .then(() => Promise.resolve())
                .catch((err) => Promise.reject(err));
        }
    }

    private handleRequestError(msg: IMessage, err: any) {
        this.logger.warn("[!sr] Could not retrieve song.", JSON.stringify(err), JSON.stringify(msg));
        this.chat.reply(`Sorry @${msg.from} - your song was not found!`);
    }

    public requestCurrentSongInfo(msg: IMessage) {
        this.api.getMyCurrentPlaybackState().then((state) => {
            if (state.body.is_playing) {
                return this.api.getMyCurrentPlayingTrack();
            }
        }).then((result) => {
            if (result) {
                const trackNameOpt = result.body.item?.name.toString();
                const trackName = trackNameOpt || "";
                const artistOpt = result.body.item?.artists[0].name.toString();
                const artist = artistOpt || "";

                if (trackName != "") {
                    this.chat.reply(`Current song: '${trackName}' from ${artist}`);
                }
            }
        }).catch((err) => {
            // What could possibly go wrong?
            this.logger.error("[!song] Could not retrieve song info.", JSON.stringify(err), JSON.stringify(msg));
        });
    }

    public async isPausedOrStopped(): Promise<boolean> {
        const state = await this.api.getMyCurrentPlaybackState();

        if (state.body.is_playing == undefined) {
            return Promise.reject("Unknown playback state");
        }
        else {
            return Promise.resolve(!state.body.is_playing);
        }
    }

    public playNow(uri: string): void {
        this.api.play({ uris: [uri] });
    }
}

/** Enqueue songs to a playlist */
export class SongRequest extends FeatureBase implements ISongRequest, ICanReply {

    private readonly spotifyConfig: ISpotifyConfig;
    private readonly logger: ILogger;
    private readonly api: IApiWrapper;
    private readonly playlist: IPlaylist;

    private spotifyAuth: SpotifyAuth | undefined;
    private token: IAccessToken | undefined;

    constructor(context: IContext, apiWrapper?: IApiWrapper, playlist?: IPlaylist, logger?: ILogger) {
        super(context.getConfiguration());

        this.logger = logger ? logger : LogManager.getLogger();
        this.api = apiWrapper ? apiWrapper : new SpotifyApiWrapper(this);
        this.playlist = playlist ? playlist : new Playlist(this.api);

        // if no playlist is used, then songs are played immediately
        this.api.usePlaylist(this.playlist);

        this.spotifyConfig = {
            authProtocol: "",
            authHost: "",
            authPort: 0,
            tokenExpiresInHours: 0,
            secretKey: "",
            clientId: "",
            scopes: [],
        };

        let songRequestConfig = this.config.getSongRequest();
        if (songRequestConfig != null) {
            this.spotifyConfig = songRequestConfig.spotify;

            const fs = context.getFileSystem();
            const configDir = this.config.getConfigDir();
            const pathToTokenFile = fs.joinPaths(configDir, "spotifyToken.dat");
            this.spotifyAuth = new SpotifyAuth(this.spotifyConfig, pathToTokenFile, fs);
        }
    }

    public reply(text: string): void {
        const r = this.createResponse(text);
        this.sendResponse(r);
    }

    public connect(): void {
        if (!this.isSpotifyConnected() && this.spotifyAuth) {
            this.spotifyAuth.authenticate(() => {
                this.token = this.spotifyAuth?.getAccessToken();
                this.updateApiToken();
                this.playlist.start();
            });
        } else {
            if (!this.spotifyAuth) {
                this.logger.error("Spotify authentication is not possible. Please file a problem report.");
            } else if (this.isSpotifyConnected()) {
                this.logger.warn("Spotify is already connected");
            } else {
                this.logger.warn("Spotify is not configured correctly");
            }
        }
    }

    private isSpotifyConnected(): boolean {
        return this.isSpotifyEnabled() && this.token != undefined;
    }

    private isSpotifyEnabled(): boolean {
        return this.spotifyConfig.authPort > 0
            && this.spotifyConfig.authHost != ""
            && this.spotifyConfig.authProtocol != ""
            && this.spotifyConfig.tokenExpiresInHours > 0
            && this.spotifyConfig.clientId != ""
            && this.spotifyConfig.scopes.length > 0
            && this.spotifyConfig.secretKey != "";
    }

    /** Enqueue the requested song to the playlist */
    public act(msg: IMessage): void {
        if (this.token == "") {
            return;
        }
        const splits = msg.text.split(" ");
        const cmd = splits[0].toLowerCase();
        const request = splits.slice(1).join(" ");

        if (!this.spotifyAuth) {
            return;
        }

        this.updateApiToken();
        if (cmd == "!sr" || cmd == "!songrequest") {
            this.api.requestSong(request, msg);
        } else if (cmd == "!song") {
            this.api.requestCurrentSongInfo(msg);
        }
    }
    
    private updateApiToken() {
        const token = this.token?.toString() || "";
        if (this.token == "") {
            return;
        }

        this.api.updateApiToken(token);
    }

}
