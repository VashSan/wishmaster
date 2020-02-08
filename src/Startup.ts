
import { LogManager, ILogger } from "psst-log";

import { MessageProcessor, IFeature } from "./MessageProcessor";
import {
    Configuration, Context, Database, EmailAccess, UserCollection, ObsController, Seconds, LogCollection,
    IConfiguration, IContext, IDatabase, IObsController, IEmailAccess, DefeatableFeature
} from "./shared";
import { Alerts } from "./Features/Alerts";
import { Bets } from "./Features/Bets";
import { Harvest } from "./Features/Harvest";
import { StaticAnswers } from "./Features/StaticAnswers";
import { Stomt } from "./Features/Stomt";
import { SongRequest } from "./Features/SongRequest";
import { UrlFilter } from "./Features/UrlFilter";



export class Startup {
    private config: IConfiguration;
    private logger: ILogger;
    private msgProcessor: MessageProcessor;
    private db: IDatabase;
    private email: IEmailAccess;
    private obsController: IObsController;
    private context: IContext;
    private readonly features: Set<DefeatableFeature>;


    constructor(context?: IContext, config?: IConfiguration, logger?: ILogger, email?: IEmailAccess) {
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
            LogManager.addConsoleTarget();
        }

        if (config) {
            this.config = config;
        } else {
            this.config = new Configuration();
        }

        this.features = new Set<DefeatableFeature>(this.config.getEnabledFeatures());

        if (email) {
            this.email = email;
        } else {
            this.email = new EmailAccess(this.config);
        }

        if (context) {
            this.context = context;
            this.db = context.getDatabase();
            this.obsController = context.getObs();
            this.email = context.getEmail();
        } else {
            this.db = new Database(this.config);
            this.obsController = new ObsController(this.config.getObs());
            this.context = new Context(this.config, this.logger, this.db, this.obsController, this.email);
        }

        this.msgProcessor = new MessageProcessor(this.context);
    }

    public main(): number {
        this.configureLog();

        this.greetingsToMyHost();

        this.configureEmail();

        this.configureObs();

        this.configureDatabase()
            .then(() => this.finalInit())
            .catch((err) => {
                this.logger.error("Database load failed: " + err);
                process.exitCode = 1;
            });

        return 0;
    }

    private configureDatabase() {
        this.logger.log("setting up db");
        this.db.createCollection(UserCollection, "user");
        this.db.createCollection(LogCollection, "log");
        return this.db.waitAllLoaded(new Seconds(10));
    }

    private configureObs() {
        if (this.features.has(DefeatableFeature.ObsController)) {
            this.logger.log("Connecting to OBS");
            this.obsController.connect()
                .then(() => this.logger.info("Connected to OBS"))
                .catch((e) => this.logger.info("Proceeding without OBS: " + e));
        }
    }

    private configureEmail() {
        if (this.features.has(DefeatableFeature.EmailConnection)) {
            this.logger.log("Connecting to IMAP server");
            this.email.connect();
        }
    }

    private greetingsToMyHost() {
        this.logger.info("Wishmaster at your serivce.");
        this.logger.info("https://github.com/VashSan/wishmaster");
        this.logger.log("Detected platform: " + process.platform);
    }

    private configureLog() {
        if (!this.config.getCreateLogConsole()) {
            LogManager.removeConsoleTarget();
        }
        if (this.config.getCreateLogFile()) {
            LogManager.addFileTarget(this.config.getLogDir(), this.config.getMaxLogAgeDays());
        }
    }

    private finalInit() {
        this.logger.log("Connecting to Twitch Chat");
        this.setupChat();

        this.logger.log("Console will listen to your commands");
        this.setupConsole();
    }

    private setupChat() {

        let featureList = new Set<IFeature>([
            new Alerts(this.context),
            new Harvest(this.context),
            new StaticAnswers(this.context),
            new UrlFilter(this.context),
            // new Stomt(context),
            // new SongRequest(context),
            new Bets(this.context)
        ]);

        this.msgProcessor = new MessageProcessor(this.context);
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
        function stdout(text: string) {
            // we write to console directly, 
            // because we do not know whether console logging is enabled
            console.log(`\x1b[36m${text}\x1b[0m`);
        }

        // note:  d is an object, and when converted to a string it will
        // end with a linefeed.  so we (rather crudely) account for that  
        // with toString() and then trim() 
        let input = d.toString().trim();

        switch (input) {
            case "help":
                stdout("\tquit          Exits the program");
                break;
            case "quit":
                stdout("Good Bye!");
                process.exit(process.exitCode || 0); // TODO maybe we can shutdown more graceful?
                break;
            default:
                stdout("Unknown command: " + input);
                break;
        }
    }
}


export default Startup;