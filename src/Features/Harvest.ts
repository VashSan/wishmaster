import { ILogger } from "psst-log";
import { isNullOrUndefined } from "util";

import * as mp from "../MessageProcessor";
import { Context, Configuration, Database } from "../shared";
import { TagReader } from "../shared/TagReader";

/** Pushes information into the database */
export class Harvest implements mp.IFeature {
    readonly trigger: string = "";
    private db: Database;
    private logger: ILogger;
    private sendResponse: mp.ResponseCallback | null = null;

    constructor(context: Context) {
        this.db = context.db;
        this.logger = context.logger;
    }

    public setup(sendResponse: mp.ResponseCallback): void {
        this.sendResponse = sendResponse;
    }

    /** Evaluates the message to update user table, and add message log */
    public act(msg: mp.Message): void {
        this.updateUser(msg);
        this.updateLog(msg);
    }

    private updateLog(msg: mp.Message) {
        if (msg.tags == null) {
            this.logger.warn("If tags are not set we cannot update log");
            return;
        }

        //let emotes: object[] = [];

        // msg.tags.emoteList.forEach(e => {
        //     emotes.push({
        //         id: e.id,
        //         start: e.start,
        //         end: e.end
        //     });
        // });

        // TODO New Tags? flags, badge-info
        // let log = {
        //     from: msg.from,
        //     channel: msg.channel,
        //     text: msg.text,
        //     bits: msg.tags.bits,
        //     color: msg.tags.color,
        //     emoteList: emotes,
        //     isEmoteOnly: msg.tags.isEmoteOnly,
        //     isMod: msg.tags.isMod,
        //     isSub: msg.tags.isSubscriber,
        //     isTurbo: msg.tags.isTurbo,
        //     msgId: msg.tags.messageId,
        //     userId: msg.tags.userId,
        //     msgReceivedTime: msg.tags.serverReceivedMsgTime,
        //     m: msg.tags.roomId
        // };

        // let that = this;
        // this.db.log.insert(log, (err, newDoc) => {
        //     if (err != null) {
        //         that.logger.error("Error when inserting message:", err);
        //     }
        // });
    }

    private updateUser(msg: mp.Message) {
        if (msg.tags == null) {
            // if tags dont work we wont collect user stats for now
            return;
        }
        let that = this;
        // We could update counts when evaluating logs at distinct times to avoid getting user first.
        // However this is easy and fast enough as it seems at first glance.
        let tr = new TagReader(msg.tags, this.logger);
        this.db.users.findOne({ $or:[ { twitchid:tr.userId }, { name: tr.displayName } ] }, function (err: Error, doc: any) {
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
                totalBits = doc.totalBits + tr.bits;
                emoteOnlyCount = doc.emoteOnlyCount + tr.isEmoteOnly ? 1 : 0;
                messageCount = doc.messageCount + 1;
            }
            let followDate = new Date(0);
            if (doc.followDate != undefined){
                followDate = doc.followDate;
            }
            
            // TODO New Tags? flags, badge-info
            let tagReader = new TagReader(msg.tags);
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
        this.db.users.update({ twitchid: id }, user, { upsert: true }, function (err, numReplaced, upsert) {
            // numReplaced = 1, upsert = { _id: 'id5', planet: 'Pluton', inhabited: false }
            // A new document { _id: 'id5', planet: 'Pluton', inhabited: false } has been added to the collection

            if (err != null) {
                that.logger.error(err);
            }
        });
    }
}



export default Harvest;