import Nedb = require("nedb");
import { isNullOrUndefined } from "util";

type CollectionMap = Map<string, Nedb>;

export interface IStaticAnswer {
    trigger: string;
    answer: string;
}

export interface IStomtConfig {
    applicationId: string;
    baseUrl: string;
}

export class Database {
    private map: CollectionMap;

    constructor(){
        this.map = new Map<string, Nedb>();
    }

    public get size() : number {
        return this.map.size;
    }

    public get users() : Nedb {
        let users = this.map.get("users");
        if (isNullOrUndefined(users)){
            // we throw because we implemented that this could never happen
            throw "Database is not initialized"; 
        }
        return users;
    }
    
    public get log() : Nedb {
        let log = this.map.get("log");
        if (isNullOrUndefined(log)){
            // we throw because we implemented that this could never happen
            throw "Database is not initialized"; 
        }
        return log;
    }

    public createCollection(name: string, options: object, cb:(err:any) => void) {
        let db = new Nedb(options);
        this.map.set(name, db);
        db.loadDatabase(cb);
    }
}

