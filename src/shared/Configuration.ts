import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ILogger, LogManager } from "psst-log";

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

export class Configuration {
    private configDir: string;
    private configFile: string = "wishmaster.json";
    private configFilePath: string;

    server: string = "";
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

    constructor(configDir?: string, logger?: ILogger) {
        if (!logger) {
            logger = LogManager.getLogger();
        }

        if (configDir) {
            this.configDir = configDir;
        } else {
            this.configDir = path.join(process.env.localappdata || os.homedir(), '.wishmaster');
        }
        Configuration.createDirIfNecessary(this.configDir);

        this.logDir = path.resolve(this.configDir, "log");
        Configuration.createDirIfNecessary(this.logDir);

        this.configFilePath = path.join(this.configDir, this.configFile);

        if (!fs.existsSync(this.configFilePath)) {
            logger.error("The configuration does not exist. Will create a basic file but you need to create a setup and restart the bot.");

            fs.writeFileSync(this.configFilePath,
                `{"server": "", "nickname": "", "password": "", "channel": ""}`);
        }

        let configFile = fs.readFileSync(this.configFilePath);
        let configString = configFile.toString("utf8");
        let configObj = JSON.parse(configString);

        (<any>Object).assign(this, configObj);

        this.rootPath = path.dirname(process.argv[1]);
    }

    private static createDirIfNecessary(path: string): void {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
    }

    public getConfigDir(): string {
        return this.configDir;
    }

}