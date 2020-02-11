import Nedb = require("nedb");
import { isNullOrUndefined } from "util";
import { IConfiguration } from "./Configuration";
import { ILogger, LogManager } from "psst-log";
import { Seconds } from "./Helper";
import { IMessage } from "./ChatClient";
import { TagReader } from ".";

type CollectionMap = Map<string, ICollection>;

export interface ICollection {
    isInitialized(): boolean;
    getError(): any;
    getName(): string;
}

export interface IUserAction {
    name: string;
    lastAction: ViewerAction;
    lastActionDate: Date;
}

export interface IUserCollection extends ICollection {
    newMessage(message: IMessage): void;
    findLastActions(maxActions: number): Promise<IUserAction[]>;
    newFollowFrom(viewer: string): void;
    newHostFrom(viewer: string): void;

}

export interface ILogCollection extends ICollection {

}

export interface IDatabase {
    getSize(): number;
    createCollection<T extends ICollection>(type: { new(...args: any[]): T; }, name: string): T
    get(name: string): ICollection;
    waitAllLoaded(timeout: Seconds): Promise<void>;
}

class Collection implements ICollection {
    protected readonly db: Nedb;
    protected readonly logger: ILogger;

    private readonly name: string;

    private initialized: boolean = false;
    private error: any = null;


    constructor(name: string, db: Nedb, logger?: ILogger) {
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }
        this.db = db;
        this.name = name;
        db.loadDatabase(this.loadDatabaseCallback.bind(this));
    }

    public isInitialized(): boolean {
        return this.initialized;
    }

    public getName(): string {
        return this.name;
    }


    public getError(): any {
        return this.error;
    }

    private loadDatabaseCallback(err: any): void {
        if (err != null) {
            this.error = err;
        } else {
            this.initialized = true;
        }
    }
}

export class Database implements IDatabase {
    private readonly map: CollectionMap = new Map<string, ICollection>();
    private config: IConfiguration;
    private logger: ILogger;

    constructor(config: IConfiguration, logger?: ILogger) {
        this.config = config;
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }
    }

    public getSize(): number {
        return this.map.size;
    }

    public get<T extends ICollection>(name: string): T {
        let collection = this.map.get(name);
        if (isNullOrUndefined(collection)) {
            // we throw because we implemented that this could never happen
            throw `Collection '${collection}' is not initialized`;
        }
        return <T>collection;
    }

    public createCollection<T extends ICollection>(type: { new(...args: any[]): T; }, name: string): T {
        const configDir = this.config.getConfigDir();
        const channel = this.config.getChannel();
        const file = `${configDir}\\${name}-${channel}.db`

        const options =
        {
            filename: file,
            timestampData: true
        };

        let db = new Nedb(options);
        let collection = new type(name, db);

        this.map.set(name, collection);
        return collection;
    }

    public waitAllLoaded(timeoutInSeconds: Seconds): Promise<void> {
        return new Promise((resolve, reject) => {
            let done = false;
            let start = Date.now();

            let interval = setInterval(() => {
                done = true;
                this.map.forEach(element => {
                    done = done && element.isInitialized();
                    if (element.getError() != null) {
                        reject(`Database '${element.getName()}' failed to load: ${element.getError()}`);
                    }
                });

                let timedOut = Date.now() > start + timeoutInSeconds.inMilliseconds();

                if (timedOut || done) {
                    clearInterval(interval);
                    if (done) {
                        resolve();
                    } else {
                        reject("Timeout reached");
                    }
                }
            }, new Seconds(0.1).inMilliseconds());

        });
    }
}

export enum ViewerAction {
    Host = "Host",
    Follow = "Follow"
}

