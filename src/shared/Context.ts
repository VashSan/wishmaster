import { ILogger } from "psst-log";
import { Configuration } from "./Configuration";
import { Database } from "../Interfaces";

export class Context {
    public readonly config: Configuration;
    public readonly logger: ILogger;
    public readonly db: Database;

    constructor(config: Configuration, logger: ILogger, db: Database) {
        this.config = config;
        this.logger = logger;
        this.db = db;
    }
}