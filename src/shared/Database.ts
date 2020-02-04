import Nedb = require("nedb");
import { isNullOrUndefined } from "util";

type CollectionMap = Map<string, ICollection>;

export interface ICollection {

}

export interface IUserCollection extends ICollection {

}

export interface ILogCollection extends ICollection {

}

export interface IDatabase {
    getSize(): number;
    createCollection(name: string, options: object, cb: (err: any) => void): void;
    get(name: string): ICollection;
}

class Collection implements ICollection {
    private db: Nedb;
    constructor(db: Nedb) {
        this.db = db;
    }


}

export class Database implements IDatabase {
    private map: CollectionMap;

    constructor() {
        this.map = new Map<string, ICollection>();
    }

    public getSize(): number {
        return this.map.size;
    }

    public get(name: string) {
        let collection = this.map.get(name);
        if (isNullOrUndefined(collection)) {
            // we throw because we implemented that this could never happen
            throw `Collection '${collection}' is not initialized`;
        }
        return collection;
    }

    public createCollection(name: string, options: object, cb: (err: any) => void): void {
        let db = new Nedb(options);
        db.loadDatabase(cb);

        let collection = new Collection(db);
        this.map.set(name, collection);
    }
}