export class UserCollection extends Collection implements IUserCollection {
    newMessage(message: IMessage): void {
        if (!message.tags) {
            return;
        }
        let that = this;
        let tr = new TagReader(message.tags, this.logger);
        this.db.findOne({ $or: [{ twitchid: tr.userId }, { name: tr.displayName }] }, function (err: Error, doc: any) {
            if (err != null) {
                that.logger.error(err);
                return;
            }

            if (message.tags == null) {
                that.logger.warn("If tags are not set we cannot update user");
                return;
            }

            let totalBits = 0;
            let emoteOnlyCount = 0;
            let messageCount = 0;
            if (doc != null) {
                totalBits = doc.totalBits + tr.bits;
                emoteOnlyCount = doc.emoteOnlyCount + tr.isEmoteOnly ? 1 : 0;
                messageCount = doc.messageCount + 1;
            }
            let followDate = new Date(0);
            if (doc.followDate != undefined) {
                followDate = doc.followDate;
            }

            // TODO New Tags? flags, badge-info
            let tagReader = new TagReader(message.tags);
            let user = {
                twitchid: tr.userId,
                name: tr.displayName,
                followDate: followDate,
                color: tr.color,
                badges: tr.badgeList,
                emoteOnlyCount: emoteOnlyCount,
                messageCount: messageCount,
                totalBits: totalBits,
                isMod: tr.isMod,
                isSubscriber: tr.isSubscriber,
                isTurbo: tr.isTurbo,
                lastRoomSeen: tr.roomId,
                lastTimeSeen: tr.serverReceivedMsgTime,
                type: tr.userType
            };

            that.upsertUser(tr.userId, user);
        });

    }

    private upsertUser(id: number, user: object) {
        let that = this;
        this.db.update({ twitchid: id }, user, { upsert: true }, function (err, numReplaced, upsert) {
            // numReplaced = 1, upsert = { _id: 'id5', planet: 'Pluton', inhabited: false }
            // A new document { _id: 'id5', planet: 'Pluton', inhabited: false } has been added to the collection

            if (err != null) {
                that.logger.error(err);
            }
        });
    }

    findLastActions(maxActions: number): Promise<IUserAction[]> {
        return new Promise((resolve, reject) => {
            this.db.find({}, { name: 1, lastAction: 1, lastActionDate: 1 })
                .sort({ lastActionDate: -1 })
                .limit(maxActions)
                .exec((err, docs) => {
                    if (err != null) {
                        reject(err);
                    } else {
                        let result = this.assembleResult(docs);
                        resolve(result);
                    }
                });
        });
    }
    private assembleResult(docs: { name: number, lastAction: number, lastActionDate: number }[]): IUserAction[] {
        let result: IUserAction[] = [];
        docs.forEach((element) => {
            let lastAction = ViewerAction["Follow"];
            if (element.lastAction) {
                let action = element.lastAction.toString() as keyof typeof ViewerAction;
                lastAction = ViewerAction[action];
            }

            let lastActionDate = new Date(2020, 0, 1);
            if (element.lastActionDate) {
                lastActionDate = new Date(element.lastActionDate);
            }

            const userAction: IUserAction = {
                name: element.name.toString(),
                lastAction: lastAction,
                lastActionDate: lastActionDate
            };
            result.push(userAction);
        });
        return result;
    }


    newFollowFrom(viewer: string): void {
        const now = new Date();
        const nedbUpdate = {
            $inc: { hostCount: 1 },
            $set: { lastHostDate: now, lastAction: ViewerAction.Host.toString(), lastActionDate: now },
        };

        this.updateOrInsert({ name: viewer }, nedbUpdate);
    }

    newHostFrom(viewer: string): void {
        const now = new Date();
        const nedbUpdate = { $set: { followDate: now, lastAction: ViewerAction.Follow.toString(), lastActionDate: now } };
        this.updateOrInsert({ name: viewer }, nedbUpdate);
    }

    private updateOrInsert(query: any, updateQuery: any) {
        this.db.update(query, updateQuery, { upsert: true });
    }
};


export class LogCollection extends Collection implements ILogCollection { };