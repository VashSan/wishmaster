///<reference path="./src/sub/irc-types/irc.d.ts" />

import * as MP from "./src/MessageProcessor";
import * as IRC from "irc";
import * as moment from 'moment';
import Nedb = require("nedb");
import { Database } from "./src/Interfaces";
import { Loopback } from "./src/Features/Loopback";
import { Configuration } from "./src/Configuration";
import { Harvest } from "./src/Features/Harvest";
import { isNullOrUndefined } from "util";
import fs = require("fs");
import { UrlFilter } from "./src/Features/UrlFilter";

export class Context {
    public readonly config: Configuration;
    public readonly logger: Logger;
    public readonly db: Database;

    constructor(config: Configuration, logger: Logger, db: Database) {
        this.config = config;
        this.logger = logger;
        this.db = db;
    }
}

class Startup {
    private static config: Configuration;
    private static logger: Logger;
    private static msgProcessor: MP.MessageProcessor;
    private static db: Database;

    private static loadedCollections = 0;
    private static erroredCollections = 0;

    public static main(): number {
        this.config = new Configuration();
        this.logger = new Logger(this.config);

        this.logger.info("Wishmaster at your serivce.");
        this.logger.info("https://github.com/VashSan/wishmaster");
        if (process.platform != "win32") {
            this.logger.warn("This program likely contains bugs in other OS than Windows. Please report bugs.");
        }

        this.logger.info("setting up db");
        this.setupDb();

        return 0;
    }

    private static setupDb() {
        this.db = new Database();

        this.db.createCollection("log", {
            filename: `${this.config.getConfigDir()}\\log.db`,
            timestampData: true
        }, this.loadDatabaseCallback.bind(this));

        this.db.createCollection("users", {
            filename: `${this.config.getConfigDir()}\\user.db`,
            timestampData: true
        }, this.loadDatabaseCallback.bind(this));
    }

    private static loadDatabaseCallback(err: any): void {
        if (err != null) {
            this.logger.error("Error when loading database:", err);
            this.erroredCollections += 1;
        } else {
            this.logger.info("DB loaded");
            this.loadedCollections += 1;
        }

        this.finalInit();
    }

    private static finalInit() {
        if (this.db.size == this.loadedCollections) {
            this.logger.info("setting up chat");
            this.setupChat();

            this.logger.info("setting up console");
            this.setupConsole();
        }

        if (this.erroredCollections > 0 && this.db.size == this.erroredCollections + this.loadedCollections) {
            this.logger.error("Can not work without all databases loaded. Terminating.");
            process.exitCode = 1;
        }
    }

    private static setupChat() {

        let context = new Context(this.config, this.logger, this.db);

        let featureList = new Set<MP.IFeature>([
            // new Loopback(""),
            // new Loopback("test"),
            new Harvest(context),
            new UrlFilter(context)
        ]);

        this.msgProcessor = new MP.MessageProcessor(context);
        for (const f of featureList) {
            this.msgProcessor.registerFeature(f);
        }
    }

    private static setupConsole() {
        var stdin = process.openStdin();
        stdin.addListener("data", this.consoleCallback.bind(this));
    }

    private static consoleCallback(d: object) {
        // note:  d is an object, and when converted to a string it will
        // end with a linefeed.  so we (rather crudely) account for that  
        // with toString() and then trim() 
        let val = d.toString().trim();

        let that = this;

        this.db.users.find({ name: val }, function (err: any, doc: any) {
            if (err != null) {
                that.logger.error(err);
            } else {
                that.logger.log(doc[0], doc[1]);
            }
        });
    }
}

export class Logger {
    private isLog: boolean;
    private isInfo: boolean;
    private isWarn: boolean;
    private isError: boolean;
    private logToFile: boolean;
    private fileName: string;
    private newLine: string;

    constructor(config: Configuration) {
        let v = config.verbosity.toLowerCase();
        this.logToFile = config.createLogFile;
        this.fileName = `${process.env.localappdata}\\.wishmaster\\logfile.log`;
        this.newLine = process.env.platform == "win32" ? "\r\n" : "\n";

        this.isLog = v.indexOf("log") > -1;
        this.isInfo = v.indexOf("info") > -1;
        this.isWarn = v.indexOf("warn") > -1;
        this.isError = v.indexOf("error") > -1;
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
        let time = moment().format("YYYY-MM-DD hh:mm:ss.SSS Z");
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

Startup.main();