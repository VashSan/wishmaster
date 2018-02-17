import * as mp from "../MessageProcessor";
import { Configuration } from "../Configuration";
import Nedb = require("nedb");

interface Database {
    users: Nedb;
    log: Nedb;
}

/** Pushes information into the database */
export class Harvest implements mp.IFeature {
    readonly trigger: string = "";
    private db: Database;

    constructor(config: Configuration) {
        let dbLogOptions = {
            filename: `${config.getConfigDir()}\\log.db`,
            timestampData: true
        };

        let dbUserOptions = {
            filename: `${config.getConfigDir()}\\user.db`,
            timestampData: true
        };

        this.db = {
            users: new Nedb(dbUserOptions),
            log: new Nedb(dbLogOptions)
        };
        this.db.users.loadDatabase(this.loadDatabaseCallback);
        this.db.log.loadDatabase(this.loadDatabaseCallback);
    }

    private loadDatabaseCallback(err): void {
        if (err != null) {
            console.error("Error when loading database:", err);
        }
    }

    /** Return the message we just received */
    act(msg: mp.Message): mp.IFeatureResponse {

        this.updateUser(msg);
        this.updateLog(msg);

        return null;
    }

    private updateLog(msg: mp.Message) {
        this.db.log.insert(msg, (err, newDoc) => {
            if (err != null) {
                console.error("Error when inserting message:", err);
            }
        });
    }

    private updateUser(msg: mp.Message) {
        if(msg.tags == null){
            // if tags dont work we wont collect user stats for now
            return;
        }
        let that = this;
        // We could update counts when evaluating logs at distinct times to avoid getting user first.
        // However this is easy and fast enough as it seems at first glance.
        this.db.users.findOne({_id: msg.tags.userId}, function(err, doc){
            if(err != null){
                console.error(err);
                return;
            }

            let totalBits = 0;
            let emoteOnlyCount = 0;
            let messageCount = 0;
            if(doc != null){
                totalBits = doc.totalBits + msg.tags.bits;
                emoteOnlyCount = doc.emoteOnlyCount + msg.tags.isEmoteOnly ? 1 : 0;
                messageCount = doc.messageCount + 1;
            }

            let user = that.getUserObj(msg, totalBits, emoteOnlyCount, messageCount);
            that.upsertUser(msg.tags.userId, user);
        });
       
    }

    private upsertUser(id: number, user:object){
        this.db.users.update({_id: id}, user, { upsert: true }, function (err, numReplaced, upsert) {
            // numReplaced = 1, upsert = { _id: 'id5', planet: 'Pluton', inhabited: false }
            // A new document { _id: 'id5', planet: 'Pluton', inhabited: false } has been added to the collection

            if(err != null){
                console.error(err);
            }
        });
    }

    private getUserObj(m: mp.Message, bits: number, emoteOnlyCount: number, messageCount: number): object{
        return {
            _id: m.tags.userId,
            name: m.tags.displayName,
            color: m.tags.color,
            badges: m.tags.badgeList,
            emoteOnlyCount: emoteOnlyCount,
            messageCount: messageCount,
            totalBits: bits,
            isMod: m.tags.isMod,
            isSubscriber: m.tags.isSubscriber,
            isTurbo: m.tags.isTurbo,
            lastRoomSeen: m.tags.roomId,
            lastTimeSeen: m.tags.serverReceivedMsgTime,
            type: m.tags.userType
        };
    }
}



export default Harvest;