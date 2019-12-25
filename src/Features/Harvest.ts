import * as mp from "../MessageProcessor";
import { Configuration } from "../Configuration";
import { Database } from "../Interfaces";
import { Context } from "../../app";
import { Logger } from "../Logger";
import { isNullOrUndefined } from "util";

/** Pushes information into the database */
export class Harvest implements mp.IFeature {
    readonly trigger: string = "";
    private db: Database;
    private logger: Logger;

    constructor(context: Context) {
        this.db = context.db;
        this.logger = context.logger;
    }

    /** Evaluates the message to update user table, and add message log */
    public act(msg: mp.Message, callback: (error: string, response: mp.IFeatureResponse) => void): void {
        this.updateUser(msg);
        this.updateLog(msg);
    }

    private updateLog(msg: mp.Message) {
        if (msg.tags == null) {
            this.logger.warn("If tags are not set we cannot update log");
            return;
        }

        let emotes: object[] = [];

        msg.tags.emoteList.forEach(e => {
            emotes.push({
                id: e.id,
                start: e.start,
                end: e.end
            });
        });

        // TODO New Tags? flags, badge-info
        let log = {
            from: msg.from,
            channel: msg.channel,
            text: msg.text,
            bits: msg.tags.bits,
            color: msg.tags.color,
            emoteList: emotes,
            isEmoteOnly: msg.tags.isEmoteOnly,
            isMod: msg.tags.isMod,
            isSub: msg.tags.isSubscriber,
            isTurbo: msg.tags.isTurbo,
            msgId: msg.tags.messageId,
            userId: msg.tags.userId,
            msgReceivedTime: msg.tags.serverReceivedMsgTime,
            m: msg.tags.roomId
        };

        let that = this;
        this.db.log.insert(log, (err, newDoc) => {
            if (err != null) {
                that.logger.error("Error when inserting message:", err);
            }
        });
    }

    private updateUser(msg: mp.Message) {
        if (msg.tags == null) {
            // if tags dont work we wont collect user stats for now
            return;
        }
        let that = this;
        // We could update counts when evaluating logs at distinct times to avoid getting user first.
        // However this is easy and fast enough as it seems at first glance.
        this.db.users.findOne({ _id: msg.tags.userId }, function (err: Error, doc: any) {
            if (err != null) {
                that.logger.error(err);
                return;
            }

            if (msg.tags == null) {
                that.logger.warn("If tags are not set we cannot update user");
                return;
            }

            let totalBits = 0;
            let emoteOnlyCount = 0;
            let messageCount = 0;
            if (doc != null) {
                totalBits = doc.totalBits + msg.tags.bits;
                emoteOnlyCount = doc.emoteOnlyCount + msg.tags.isEmoteOnly ? 1 : 0;
                messageCount = doc.messageCount + 1;
            }
            
            // TODO New Tags? flags, badge-info
            let user = {
                _id: msg.tags.userId,
                name: msg.tags.displayName,
                color: msg.tags.color,
                badges: msg.tags.badgeList,
                emoteOnlyCount: emoteOnlyCount,
                messageCount: messageCount,
                totalBits: totalBits,
                isMod: msg.tags.isMod,
                isSubscriber: msg.tags.isSubscriber,
                isTurbo: msg.tags.isTurbo,
                lastRoomSeen: msg.tags.roomId,
                lastTimeSeen: msg.tags.serverReceivedMsgTime,
                type: msg.tags.userType
            };

            that.upsertUser(msg.tags.userId, user);
        });

    }

    private upsertUser(id: number, user: object) {
        let that = this;
        this.db.users.update({ _id: id }, user, { upsert: true }, function (err, numReplaced, upsert) {
            // numReplaced = 1, upsert = { _id: 'id5', planet: 'Pluton', inhabited: false }
            // A new document { _id: 'id5', planet: 'Pluton', inhabited: false } has been added to the collection

            if (err != null) {
                that.logger.error(err);
            }
        });
    }
}



export default Harvest;