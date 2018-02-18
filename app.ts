///<reference path="./src/sub/irc-types/irc.d.ts" />

import * as MP from "./src/MessageProcessor";
import * as IRC from "irc";
import Nedb = require("nedb");
import { Database } from "./src/Interfaces";
import { Loopback } from "./src/Features/Loopback";
import { Configuration } from "./src/Configuration";
import { Harvest } from "./src/Features/Harvest";
import { isNullOrUndefined } from "util";

class Startup {
    private static config: Configuration;
    private static logger: Logger;
    private static msgProcessor: MP.MessageProcessor;
    private static db: Database;

    public static main(): number {

        this.config = new Configuration();
        this.logger = new Logger(this.config);

        this.logger.info("setting up db");
        this.setupDb();

        this.logger.info("setting up chat");
        this.setupChat();

        this.logger.info("setting up console");
        this.setupConsole();

        return 0;
    }

    private static setupDb() {
        let dbLogOptions = {
            filename: `${this.config.getConfigDir()}\\log.db`,
            timestampData: true
        };

        let dbUserOptions = {
            filename: `${this.config.getConfigDir()}\\user.db`,
            timestampData: true
        };

        this.db = {
            users: new Nedb(dbUserOptions),
            log: new Nedb(dbLogOptions)
        };
        this.db.users.loadDatabase(this.loadDatabaseCallback.bind(this));
        this.db.log.loadDatabase(this.loadDatabaseCallback.bind(this));
    }

    private static loadDatabaseCallback(err: any): void {
        if (err != null) {
            this.logger.error("Error when loading database:", err);
        } else {
            this.logger.info("DB loaded");
        }
    }

    private static setupChat() {
        let client = new IRC.Client(
            this.config.server,
            this.config.nickname,
            {
                autoConnect: false,
                password: this.config.password
            }
        );

        let featureList = new Set<MP.IFeature>([
            // new Loopback(""),
            // new Loopback("test"),
            new Harvest(this.db)
        ]);

        this.msgProcessor = new MP.MessageProcessor(client);
        for (const f of featureList) {
            this.msgProcessor.registerFeature(f);
        }

        client.addListener("raw", message => {
            let cmd: string = message.command;

            if (cmd.startsWith("@")) { // thats a twitch chat tagged message something our lib does not recongnize 
                let payload: string = message.args[0];

                let x: string[] = payload.split(" ", 2); // need to check command
                if (x[1].toUpperCase() == "PRIVMSG") {
                    this.taggedMessageReceived(payload, cmd);
                    return;
                }
            }

            if (cmd.toUpperCase() != "PRIVMSG") {
                this.logger.log("raw: ", message);
            }

        });

        client.addListener("error", message => {
            this.logger.error("IRC client error: ", message);
        });

        client.addListener("message", (from, to, message) => {
            this.messageReceived(from, to, message);
        });

        client.connect(0, () => {
            client.send("CAP REQ", "twitch.tv/tags");
            client.join(this.config.channel);
        });
    }

    private static taggedMessageReceived(payload: string, tags: string) {
        let separatorPos = payload.indexOf(":"); // left is meta data, right is message text
        let metaData = payload.substring(0, separatorPos);

        let metaDataList = metaData.split(" ");

        let fromRaw = metaDataList.shift();
        if (isNullOrUndefined(fromRaw)) {
            this.logger.error("Could not parse message tags.");
        } else {
            let from = fromRaw.substring(0, fromRaw.indexOf("!"));

            let command = metaDataList.shift();
            if (isNullOrUndefined(command) || command.toUpperCase() != "PRIVMSG") {
                throw "Wrong handler was called";
            }

            let to = metaDataList.shift();
            if(isNullOrUndefined(to)){
                this.logger.error("Could not parse 'to' from meta data");
            } else {
                let text = payload.substring(separatorPos + 1);
                this.messageReceived(from, to, text, tags);
            }
        }
    }

    private static messageReceived(from: string, to: string, message: string, tagsString?: string) {
        let m;
        if (!isNullOrUndefined(tagsString)) {
            let t = new MP.Tags(tagsString);
            m = new MP.Message({ from: from, channel: to, text: message }, t);
        }
        else {
            m = new MP.Message({ from: from, channel: to, text: message });
        }

        this.logger.log(`${to} ${from}: ${message}`);

        this.msgProcessor.process(m);
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

        this.db.users.find({ name: val }, function (err: any, doc: any) {
            if (err != null) {
                console.error(err);
            } else {
                console.log(doc[0], doc[1]);
            }
        });
    }
}

export class Logger {
    private isLog: boolean;
    private isInfo: boolean;
    private isWarn: boolean;
    private isError: boolean;

    constructor(config: Configuration) {
        let v = config.verbosity.toLowerCase();
        this.isLog = v.indexOf("log") > -1;
        this.isInfo = v.indexOf("info") > -1;
        this.isWarn = v.indexOf("warn") > -1;
        this.isError = v.indexOf("error") > -1;
    }

    public log(text: any, ...args: any[]) {
        if (this.isLog) {
            console.log(text, ...args);
        }
    }

    public info(text: any, ...args: any[]) {
        if (this.isInfo) {
            console.log(text, ...args);
        }
    }

    public warn(text: any, ...args: any[]) {
        if (this.isWarn) {
            console.warn(text, ...args);
        }
    }

    public error(text: any, ...args: any[]) {
        if (this.isError) {
            console.error(text, ...args);
        }
    }
}

Startup.main();