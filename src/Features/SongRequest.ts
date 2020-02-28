
import { ILogger, LogManager } from "psst-log";
import { IContext, IMessage, ISpotifyConfig, Seconds, ISongRequestConfig, IgnoreDuringTimeout } from "../shared";
import { FeatureBase } from "./FeatureBase";
import { Playlist, IPlaylist, SpotifyAuth, SpotifyApiWrapper, IAccessToken, ISongInfo, IWebAuth } from "./SongRequestLib";
import SongListWriter, { ISongListWriter } from "./SongRequestLib/SongListWriter";
import { IArgument } from "../shared/CommandLine";

export interface ISongRequest {
    /** Invoke first to initialize the connection to spotify api */
    connect(): void;
}

export interface IPlaybackDevice {
    id: string;
    name: string;
}

export interface IApiWrapper {
    getPlaybackDevices(): Promise<IPlaybackDevice[]>;
    getRemainingTrackTime(): Promise<Seconds>;
    getSong(request: string, msg: IMessage): Promise<ISongInfo>;
    isPausedOrStopped(): Promise<boolean>;
    playNow(uri: string): void;
    requestCurrentSongInfo(msg: IMessage): void;
    setVolume(volumePercent: number): void;
    setPlaybackDevice(device: IPlaybackDevice): void;
    updateApiToken(token: string): void;
}

export interface ICanReply {
    reply(text: string): void;
}


/** Enqueue songs to a playlist */
export class SongRequest extends FeatureBase implements ISongRequest, ICanReply {
    private readonly argument: IArgument | undefined;
    private readonly songRequestConfig: ISongRequestConfig | null;
    private readonly spotifyConfig: ISpotifyConfig;
    private readonly logger: ILogger;
    private readonly api: IApiWrapper;
    private readonly playlist: IPlaylist;
    private readonly songlistWriter: ISongListWriter;
    private readonly deviceList: IPlaybackDevice[] = [];
    private spotifyAuth: IWebAuth | undefined;
    private token: IAccessToken | undefined;

