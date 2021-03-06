import * as os from "os";
import * as path from "path";
import { ILogger, LogManager } from "psst-log";
import { IService } from "./Context";
import { FileSystem, IFileSystem } from ".";

export enum AlertTrigger {
    ChatMessage = "ChatMessage",
    NewFollower = "NewFollower",
    NewSubscriber = "NewSubscriber",
    Donation = "Donation",
    BitDonation = "BitDonation"
}

export enum AlertAction {
    ToggleSceneItem = "ToggleSceneItem",
    PlaySoundFile = "PlaySoundFile",
    WriteTextMessage = "WriteTextMessage"
}

export enum DefeatableFeature {
    Alerts = "Alerts",
    Bets = "Bets",
    EmailConnection = "EmailConnection", // used by alerts, ...
    MediaPlayer = "MediaPlayer", // used by alerts, ...
    ObsController = "ObsController", // used by alerts, ...
    SongRequest = "SongRequest",
    StaticAnswers = "StaticAnswers",
    Stomt = "Stomt",
    UrlFilter = "UrlFilter",
    Console = "Console"
}

export interface IAlert {
    trigger: AlertTrigger;
    action: AlertAction;
    parameter: string;
    sceneTextSource: string;
    sceneTextPattern: string;
    bannerTextSource: string;
    bannerTextPattern: string;
    chatPattern: string;
    durationInSeconds: number;
    timeoutInSeconds: number;
}

export interface IEmailConfig {
    address: string;
    host: string;
    port: number;
    tls: boolean;
    login: string;
    password: string;
}

export interface IObsConfig {
    address: string;
    port: number;
    password: string;
}

export interface IStaticAnswer {
    trigger: string;
    answer: string;
    soundFile?: string;
    timeoutInSeconds?: number;
}

export interface IStomtConfig {
    applicationId: string;
    baseUrl: string;
}

export interface ISongRequestConfig {
    writeSongListTo: string;
    songListUrl: string;
    defaultPlaylist: string;
    currentSong: ICurrentSongConfig;
    playlist: IPlaylistConfig;
    spotify: ISpotifyConfig;
}

export interface ICurrentSongConfig {
    obsSource: string;
    htmlObsFile: string;
    htmlTemplateFile: string;
}

export interface IPlaylistConfig {
    updateIntervalInSeconds: number;
    maxQueueLength: number;
    maxEntriesPerUser: number;
}

export interface ISpotifyConfig {
    authProtocol: string;
    authHost: string;
    authPort: number;
    device: string;
    tokenExpiresInHours: number;
    secretKey: string;
    clientId: string;
    scopes: string[];
    minVolumeByCommand: number;
    maxVolumeByCommand: number;
}

export interface IMessageProcessorConfig {
    /** max messages within the response interval */
    responseLimitPerInterval: number;
    /** within this interval a certain max message count is measured */
    responseIntervalInMilliseconds: number;
    /** to avoid sending all responses at once we send out this max number */
    maxNumberOfResponsesPerDelayInterval: number;
    /** in this interval the check for delayed messages is perfomred */
    delayIntervalInMilliseconds: number;
}

export interface IConfiguration extends IService {
    /** get enabled features */
    getEnabledFeatures(): DefeatableFeature[];

    /** get the host name of the IRC server to connect to  */
    getServer(): string;

    /** get the logon name to use with the IRC server */
    getNickname(): string;

    /** get the passphrase to use when logging on to the IRC server */
    getPassword(): string;

    /** get the IRC channel to join */
    getChannel(): string;

    /** the log levels the logger shall output to its targets (e.g. file) */
    getVerbosity(): string;

    /** whether to log to a file or not */
    getCreateLogFile(): boolean;

    /** whether to log to console or not */
    getCreateLogConsole(): boolean;

    /** the sound player to use for audio output */
    getMediaPlayer(): string;

    /** the sound player argument options send to the media player */
    getMediaPlayerArgs(): string[];

    /** Configuration of trigger causing OBS to react */
    getAlerts(): IAlert[];

    /** Mailbox to scan for triggers (e.g. follower alerts) */
    getEmail(): IEmailConfig | null;

    /** OBS specific configuration */
    getObs(): IObsConfig | null;

    /** URL patterns that the URL filter allows to be posted to the chat */
    getUrlWhiteList(): string[];

    /** The minimum time to wait in between any static answer. */
    getStaticAnswersGlobalTimeout(): number;

    /** Chat reactions upons certain commands */
    getStaticAnswers(): IStaticAnswer[];

    /** Stomt specific configuration */
    getStomt(): IStomtConfig | null;

