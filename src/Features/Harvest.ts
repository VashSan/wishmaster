import { ILogger, LogManager } from "psst-log";

import { IContext, IUserCollection, ILogCollection } from "../shared";
import { FeatureBase } from "./FeatureBase";
import { IFeature } from "../shared/MessageProcessor";
import { IMessage } from "../shared/ChatClient";

/** Pushes information into the database */
export class Harvest extends FeatureBase implements IFeature {
    private readonly logger: ILogger;
    private readonly userDb: IUserCollection;
    private readonly logDb: ILogCollection;

    constructor(context: IContext, logger?: ILogger) {
        super(context.getConfiguration());
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }

        const db = context.getDatabase();        
        this.userDb = <IUserCollection>db.get("user");
        this.logDb = <ILogCollection>db.get("log");
    }

    public getTrigger(): string {
        return "";
    }

    /** Evaluates the message to update user table, and add message log */
    public act(message: IMessage): void {
        this.updateUser(message);
        if (message.tags) {
            this.updateLog(message);
        }
    }

    private updateLog(msg: IMessage) {
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

    private updateUser(message: IMessage) {
        if (!message.tags) {
            // if tags dont work we wont collect user stats for now
            return;
        }
        

        this.userDb.newMessage(message);
    }
}

export default Harvest;