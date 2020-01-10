///<reference path="./src/sub/irc-types/irc.d.ts" />

import * as MP from "./src/MessageProcessor";
import * as IRC from "irc";
import * as Log from "psst-log";
import { isNullOrUndefined } from "util";

import Nedb = require("nedb");
import { Configuration, Context, Database, ObsController } from "./src/shared";
import { Alerts } from "./src/Features/Alerts";
import { Bets } from "./src/Features/Bets";
import { Harvest } from "./src/Features/Harvest";
import { Loopback } from "./src/Features/Loopback";
import { StaticAnswers } from "./src/Features/StaticAnswers";
import { Stomt } from "./src/Features/Stomt";
import { SongRequest } from "./src/Features/SongRequest";
import { UrlFilter } from "./src/Features/UrlFilter";



class Startup {
    private static config: Configuration;
    private static logger: Log.ILogger;
    private static msgProcessor: MP.MessageProcessor;
    private static db: Database;
    private static obsController: ObsController;

    private static loadedCollections = 0;
    private static erroredCollections = 0;

    public static main(): number {     
        this.logger = Log.LogManager.getLogger();
        Log.LogManager.addConsoleTarget();

        this.config = new Configuration(this.logger);

        if (!this.config.createLogConsole) {
            Log.LogManager.removeConsoleTarget();
        }
        
        if (this.config.createLogFile) {
            Log.LogManager.addFileTarget(this.config.logDir, this.config.maxLogAgeDays);
        }

        this.logger.info("Wishmaster at your serivce.");
        this.logger.info("https://github.com/VashSan/wishmaster");
        if (process.platform != "win32") {
            this.logger.warn("This program likely contains bugs in other OS than Windows. Please report bugs.");
        }

        this.logger.info("setting up db");
        this.setupDb();
        this.setupObs();
        return 0;
    }
    static setupObs() {
        this.obsController = new ObsController(this.config.obs, this.logger);
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
            new Alerts(context),
            new Harvest(context),
            new StaticAnswers(context),
            new UrlFilter(context),
            // new Stomt(context),
            // new SongRequest(context),
            new Bets(context)
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


Startup.main();