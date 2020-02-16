
import SpotifyWebApi = require("spotify-web-api-node");
import { ILogger, LogManager } from "psst-log";


import { IContext, IMessage, ISpotifyConfig } from "../shared";
import { FeatureBase } from "./FeatureBase";
import { SpotifyAuth, IAccessToken } from "./SongRequest/SpotifyAuth";

export interface ISongRequest {
    /** Invoke first to initialize the connection to spotify api */
    connect(): void;
}

/** Enqueue songs to a playlist */
export class SongRequest extends FeatureBase implements ISongRequest {
    private readonly spotifyConfig: ISpotifyConfig;
    private readonly logger: ILogger;
    private readonly api: SpotifyWebApi;

    private spotifyAuth: SpotifyAuth | undefined;
    private token: IAccessToken | undefined;

    constructor(context: IContext, logger?: ILogger) {
        super(context.getConfiguration());

        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
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

        this.api = new SpotifyWebApi();

        let songRequestConfig = this.config.getSongRequest();
        if (songRequestConfig != null) {
            this.spotifyConfig = songRequestConfig.spotify;

            const fs = context.getFileSystem();
            const configDir = this.config.getConfigDir();
            const pathToTokenFile = fs.joinPaths(configDir, "spotifyToken.dat");
            this.spotifyAuth = new SpotifyAuth(this.spotifyConfig, pathToTokenFile, fs);
        }
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

        this.api.setAccessToken(token);
        if (cmd == "!sr" || cmd == "!songrequest") {
            this.requestSong(request, msg);
        } else if (cmd == "!song") {
            this.requestCurrentSongInfo(msg);
        }
    }

    private requestSong(request: string, msg: IMessage) {
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
        const r = this.createResponse(`Sorry @${msg.from} - your song was not found!`)
        this.sendResponse(r);
    }

    private requestCurrentSongInfo(msg: IMessage) {
        this.api.getMyCurrentPlaybackState().then((state) => {
            if (state.body.is_playing) {
                return this.api.getMyCurrentPlayingTrack();
            }
        }).then((result) => {
            if (result) {
                const v = result.body.item?.name.toString();
                const trackName = v || "";

                if (trackName != "") {
                    const r = this.createResponse(`Current song: ${trackName}`);
                    this.sendResponse(r);
                }
            }
        }).catch((err) => {
            // What could possibly go wrong?
            this.logger.error("[!song] Could not retrieve song info.", JSON.stringify(err), JSON.stringify(msg));
        });
    }

}
