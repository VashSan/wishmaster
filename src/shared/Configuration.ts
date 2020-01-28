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
}

export interface IStomtConfig {
    applicationId: string;
    baseUrl: string;
}

export interface ISongRequestConfig {
    spotify: ISpotifyConfig;
}

export interface ISpotifyConfig {
    listenPort: number;
    secretKey: string;
    clientId: string;
    scopes: string[];
    redirectUri: string;
}

export interface IConfiguration extends IService {
    getServer(): string;
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

    server: string = "";  
    getServer() {
        return this.server;
    }
    
    nickname: string = "";
    password: string = "";
    channel: string = "";
    msgLimitPer30Sec: number = 20;
    verbosity: string = "debug,info,warn,error";
    createLogFile: boolean = false;
    createLogConsole: boolean = true;
    mediaPlayer: string = "";
    mediaPlayerArgs: string[] = [];
    alerts: IAlert[] = [];
    email: IEmailConfig | null = null;
    obs: IObsConfig | null = null;
    urlWhiteList: string[] = [];
    staticAnswers: IStaticAnswer[] = [];
    stomt: IStomtConfig | null = null;
    songRequest: ISongRequestConfig | null = null;
    maxLogAgeDays = 10;

    // runtime options
    rootPath: string;
    logDir: string;

    constructor(configDir?: string, fileAccess?: IFileSystem, logger?: ILogger) {
        if (!logger) {
            logger = LogManager.getLogger();
        }

        if (fileAccess){
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
        let configObj = JSON.parse(configString);

        (<any>Object).assign(this, configObj);

        this.rootPath = path.dirname(process.argv[1]);
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