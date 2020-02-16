
import SpotifyWebApi = require("spotify-web-api-node");
import { ILogger, LogManager } from "psst-log";


import { IContext, IMessage, ISpotifyConfig } from "../shared";
import { FeatureBase } from "./FeatureBase";
import { SpotifyAuth, IAccessToken } from "./SongRequest/SpotifyAuth";
import { Playlist, IPlaylist } from "./SongRequest/PlayList";

export interface ISongRequest {
    /** Invoke first to initialize the connection to spotify api */
    connect(): void;
}

export interface IApiWrapper {
    updateApiToken(token: string): void;
    requestSong(request: string, msg: IMessage): void;
    requestCurrentSongInfo(msg: IMessage): void;
}

interface ICanReply {
    reply(text: string): void;
}

class SpotifyApiWrapper implements IApiWrapper {

    private readonly api: SpotifyWebApi;
    private readonly logger: ILogger;
    private readonly chat: ICanReply;

    constructor(chat: ICanReply, api?: SpotifyWebApi, logger?: ILogger) {
        this.chat = chat;
        this.api = api ? api : new SpotifyWebApi();
        this.logger = logger ? logger : LogManager.getLogger();
    }

    updateApiToken(token: string): void {
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
        this.api.getMyCurrentPlaybackState()
            .then((state) => {
                if (!state.body.is_playing) {
                    return this.api.searchTracks(request);
                }
            })
            .then((result) => {
                if (result != undefined) {
                    return result.body.tracks?.items[0].uri;
                }
            })
            .then((trackid) => this.playTrack(trackid))
            .catch((err) => this.handleRequestError(msg, err));
    }

    private requestSongById(songId: string, msg: IMessage) {
        this.api.getMyCurrentPlaybackState()
            .then((state) => {
                if (!state.body.is_playing) {
                    return this.api.getTrack(songId);
                }
            })
            .then((track) => this.playTrack(track?.body.uri))
            .catch((err) => this.handleRequestError(msg, err));
    }

    private playTrack(uri?: string) {
        if (uri) {
            return this.api.play({ uris: [uri] });
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

        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }

        if (apiWrapper) {
            this.api = apiWrapper;
        } else {
            this.api = new SpotifyApiWrapper(this);
        }

        if (playlist) {
            this.playlist = playlist;
        } else {
            this.playlist = new Playlist(this.api);
        }

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

        const token = this.token?.toString() || "";
        if (this.token == "") {
            return;
        }

        this.api.updateApiToken(token);
        if (cmd == "!sr" || cmd == "!songrequest") {
            this.api.requestSong(request, msg);
        } else if (cmd == "!song") {
            this.api.requestCurrentSongInfo(msg);
        }
    }

}
