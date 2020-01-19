import { ILogger } from "psst-log";
import { Configuration, Database, ObsController } from "./";

export class Context {
    public readonly config: Configuration;
    public readonly logger: ILogger;
    public readonly db: Database;
    public readonly obs: ObsController;

    constructor(config: Configuration, logger: ILogger, db: Database, obs: ObsController) {
        this.config = config;
        this.logger = logger;
        this.db = db;
        this.obs = obs;
    }

    public isDeveloper(): boolean {
        var env = process.env.NODE_ENV || 'dev';
        return env.toLowerCase() == 'dev';
    }
}