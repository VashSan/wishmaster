import fs = require("fs");
import path = require("path");
import logger = require("psst-log")

export enum AlertTrigger {
    NewFollower = "NewFollower",
    NewSubscriber = "NewSubscriber",
    Donation = "Donation",
    BitDonation = "BitDonation"
}

export interface IAlert {
    trigger: AlertTrigger;
    toggleSceneItem: string;
    durationInMilliseconds: Number;
}

export interface IEmailAccess {
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
    email: IEmailAccess | null = null;
    obs: IObsConfig | null = null;
    urlWhiteList: string[] = [];
    staticAnswers: IStaticAnswer[] = [];
    stomt: IStomtConfig | null = null;
    songRequest: ISongRequestConfig | null = null;
    maxLogAgeDays = 10;

    // runtime options
    rootPath: string;
    logDir: string;

    constructor(log: logger.ILogger) {
        this.configDir = `${process.env.localappdata}\\.wishmaster`;
        Configuration.createDirIfNecessary(this.configDir);

        this.logDir = path.resolve(this.configDir, "log");
        Configuration.createDirIfNecessary(this.logDir);

        this.configFilePath = `${this.configDir}\\${this.configFile}`;

        if (!fs.existsSync(this.configFilePath)) {
            log.warn("The configuration does not exist. Will create a basic file but you need to create a setup and restart the bot.");

            fs.writeFileSync(this.configFilePath,
                `{"server": "", "nickname": "", "password": "", "channel": ""}`);
        }

        let configFile = fs.readFileSync(this.configFilePath);
        let configString = configFile.toString("utf8");
        let configObj = JSON.parse(configString);

        (<any>Object).assign(this, configObj);

        this.rootPath = path.dirname(process.argv[1]);
    }

    private static createDirIfNecessary(path: string) : void {
        if(!fs.existsSync(path)){
            fs.mkdirSync(path);
        }
    }

    public getConfigDir(): string {
        return this.configDir;
    }

}