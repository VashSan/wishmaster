

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
    

    private isConnected: boolean = false;
    private spotifyAuth: SpotifyAuth | undefined;
    

    private get isSpotifyEnabled(): boolean {
        return this.spotifyConfig.authPort > 0
            && this.spotifyConfig.authHost != ""
            && this.spotifyConfig.authProtocol != ""
            && this.spotifyConfig.tokenExpiresInHours > 0
            && this.spotifyConfig.clientId != ""
            && this.spotifyConfig.scopes.length > 0
            && this.spotifyConfig.secretKey != "";
    }

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
        if (!this.isConnected && this.isSpotifyEnabled && this.spotifyAuth) {
            this.spotifyAuth.authenticate(()=> this.isConnected = true);
        } else {
            if (!this.spotifyAuth) {
                this.logger.error("Spotify authentication is not possible. Please file a problem report.");
            } else if (this.isConnected) {
                this.logger.warn("Spotify is already connected");
            } else {
                this.logger.warn("Spotify is not configured correctly");
            }
        }

        //this.logger.info(`Songrequest listening on ${this.spotifyConfig.listenPort}`);
        this.isConnected = true; // TODO wait for authentication
    }

    /** Enqueue the requested song to the playlist */
    public act(msg: IMessage): void {
        if (!this.isSpotifyEnabled) {
            return;
        }

        let response = this.createResponse('SongRequest Loopback' + msg.toString());
        this.sendResponse(response);
    }



}
