
import * as MP from "./MessageProcessor";
import * as Log from "psst-log";

import { Configuration, Context, Database, ObsController } from "./shared";
import { Alerts } from "./Features/Alerts";
import { Bets } from "./Features/Bets";
import { Harvest } from "./Features/Harvest";
import { StaticAnswers } from "./Features/StaticAnswers";
import { Stomt } from "./Features/Stomt";
import { SongRequest } from "./Features/SongRequest";
import { UrlFilter } from "./Features/UrlFilter";



export class Startup {
    private config: Configuration;
    private logger: Log.ILogger;
    private msgProcessor: MP.MessageProcessor;
    private db: Database;
    private obsController: ObsController;
    private context: Context;

    private loadedCollections = 0;
    private erroredCollections = 0;

    constructor(){
        this.logger = Log.LogManager.getLogger();
        Log.LogManager.addConsoleTarget();

        this.config = new Configuration();
        this.db = new Database();
        this.obsController = new ObsController(this.config.obs);

        this.context = new Context(this.config, this.logger, this.db, this.obsController);
        this.msgProcessor = new MP.MessageProcessor(this.context);
    }

    public main(): number {
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
        this.obsController.connect();
        return 0;
    }

    private setupDb() {
        
        let configDir = this.config.getConfigDir();
        let channel = this.config.channel;

        this.db.createCollection("log", {
            filename: `${configDir}\\log-${channel}.db`,
            timestampData: true
        }, this.loadDatabaseCallback.bind(this));

        this.db.createCollection("users", {
            filename: `${configDir}\\user-${channel}.db`,
            timestampData: true
        }, this.loadDatabaseCallback.bind(this));
    }

    private loadDatabaseCallback(err: any): void {
        if (err != null) {
            this.logger.error("Error when loading database:", err);
            this.erroredCollections += 1;
        } else {
            this.logger.info("DB loaded");
            this.loadedCollections += 1;
        }

        this.finalInit();
    }

    private finalInit() {
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

    private setupChat() {

        let featureList = new Set<MP.IFeature>([
            new Alerts(this.context, this.config.alerts[0]), // TODO add all alerts
            new Harvest(this.context),
            new StaticAnswers(this.context),
            new UrlFilter(this.context),
            // new Stomt(context),
            // new SongRequest(context),
            new Bets(this.context)
        ]);

        this.msgProcessor = new MP.MessageProcessor(this.context);
        this.msgProcessor.connect();
        for (const f of featureList) {
            this.msgProcessor.registerFeature(f);
        }
    }

    private setupConsole() {
        var stdin = process.openStdin();
        stdin.addListener("data", this.consoleCallback.bind(this));
    }

    private consoleCallback(d: object) {
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


export default Startup;