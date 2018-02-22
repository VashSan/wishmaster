import fs = require("fs");

export class Configuration {
    private configDir: string;
    private configFile: string = "wishmaster.json";
    private configFilePath: string;

    server: string = "";
    nickname: string = "";
    password: string = "";
    channel: string = "";
    msgLimitPer30Sec: number = 20;
    verbosity: string = "log,info,warn,error";
    createLogFile: boolean = false;
    urlWhiteList: string[] = [];

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
    }

    public getConfigDir(): string {
        return this.configDir;
    }

}