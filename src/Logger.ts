import * as moment from "moment";
import * as fs from "fs";
import { Configuration } from "./Configuration";
import { isNullOrUndefined } from "util";

enum LogLevel {
    Debug,
    Info,
    Warn,
    Error
}

interface ILogTarget {
    log(level: LogLevel, text: string, ...args: any[]): void;
}

class ConsoleTarget implements ILogTarget {
    log(level: LogLevel, text: string, ...args: any[]) {
        switch (level) {
            case LogLevel.Debug:
                console.log(text, args);
                break;
            case LogLevel.Info:
                console.info(text, args);
                break;
            case LogLevel.Warn:
                console.warn(text, args);
                break;
            default:
            // all undefined levels are handled as error
            case LogLevel.Error:
                console.error(text, args);
        }
    }
}

class FileTarget implements ILogTarget {
    private logPath: string;
    private newLine: string;
    private initDate: moment.Moment;

    private maxLogAgeInDays = 10;
    private fileName = "";
    private readonly dateFormat = "YYYY-MM-DD";

    constructor(logPath: string, maxLogAgeDays: number) {
        this.newLine = process.platform == "win32" ? "\r\n" : "\n";
        this.initDate = moment();
        this.logPath = logPath;
        this.maxLogAgeInDays = maxLogAgeDays;

        this.updateFileName();
        this.cleanupOldFiles();
    }

    log(level: LogLevel, text: string, ...args: any[]) {
        let now = moment();

        this.updateFileName(now);

        let time = now.format("YYYY-MM-DD hh:mm:ss.SSS Z");
        let data: string;
        let kind = level.toString();
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
                console.error(err); // dont use Logger ... we could get in to endless recursion
                return;
            }

            for (const file of listOfFiles) {
                that.cleanupOldLogFile(file, threshold, that);
            }
        });
    }

    private cleanupOldLogFile(file: string, threshold: moment.Moment, that: FileTarget) {
        let filePath = `${that.logPath}\\${file}`;
        if (file.endsWith(".log")) {
            let fileDateString = file.substr(0, that.dateFormat.length);
            let fileDate = moment(fileDateString);
            if (fileDate.isBefore(threshold)) {
                fs.unlink(filePath, (err) => {
                    if (!isNullOrUndefined(err)) {
                        console.error(err); // dont use Logger ... we could get in to endless recursion
                    }
                });
            }
        }
    }
}

export class Logger {
    private isDebug: boolean;
    private isInfo: boolean;
    private isWarn: boolean;
    private isError: boolean;
    private logTargets: ILogTarget[] = [];

    constructor(config: Configuration) {
        let v = config.verbosity.toLowerCase();
        this.isDebug = v.indexOf("debug") > -1;
        this.isInfo = v.indexOf("info") > -1;
        this.isWarn = v.indexOf("warn") > -1;
        this.isError = v.indexOf("error") > -1;

        if (config.createLogConsole) {
            this.logTargets.push(new ConsoleTarget());
        }
        
        if (config.createLogFile) {
            let logPath = `${process.env.localappdata}\\.wishmaster`;
            this.logTargets.push(new FileTarget(logPath, config.maxLogAgeDays));
        }
    }

    private writeTarget(level: LogLevel, text: string, ...args: any[]) {
        for (const target of this.logTargets) {
            target.log(level, text, args);
        }
    }

    public log(text: any, ...args: any[]) {
        if (this.isDebug) {
            this.writeTarget(LogLevel.Debug, text, args);
        }
    }

    public info(text: any, ...args: any[]) {
        if (this.isInfo) {
            this.writeTarget(LogLevel.Info, text, args);
        }
    }

    public warn(text: any, ...args: any[]) {
        if (this.isWarn) {
            this.writeTarget(LogLevel.Warn, text, args);
        }
    }

    public error(text: any, ...args: any[]) {
        if (this.isError) {
            this.writeTarget(LogLevel.Error, text, args);
        }
    }
}