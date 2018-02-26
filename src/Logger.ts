import * as moment from "moment";
import * as fs from "fs";
import { Configuration } from "./Configuration";
import { isNullOrUndefined } from "util";

export class Logger {
    private isLog: boolean;
    private isInfo: boolean;
    private isWarn: boolean;
    private isError: boolean;
    private logToFile: boolean;
    private logPath: string;
    private newLine: string;
    private initDate: moment.Moment;
    private maxLogAgeInDays: number;
    private fileName = "";
    private readonly dateFormat = "YYYY-MM-DD";

    constructor(config: Configuration) {
        this.initDate = moment();
        this.maxLogAgeInDays = config.maxLogAgeDays;
        this.logPath = `${process.env.localappdata}\\.wishmaster`;
        let v = config.verbosity.toLowerCase();
        this.logToFile = config.createLogFile;

        this.updateFileName();
        this.cleanupOldFiles();

        this.newLine = process.platform == "win32" ? "\r\n" : "\n";

        this.isLog = v.indexOf("log") > -1;
        this.isInfo = v.indexOf("info") > -1;
        this.isWarn = v.indexOf("warn") > -1;
        this.isError = v.indexOf("error") > -1;
    }

    private updateFileName(now?: moment.Moment) {
        if (isNullOrUndefined(now)) {
            now = this.initDate;
        }
        if (now.day() != this.initDate.day() || this.fileName.length == 0) {
            this.initDate = now;
            let date = now.format(this.dateFormat);
            this.fileName = `${this.logPath}\\${date}.log`;
        }
    }

    private cleanupOldFiles() {
        let that = this;
        let threshold = moment().subtract(that.maxLogAgeInDays);

        fs.readdir(this.logPath, (err, listOfFiles) => {
            if (!isNullOrUndefined(err)) {
                that.error(err);
                return;
            }

            for (let file of listOfFiles) {
                that.cleanupOldLogFile(file, threshold, that);
            }
        });
    }

    private cleanupOldLogFile(file: string, threshold: moment.Moment, that: Logger) {
        let filePath = `${that.logPath}\\${file}`;
        if (file.endsWith(".log")) {
            let fileDateString = file.substr(0, that.dateFormat.length);
            let fileDate = moment(fileDateString);
            if (fileDate.isBefore(threshold)) {
                fs.unlink(filePath, (err) => {
                    if (!isNullOrUndefined(err)) {
                        that.error(err)
                    }
                });
            }
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