    /** Song request specific configuration */
    getSongRequest(): ISongRequestConfig | null;

    /** number of days the log files are kept */
    getMaxLogAgeDays(): number;

    /** define special data for message processor */
    getMessageProcessorConfig(): IMessageProcessorConfig | null;

    /** The base path containing config files etc. */
    getRootPath(): string;

    /** The directory the log files are written to */
    getLogDir(): string;

    /** The directory the configuration can be found in */
    getConfigDir(): string;
}

export class Configuration implements IConfiguration {
    public static readonly ServiceName = "Configuration";
    getServiceName(): string {
        return Configuration.ServiceName;
    }

    private readonly fs: IFileSystem;
    private configDir: string;
    private configFile: string = "wishmaster.json";
    private configFilePath: string;

    constructor(configDir?: string, fileAccess?: IFileSystem, logger?: ILogger) {
        if (!logger) {
            logger = LogManager.getLogger();
        }

        if (fileAccess) {
            this.fs = fileAccess;
        } else {
            this.fs = new FileSystem();
        }

        if (configDir) {
            this.configDir = configDir;
        } else {
            this.configDir = path.join(process.env.localappdata || os.homedir(), '.wishmaster');
        }
        this.createDirIfNecessary(this.configDir);

        this.logDir = path.resolve(this.configDir, "log");
        this.createDirIfNecessary(this.logDir);

        this.configFilePath = path.join(this.configDir, this.configFile);

        if (!this.fs.exists(this.configFilePath)) {
            logger.error("The configuration does not exist.");

            throw new Error("You need to create configuration file");
        }

        let configString = this.fs.readAll(this.configFilePath);

        try {
            let configObj = JSON.parse(configString);
            (<any>Object).assign(this, configObj);
        } catch (err) {
            logger.error("Error in configuration file, exiting program.", err);
            process.exit(1);
        }


        this.rootPath = path.dirname(process.argv[1]);
    }

    enabledFeatures: DefeatableFeature[] = [];
    getEnabledFeatures(): DefeatableFeature[] {
        return this.enabledFeatures;
    }

    server: string = "";
    getServer() {
        return this.server;
    }

    nickname: string = "";
    getNickname(): string {
        return this.nickname;
    }

    password: string = "";
    getPassword(): string {
        return this.password;
    }

    channel: string = "";
    getChannel(): string {
        return this.channel;
    }

    verbosity: string = "debug,info,warn,error";
    getVerbosity(): string {
        return this.verbosity;
    }

    createLogFile: boolean = false;
    getCreateLogFile(): boolean {
        return this.createLogFile;
    }

    createLogConsole: boolean = true;
    getCreateLogConsole(): boolean {
        return this.createLogConsole;
    }

    mediaPlayer: string = "";
    getMediaPlayer(): string {
        return this.mediaPlayer;
    }

    mediaPlayerArgs: string[] = [];
    getMediaPlayerArgs(): string[] {
        return this.mediaPlayerArgs;
    }

    alerts: IAlert[] = [];
    getAlerts(): IAlert[] {
        return this.alerts;
    }

    email: IEmailConfig | null = null;
    getEmail(): IEmailConfig | null {
        return this.email;
    }

    obs: IObsConfig | null = null;
    getObs(): IObsConfig | null {
        return this.obs;
    }

    urlWhiteList: string[] = [];
    getUrlWhiteList(): string[] {
        return this.urlWhiteList;
    }

    staticAnswersGlobalTimeout: number = 15;
    getStaticAnswersGlobalTimeout(): number {
        return this.staticAnswersGlobalTimeout;
    }

    staticAnswers: IStaticAnswer[] = [];
    getStaticAnswers(): IStaticAnswer[] {
        return this.staticAnswers;
    }

    stomt: IStomtConfig | null = null;
    getStomt(): IStomtConfig | null {
        return this.stomt;
    }

    songRequest: ISongRequestConfig | null = null;
    getSongRequest(): ISongRequestConfig | null {
        return this.songRequest;
    }

    maxLogAgeDays = 10;
    getMaxLogAgeDays(): number {
        return this.maxLogAgeDays;
    }

    rootPath: string;
    getRootPath(): string {
        return this.rootPath;
    }

    logDir: string;
    getLogDir(): string {
        return this.logDir;
    }

    messageProcessorConfig: IMessageProcessorConfig | null = null;
    getMessageProcessorConfig(): IMessageProcessorConfig | null {
        return this.messageProcessorConfig;
    }

    private createDirIfNecessary(path: string): void {
        if (!this.fs.exists(path)) {
            this.fs.createDirectory(path);
        }
    }

    public getConfigDir(): string {
        return this.configDir;
    }

}