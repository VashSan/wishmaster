import * as mp from "../MessageProcessor";
import { Configuration } from "../Configuration";
import Nedb = require("nedb");

/** Pushes information into the database */
export class Harvest implements mp.IFeature {
    readonly trigger: string = "";
    private db;

    constructor(config: Configuration){
        let dbOptions = {
            filename: `${config.getConfigDir()}\\ne.db`,
            timestampData: true
        };

        this.db = new Nedb(dbOptions);
        this.db.loadDatabase(err => {
            if(err != null){
                console.error("Error when loading database:", err);
            }
        });
    }

    /** Return the message we just received */
    act(msg: mp.Message) : mp.IFeatureResponse {

        this.db.insert(msg, (err, newDoc) => {
            if(err != null){
                console.log("Error when inserting message:", err);
            }
        });

        return null;
    }
} 

export default Harvest;