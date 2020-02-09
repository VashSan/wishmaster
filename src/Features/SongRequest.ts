

import { ILogger, LogManager } from "psst-log";

import { IContext, IMessage, ISpotifyConfig, Generate } from "../shared";
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

    private get isSpotifyEnabled(): boolean {
        return this.spotifyConfig.listenPort > 0
            && this.spotifyConfig.clientId != ""
            && this.spotifyConfig.redirectUri != ""
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
            listenPort: 0,
            secretKey: "",
            clientId: "",
            scopes: [],
            redirectUri: ""
        };

        let songRequestConfig = this.config.getSongRequest();
        if (songRequestConfig != null) {
            this.spotifyConfig = songRequestConfig.spotify;
            const spotifyAuth = new SpotifyAuth(this.spotifyConfig);
        }
    }

    public connect(): void {
        if (!this.isConnected && this.isSpotifyEnabled) {
            //this.initServer();
        } else {
            if (this.isConnected)
                this.logger.warn("Spotify is already connected");
            else {
                this.logger.warn("Spotify is not configured correctly");
            }
        }

        this.logger.info(`Songrequest listening on ${this.spotifyConfig.listenPort}`);
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
