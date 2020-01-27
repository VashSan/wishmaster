import { ILogger } from "psst-log";
import { Configuration, Database, ObsController } from "./";

export interface IService {
    getServiceName(): string;
}

export class Context {
    private readonly services: Map<string, IService> = new Map<string, IService>();

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

    public add<T extends IService>(instance: T): void {
        const name = instance.getServiceName();
        if (name == ""){
            throw new Error(`The service must return name which is not empty`);
        }
        
        if(this.services.has(name)){
            throw new Error(`A service with name '${name}' was already added`);
        }
        
        this.services.set(name, instance);
    }

    public get<T extends IService>(name: string): T {
        let service  = this.services.get(name);
        if (service == undefined) {
            throw new Error(`Unknown service with name '${name}'`);
        }

        return service as T;
    }

}