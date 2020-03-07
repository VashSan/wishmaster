import { LogManager, ILogger } from "psst-log";
import { MessageProcessor, IFeature, IMessageProcessor } from "./shared/MessageProcessor";
import {
    Context, Database, DefeatableFeature, FileSystem, EmailAccess, UserCollection, ObsController, Seconds, LogCollection,
    IConfiguration, IContext, IDatabase, IObsController, IEmailAccess, IFileSystem
} from "./shared";
import CommandLine from "./shared/CommandLine";
import { IMainFactory, MainFactory } from "./MainFactory";



export class Startup {
    private readonly factory: IMainFactory;
    private readonly features: Set<DefeatableFeature>;
    private readonly fs: IFileSystem;

    private config: IConfiguration;
    private logger: ILogger;
    private msgProcessor: IMessageProcessor;
    private db: IDatabase;
    private email: IEmailAccess;
    private obsController: IObsController;
    private context: IContext;

    constructor(factory?: IMainFactory, context?: IContext, logger?: ILogger, msgProcessor?: IMessageProcessor) {
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
            LogManager.addConsoleTarget();
        }

        this.factory = factory ? factory : new MainFactory();
        this.config = this.factory.createConfiguration();

        this.features = new Set<DefeatableFeature>(this.config.getEnabledFeatures());

        if (context) {
            this.context = context;
            this.db = context.getDatabase();
            this.obsController = context.getObs();
            this.email = context.getEmail();
            this.fs = context.getFileSystem();
        } else {
            this.db = new Database(this.config);
            this.obsController = new ObsController(this.config.getObs());
            this.email = new EmailAccess(this.config);
            this.fs = new FileSystem();
            this.context = new Context(this.config, this.logger, this.db, this.obsController, this.email, this.fs);
        }

        this.factory.setContext(this.context);

        if (msgProcessor) {
            this.msgProcessor = msgProcessor;
        } else {
            this.msgProcessor = new MessageProcessor(this.context);
        }
    }

    public main(args: string[]): number {
        this.configureLog();
        this.parseCommandline(args);
        this.greetingsToMyHost();
        this.configureThenStart();
        return 0;
    }

    private parseCommandline(args: string[]) {
        try {
            const myArgs = new CommandLine().option("-spotify").parse(args);
            this.context.setArguments(myArgs);
        }
        catch {
            this.logger.warn("Ignoring invalid command line syntax");
        }
    }

    private configureThenStart() {
        this.configureEmail();

        this.configureObs();

        this.configureDatabase()
            .then(() => this.finalInit())
            .catch((err) => {
                this.logger.error("Database load failed: " + err);
                process.exitCode = 1;
            });
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

        this.setupConsole();
    }

    private setupChat() {
        let featureList = this.getEnabledFeatures();

        this.msgProcessor.connect();
        for (const f of featureList) {
            this.msgProcessor.registerFeature(f);
        }
    }

    private getEnabledFeatures() {
        const set = new Set<IFeature>();
        const log = this.logger.log.bind(this.logger);

        const harvest = this.factory.createHarvest();
        set.add(harvest);

        const map = new Map<DefeatableFeature, () => IFeature>();
        map.set(DefeatableFeature.Alerts, () => this.factory.createAlerts());
        map.set(DefeatableFeature.StaticAnswers, () => this.factory.createStaticAnswers());
        map.set(DefeatableFeature.UrlFilter, () => this.factory.createUrlFilter());
        map.set(DefeatableFeature.Bets, () => this.factory.createBets());
        //map.set(DefeatableFeature.Stomt, ()=>this.factory.createStomt());
        map.set(DefeatableFeature.SongRequest, () => this.factory.createSongRequest());

        this.features.forEach(feature => {
            const factory = map.get(feature);
            if (factory) {
                const featureName = feature.toString();
                log(`Feature '${featureName}' enabled`);

                const instance = factory();
                set.add(instance);
            }
        });

        return set;
    }

    private setupConsole() {
        if (this.features.has(DefeatableFeature.Console)) {
            this.logger.log("Console will listen to your commands");
            var stdin = process.openStdin();
            stdin.addListener("data", this.consoleCallback.bind(this));
        }
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