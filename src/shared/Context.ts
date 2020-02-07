import { ILogger } from "psst-log";
import { IConfiguration, IDatabase, IObsController } from "./";
import { MediaPlayer, IMediaPlayer } from "./MediaPlayer";
import { IEmailAccess } from "./Email";

export interface IService {
    getServiceName(): string;
}

export interface IContext {
    getConfiguration(): IConfiguration;
    getDatabase(): IDatabase;
    getMediaPlayer(): IMediaPlayer;
    getObs(): IObsController;
    getEmail(): IEmailAccess;
}

export class Context implements IContext {
    private readonly email: IEmailAccess;
    getEmail(): IEmailAccess {
        return this.email;
    }

    public readonly config: IConfiguration;
    getConfiguration(): IConfiguration {
        return this.config;
    }

    private readonly mediaPlayer: IMediaPlayer;
    getMediaPlayer(): IMediaPlayer {
        return this.mediaPlayer;
    }

    public readonly logger: ILogger;

    public readonly db: IDatabase;
    getDatabase(): IDatabase {
        return this.db;
    }

    public readonly obs: IObsController;
    getObs(): IObsController { 
        return this.obs;
    }

    constructor(config: IConfiguration, logger: ILogger, db: IDatabase, obs: IObsController, email: IEmailAccess) {
        this.config = config;
        this.mediaPlayer = new MediaPlayer(this.config);
        this.logger = logger;
        this.db = db;
        this.obs = obs;
        this.email = email;
    }

    public isDeveloper(): boolean {
        var env = process.env.NODE_ENV || 'dev';
        return env.toLowerCase() == 'dev';
    }
}