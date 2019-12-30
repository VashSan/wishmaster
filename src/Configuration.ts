import fs = require("fs");
import path = require("path");
import {IStaticAnswer, IStomtConfig, ISongRequestConfig, IEmailAccess} from "./Interfaces";

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
    email: IEmailAccess | null = null;
    urlWhiteList: string[] = [];
    staticAnswers: IStaticAnswer[] = [];
    stomt: IStomtConfig | null = null;
    songRequest: ISongRequestConfig | null = null;
    maxLogAgeDays = 10;

    // runtime options
    rootPath: string;

    constructor() {
        this.configDir = `${process.env.localappdata}\\.wishmaster`;
        this.configFilePath = `${this.configDir}\\${this.configFile}`;

        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir);

            fs.writeFileSync(this.configFilePath,
                `{"server": "", "nickname": "", "password": "", "channel": ""}`);
        }

        let configFile = fs.readFileSync(this.configFilePath);
        let configString = configFile.toString("utf8");
        let configObj = JSON.parse(configString);

        (<any>Object).assign(this, configObj);

        this.rootPath = path.dirname(process.argv[1]);
    }

    public getConfigDir(): string {
        return this.configDir;
    }

}