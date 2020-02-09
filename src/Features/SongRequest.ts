
import SpotifyWebApi = require("spotify-web-api-node");
import { ILogger, LogManager } from "psst-log";


import { IContext, IMessage, ISpotifyConfig } from "../shared";
import { FeatureBase } from "./FeatureBase";
import { SpotifyAuth } from "./SongRequest/SpotifyAuth";

export interface ISongRequest {
    /** Invoke first to initialize the connection to spotify api */
    connect(): void;
}

/** Enqueue songs to a playlist */
export class SongRequest extends FeatureBase implements ISongRequest {
    private readonly spotifyConfig: ISpotifyConfig;
    private readonly logger: ILogger;

    private spotifyAuth: SpotifyAuth | undefined;
    private token: string = "";

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
                this.spotifyAuth?.getAccessToken().then((token) => {
                    this.token = token;
                });
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
        return this.isSpotifyEnabled() && this.token != "";
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

        if (msg.text.trim().toLowerCase() == "#info") {
            const s = new SpotifyWebApi();
            s.setAccessToken(this.token);

            s.getMyCurrentPlayingTrack().then((result) => {
                const v = result.body.item?.name.toString();
                const trackName = v || "";

                if (trackName != "") {
                    const r = this.createResponse(trackName);
                    this.sendResponse(r);
                }
            });
        }
    }



}
