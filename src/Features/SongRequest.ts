
import { ILogger, LogManager } from "psst-log";
import { IContext, IMessage, ISpotifyConfig, Seconds } from "../shared";
import { FeatureBase } from "./FeatureBase";
import { SpotifyAuth, IAccessToken } from "./SongRequest/SpotifyAuth";
import { Playlist, IPlaylist } from "./SongRequest/Playlist";
import { SpotifyApiWrapper } from "./SongRequest/SpotifyApiWrapper";

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

    getRemainingTrackTime(): Promise<Seconds>;
    isPausedOrStopped(): Promise<boolean>;
    playNow(uri: string): void;
}

export interface ICanReply {
    reply(text: string): void;
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
        } else if (cmd == "!skip") {
            this.skipCurrentSong(msg);
        } else if (msg.text == "!rs") {
            this.removeMyLastRequest(msg.from);
        }
    }

    private updateApiToken() {
        const token = this.token?.toString() || "";
        if (this.token == "") {
            return;
        }

        this.api.updateApiToken(token);
    }

    private skipCurrentSong(msg: IMessage) {
        if (this.playlist.getCurrent()?.requestedBy.toLowerCase() == msg.from.toLowerCase()) {
            this.playlist.skip();
            return;
        }

        const canSkip = msg.tags?.isMod() || msg.tags?.isBroadcaster();
        if (canSkip) {
            this.playlist.skip();
        }
    }

    private removeMyLastRequest(user: string) {
        this.playlist.removeLastSongFromUser(user);
    }
}
