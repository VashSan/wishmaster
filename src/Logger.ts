import * as moment from "moment";
import * as fs from "fs";
import { Configuration } from "./Configuration";

export class Logger {
    private isLog: boolean;
    private isInfo: boolean;
    private isWarn: boolean;
    private isError: boolean;
    private logToFile: boolean;
    private fileName: string = "";
    private newLine: string;
    private initDate: moment.Moment;

    constructor(config: Configuration) {
        this.initDate = moment();

        let v = config.verbosity.toLowerCase();
        this.logToFile = config.createLogFile;

        this.updateFileName(this.initDate);

        this.newLine = process.platform == "win32" ? "\r\n" : "\n";

        this.isLog = v.indexOf("log") > -1;
        this.isInfo = v.indexOf("info") > -1;
        this.isWarn = v.indexOf("warn") > -1;
        this.isError = v.indexOf("error") > -1;
    }

    private updateFileName(now: moment.Moment) {
        if (now.day() != this.initDate.day() || this.fileName.length == 0) {
            this.initDate = now;
            let date = now.format("YYYY-MM-DD");
            this.fileName = `${process.env.localappdata}\\.wishmaster\\${date}.log`;
        }
    }

    public log(text: any, ...args: any[]) {
        if (this.isLog) {
            if (this.logToFile) {
                this.writeLog("log", text, ...args);
            } else {
                console.log(text, ...args);
            }
        }
    }

    public info(text: any, ...args: any[]) {
        if (this.isInfo) {
            if (this.logToFile) {
                this.writeLog("info", text, ...args);
            } else {
                console.info(text, ...args);
            }
        }
    }

    public warn(text: any, ...args: any[]) {
        if (this.isWarn) {
            if (this.logToFile) {
                this.writeLog("warn", text, ...args);
            } else {
                console.warn(text, ...args);
            }
        }
    }

    public error(text: any, ...args: any[]) {
        if (this.isError) {
            if (this.logToFile) {
                this.writeLog("error", text, ...args);
            } else {
                console.error(text, ...args);
            }
        }
    }

    private writeLog(kind: string, text: string, ...args: any[]) {
        let now = moment();
        this.updateFileName(now);

        let time = now.format("YYYY-MM-DD hh:mm:ss.SSS Z");
        let data: string;
        if (args.length > 0) {
            let argsJoined = args.join("");
            data = `${time}\t${kind}\t${text}\t${argsJoined}${this.newLine}`;
        } else {
            data = `${time}\t${kind}\t${text}${this.newLine}`;
        }

        fs.open(this.fileName, 'a', (err, fd) => {
            if (err) {
                console.error("failed to open log file");
                return;
            }
            fs.appendFile(fd, data, (err) => {
                if (err) {
                    console.error("failed to write to log file");
                }
            });
        });
    }
}