    constructor(context: IContext, apiAuth?: IWebAuth, apiWrapper?: IApiWrapper, playlist?: IPlaylist, logger?: ILogger, songListWriter?: ISongListWriter) {
        super(context.getConfiguration());
        this.argument = context.getArgument("spotify");

        this.logger = logger ? logger : LogManager.getLogger();
        this.api = apiWrapper ? apiWrapper : new SpotifyApiWrapper(this);

        this.spotifyConfig = {
            authProtocol: "",
            authHost: "",
            authPort: 0,
            device: "",
            tokenExpiresInHours: 0,
            secretKey: "",
            clientId: "",
            scopes: [],
            minVolumeByCommand: 20,
            maxVolumeByCommand: 80
        };

        this.songRequestConfig = this.config.getSongRequest();
        if (this.songRequestConfig != null) {
            this.playlist = playlist ? playlist : new Playlist(this.api, this.songRequestConfig.playlist);

            this.spotifyConfig = this.songRequestConfig.spotify;

            const fs = context.getFileSystem();
            const configDir = this.config.getConfigDir();
            const pathToTokenFile = fs.joinPaths(configDir, "spotifyToken.dat");
            this.spotifyAuth = apiAuth ? apiAuth : new SpotifyAuth(this.spotifyConfig, pathToTokenFile, fs);
        } else {
            this.playlist = playlist ? playlist : new Playlist(this.api);
        }

        this.playlist.onNext(() => {
            this.updateSongList();
        });

        const listTarget = this.songRequestConfig?.writeSongListTo || "";
        this.songlistWriter = songListWriter ? songListWriter : new SongListWriter(this.playlist, listTarget);
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
                this.updatePlaybackDevices();
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

    private updatePlaybackDevices() {
        this.api.getPlaybackDevices()
            .then((devices) => {
                devices.forEach((item) => {
                    this.deviceList.push(item);
                    this.logger.info(`Spotify Device Name: '${item.name}', ID: '${item.id}'`);
                });

                if (this.spotifyConfig.device != "") {
                    this.useDeviceId(this.spotifyConfig.device);
                }

                this.evalArgument();
            })
            .catch((err) => {
                this.logger.warn("Could not update playback devices: ", err);
            });
    }

    private evalArgument() {
        if (this.argument) {
            switch (this.argument.values[0].toLowerCase()) {
                case "useDeviceId".toLowerCase():
                    this.useDeviceId(this.argument.values[1]);
                    break;

                default:
                    this.logger.warn("Invalid Syntax: -spotify useDeviceId <id>");
            }
        }
    }

    private useDeviceId(arg: string | undefined) {
        if (arg) {
            const searchArg = arg.toLowerCase();
            const device = this.deviceList.find((item) => {
                return item.name.toLowerCase() == searchArg || item.id.toLowerCase() == searchArg;
            });
            if (device) {
                this.api.setPlaybackDevice(device);
                this.logger.info(`Spotify Device found: '${device.name}'`);
            } else {
                this.logger.warn(`Spotify Device '${arg}' was not found. Will retry in a few seconds.`);
                setTimeout(() => {
                    this.updatePlaybackDevices();
                }, new Seconds(5).inMilliseconds());
            }

        } else {
            this.logger.warn("-spotify: No Device ID given");
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

        const commandMap = new Map<string, () => void>();
        commandMap.set("!sr", () => this.requestSong(request, msg));
        commandMap.set("!songrequest", () => this.requestSong(request, msg));
        commandMap.set("!song", () => this.requestCurrentSong());
        commandMap.set("!skip", () => this.skipCurrentSong(msg));
        commandMap.set("!rs", () => this.removeMyLastRequest(msg.from));
        commandMap.set("!sr-start", () => this.playlist.start());
        commandMap.set("!sr-stop", () => this.playlist.stop());
        commandMap.set("!volume", () => this.setVolume(request, msg));
        commandMap.set("!songlist", () => this.requestSongList());

        const executor = commandMap.get(cmd);
        if (executor) {
            executor.call(this);
        }
    }

    private updateApiToken() {
        const token = this.token?.toString() || "";
        if (this.token == "") {
            return;
        }

        this.api.updateApiToken(token);
    }

    private requestSong(request: string, msg: IMessage) {
        this.api.getSong(request, msg)
            .then((song: ISongInfo) => {
                if (this.playlist.isInQueue(song)) {
                    this.reply(`Sorry @${song.requestedBy}, the song is already in the queue.`);
                }

                if (this.playlist.enqueue(song)) {
                    this.updateSongList();
                    this.reply(`SingsNote @${song.requestedBy} added '${song.title}' (from ${song.artist}) to the playlist SingsNote`);
                } else {
                    this.reply(`Sorry @${song.requestedBy}, you can not add more songs to the playlist.`);
                }
            })
            .catch((err) => {
                this.logger.error("SongRequest.requestSong: Could not get song.", JSON.stringify(err), JSON.stringify(msg));
                this.reply(`Sorry @${msg.from}, I could not find your song.`);
            });
    }

    private requestCurrentSong() {
        const song = this.playlist.getCurrent();
        if (song) {
            this.reply(`SingsNote Current song: '${song.title}' from ${song.artist}`);
        }
    }

    private setVolume(request: string, msg: IMessage): void {
        if (!this.isModOrBroadcaster(msg.tags)) {
            this.logger.log(`SongRequest.setVolumne: Request to change volume by '${msg.from}' was denied.`);
            return;
        }

        const regex = /([0-9])+/;
        let result = regex.exec(request);
        if (result && result?.length > 1) {
            let targetVolume = parseInt(result[0]);
            if (targetVolume > this.spotifyConfig.maxVolumeByCommand) {
                targetVolume = this.spotifyConfig.maxVolumeByCommand;
            }

            if (targetVolume < this.spotifyConfig.minVolumeByCommand) {
                targetVolume = this.spotifyConfig.minVolumeByCommand;
            }

            this.logger.log(`SongRequest.setVolumne: Request volume change to ${targetVolume}.`);
            this.api.setVolume(targetVolume);
        }
    }

    private skipCurrentSong(msg: IMessage) {
        if (this.playlist.getCurrent()?.requestedBy.toLowerCase() == msg.from.toLowerCase()) {
            this.skipImmediately();
            return;
        }

        const canSkip = this.isModOrBroadcaster(msg.tags);
        if (canSkip) {
            this.skipImmediately();
        }
    }

    private skipImmediately() {
        this.playlist.skip();
    }

    private removeMyLastRequest(user: string) {
        const removedSong = this.playlist.removeLastSongFromUser(user);
        if (removedSong) {
            this.updateSongList();
            this.reply(`@${user}, I removed '${removedSong.title}' from the playlist.`);
        }
    }

    private readonly replySongListHandler = new IgnoreDuringTimeout(new Seconds(30), null, (arg) => {
        const songListUrl = this.getPublicSongListUrl();
        this.reply(`SingsNote The current songlist is here: ${songListUrl}`);

    });

    private requestSongList(): void {
        if (this.getPublicSongListUrl() != "") {
            this.replySongListHandler.handle();
        }
    }

    private getPublicSongListUrl(): string {
        return this.songRequestConfig?.songListUrl || "";
    }

    private updateSongList() {
        this.songlistWriter.update();
    }
}

export default SongRequest;