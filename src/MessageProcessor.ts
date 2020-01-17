import * as IRC from "irc";
import { isNullOrUndefined } from "util";
import { ILogger } from "psst-log";
import { Configuration, Context } from "./shared";

export type ResponseCallback = (error: string | null, response: IFeatureResponse) => void;

export enum UserType {
    Normal,
    Moderator,
    GlobalMod,
    Admin,
    Staff
}

export interface IFeature {
    readonly trigger: string;
    setup(callback: ResponseCallback): void;
    act(message: Message): void;
}

export interface IFeatureResponse {
    message: Message;
}

export class Emote {
    id: number = 0;
    start: number = 0;
    end: number = 0;
}


export class Tags {
    private logger: ILogger;
    public color: string = "";
    public displayName: string = "";
    public isEmoteOnly: boolean = false;
    public emoteList: Set<Emote> = new Set<Emote>();
    public messageId: string = "";
    public isMod: boolean = false;
    public roomId: number = 0;
    public isSubscriber: boolean = false;
    public serverReceivedMsgTime: number = 0;
    public isTurbo: boolean = false;
    public userId: number = 0;
    public userType: UserType = UserType.Normal;
    public bits: number = 0;
    public badgeList: string[] = [];

    constructor(tags: string, logger: ILogger) {
        this.logger = logger;
        if (!tags.startsWith("@")) {
            logger.error("does not seem to be valid tag", tags);
            return;
        }
        this.parseTags(tags.substring(1));
    }

    private parseTags(tags: string) {
        let tagList: string[] = tags.split(";");

        for (const tag of tagList) {
            let tagTuple = tag.split("=");
            let tagName = tagTuple[0];
            let tagValue = tagTuple[1];

            this.assignTag(tagName, tagValue);
        }
    }

    private assignTag(name: string, value: string): void {
        switch (name.toLowerCase()) {
            case "color":
                this.color = value;
                break;
            case "bits":
                this.bits = this.parseInt(value);
            case "badges":
                this.badgeList = this.parseBadges(value);
                break;
            case "display-name":
                this.displayName = value;
                break;
            case "emote-only":
                this.isEmoteOnly = this.parseBool(value);
                break;
            case "emotes":
                this.parseEmotes(value);
                break;
            case "id":
                this.messageId = value;
                break;
            case "mod":
                this.isMod = this.parseBool(value);
                break;
            case "room-id":
                this.roomId = this.parseInt(value);
                break;
            case "subscriber":
                this.isSubscriber = this.parseBool(value);
                break;
            case "sent-ts":
                this.logger.log("Unknow tag sent-ts received");
                break;
            case "tmi-sent-ts":
                this.serverReceivedMsgTime = Number.parseInt(value);
                break;
            case "turbo":
                this.isTurbo = this.parseBool(value);
                break;
            case "user-id":
                this.userId = this.parseInt(value);
                break;
            case "user-type":
                this.userType = this.parseUserType(value);
                break;
            default:
                this.logger.error(`Unknown tag: '${name}' = '${value}'`);
        }
    }

    private parseUserType(t: string): UserType {
        switch (t.toLowerCase()) {
            case "":
                return UserType.Normal;
            case "mod":
                return UserType.Moderator;
            case "global_mod":
                return UserType.GlobalMod;
            case "admin":
                return UserType.Admin;
            case "staff":
                return UserType.Staff;
        }

        this.logger.error("Unknown UserType:", t);
        return UserType.Normal;
    }

    private parseBool(b: string): boolean {
        try {
            return b != "0";
        } catch (ex) {
            this.logger.error(ex);
            return false;
        }
    }

    private parseInt(i: string): number {
        try {
            return Number.parseFloat(i);
        } catch (ex) {
            this.logger.error(ex);
            return 0;
        }
    }

    private parseBadges(badgesString: string): string[] {
        let bList = badgesString.split(",");
        let result: string[] = [];

        for (const badge of bList) {
            let b = badge.split("/");

            if (b[0].length > 0) {
                result.push(b[0]);
            }
        }

        return result;
    }

    private parseEmotes(value: string) {
        if (value == "") {
            return;
        }
        // emoteDefintion[/emoteDefintion]...
        let emotes = value.split("/");

        for (const emoteString of emotes) {
            // emoteDefintion = emoteId:emotePositionList
            let separatorPos = emoteString.indexOf(":");
            let emoteName = emoteString.substring(0, separatorPos);
            let emoteId = this.parseInt(emoteName);
            let emotePositionString = emoteString.substring(separatorPos + 1);

            // emotePositionList = position[,position]
            let emotePositionList = emotePositionString.split(",");
            for (const position of emotePositionList) {
                // position = start-end
                let positionTuple = position.split("-");
                let start: number = this.parseInt(positionTuple[0]);
                let end: number = this.parseInt(positionTuple[1]);

                let emote = new Emote();
                emote.id = emoteId;
                emote.start = start;
                emote.end = end;

                this.emoteList.add(emote);
            }
        }
    }
}

export class Message {
    text: string = "";
    from: string = "";
    /** Channel starts with # otherwise it is a whisper or system notice I guess */
    channel: string = "";
    tags: Tags | null;

    constructor(init: Partial<Message>, tags?: Tags) {
        (<any>Object).assign(this, init);
        if (isNullOrUndefined(tags)) {
            this.tags = null;
        } else {
            this.tags = tags;
        }
    }

    toString(): string {
        let result: string = `Message from '${this.from}' to '${this.channel}': ${this.text}`;
        return result;
    }
}

export class MessageProcessor {
    private featureMap = new Map<string, Set<IFeature>>();
    private client: IRC.Client;
    private context: Context;
    private config: Configuration;
    private logger: ILogger;
    private delayedMessages: IFeatureResponse[] = [];
    private messageCount30Sec = 0;
    private messageOfTheDay: string = "";

    constructor(context: Context) {
        this.context = context;
        this.config = context.config;
        this.logger = context.logger;

        this.client = new IRC.Client(
            this.config.server,
            this.config.nickname,
            {
                autoConnect: false,
                password: this.config.password
            }
        );

        this.client.addListener("raw", message => {
            let cmd: string = message.command;

            // thats a twitch chat tagged message something our lib does not recongnize 
            if (cmd.startsWith("@")) {
                let payload: string = message.args[0];

                let x: string[] = payload.split(" ", 2); // need to check command
                if (x[1].toUpperCase() == "PRIVMSG") {
                    this.taggedMessageReceived(payload, cmd);
                    return;
                }
            }

            // this is a regular message or command
            if (cmd.toUpperCase() == "PRIVMSG") {
                if (message.args.length == 2) {
                    this.messageReceived(message.user, message.args[0], message.args[1]);
                    return;
                }
            }

            this.messageTrap(message);
        });

        this.client.addListener("error", message => {
            // client sends whois, we will ignore all these
            if (message.args.length > 0 && message.args[1].toLowerCase() != "whois") {
                this.logger.error("IRC client error: ", message);
            }
        });

        this.client.addListener("message", (from, to, message) => {
            this.messageReceived(from, to, message);
        });

        this.client.connect(0, () => {
            setInterval(this.resetMessageCount.bind(this), 1000 * 30);
            setInterval(this.processDelayedMessages.bind(this), 1000 * 10);

            this.messageCount30Sec = 1;
            this.client.send("CAP REQ", "twitch.tv/tags twitch.tv/commands");
            this.client.join(this.config.channel);
        });
    }

    private messageTrap(message: any) {
        switch (message.rawCommand.toLowerCase()) {
            case "001": //"rpl_welcome"
            case "002": //"rpl_yourhost"
            case "003": //"rpl_created"
            case "004": //"rpl_myinfo"
            case "353": //"rpl_namreply" ... wehn joining a channel this is sent automatically
            case "366": //"rpl_endofnames"
            case "cap": // capabilities ... if we want to track different feature we shoudl save this
            case "ping":
            case "pong": // sent by twitch every ~15 secs
                let text = `${message.command}: ${message.args.join(" ")}`;
                this.logger.log("cmd: ", text);
                break;


            case "372":
                this.messageOfTheDay += message.args.join(" ") + "\n";
                break;

            case "375":
                // ignore message of the day start
                break;

            case "376":
                this.logger.log("message of the day: ", this.messageOfTheDay);
                break;

            case "421": // err_unknowncommand
                let errorText = `${message.command}: ${message.args.join(" ")}`;
                this.logger.error("cmd: ", errorText);
                break;

            case "join":
                let join = `Channel: ${message.args[0]}, Host: ${message.host}, Nick:${message.nick}, User: ${message.user}`;
                this.logger.log("join: ", join);
                break;

            default:
                this.logger.log("raw: ", message);
                break;
        }
    }

    private resetMessageCount() {
        this.messageCount30Sec = 0;
    }

    private processDelayedMessages() {
        if (this.delayedMessages.length > this.config.msgLimitPer30Sec) {
            console.warn("There are too many responses queued! I will be busy for a while...");
        }

        let count = 0;
        while (this.delayedMessages.length > 0) {

            if (!this.isUnderMessageLimit()) {
                return;
            }

            let msg = this.delayedMessages.shift();
            if (msg != undefined) {
                this.processResponse(null, msg);
            }

            count += 1;
            if (count > this.config.msgLimitPer30Sec / 3) {
                // we check every 10 seconds, so we can split our responses in 3 batches.
                // TODO Think about having a response timeout, so unimportant stuff can be removed from the queue in a safe manner.
                return;
            }
        }
    }

    private taggedMessageReceived(payload: string, tags: string) {
        let separatorPos = payload.indexOf(":"); // left is meta data, right is message text
        let metaData = payload.substring(0, separatorPos);

        let metaDataList = metaData.split(" ");

        let fromRaw = metaDataList.shift();
        if (isNullOrUndefined(fromRaw)) {
            this.logger.error("Could not parse message tags.");
        } else {
            let from = fromRaw.substring(0, fromRaw.indexOf("!"));

            let command = metaDataList.shift();
            if (isNullOrUndefined(command) || command.toUpperCase() != "PRIVMSG") {
                throw "Wrong handler was called";
            }

            let to = metaDataList.shift();
            if (isNullOrUndefined(to)) {
                this.logger.error("Could not parse 'to' from meta data");
            } else {
                let text = payload.substring(separatorPos + 1);
                this.messageReceived(from, to, text, tags);
            }
        }
    }

    private messageReceived(from: string, to: string, message: string, tagsString?: string) {
        let m;
        if (!isNullOrUndefined(tagsString)) {
            let t = new Tags(tagsString, this.logger);
            m = new Message({ from: from, channel: to, text: message }, t);
        }
        else {
            m = new Message({ from: from, channel: to, text: message });
        }

        this.logger.log(`${to} ${from}: ${message}`);

        this.process(m);
    }

    public registerFeature(plugin: IFeature) {
        plugin.setup(this.processResponse.bind(this));

        if (plugin.trigger == null) {
            this.logger.warn("A plugin without a trigger was registered: " + plugin.constructor.name);
            return;
        }

        let trigger = plugin.trigger.toLowerCase().trim();

        let featureList = this.featureMap.get(trigger);
        if (isNullOrUndefined(featureList)) {
            featureList = new Set<IFeature>();
            this.featureMap.set(trigger, featureList);
        }

        featureList.add(plugin);
    }

    public process(message: Message) {
        let alwaysTriggered = this.featureMap.get("");
        this.invokePlugins(message, alwaysTriggered);

        let trigger = this.getTrigger(message);
        if (trigger == null) {
            return;
        }

        let thisTimeTriggered = this.featureMap.get(trigger);
        this.invokePlugins(message, thisTimeTriggered);
    }

    private getTrigger(msg: Message): string | null {
        if (msg.text.length == 0) {
            return null;
        }

        if (!msg.text.startsWith("!")) {
            return null;
        }

        let spaceIndex = msg.text.indexOf(" ");
        if (spaceIndex == 1) {
            return null; // second char is " " ... thats not triggering stuff
        }
        if (spaceIndex == -1) {
            return msg.text.substring(1); // trigger is one word only
        }

        return msg.text.substring(1, spaceIndex).toLowerCase();
    }

    private invokePlugins(msg: Message, plugins: Set<IFeature> | undefined) {
        if (!isNullOrUndefined(plugins)) {
            for (let p of plugins) {
                p.act(msg);
            }
        }
    }

    private processResponse(err: string | null, r: IFeatureResponse) {
        if (err != null) {
            this.logger.error("processResponse Error", err);
        }

        if (r == null) {
            return;
        }

        if (!isNullOrUndefined(r.message) && r.message.text != "" && r.message.channel != "") {
            if (this.isUnderMessageLimit()) {
                this.messageCount30Sec += 1;
                this.client.say(r.message.channel, r.message.text);
            } else {
                this.deferResponse(r);
            }
        }
    }

    private isUnderMessageLimit(): boolean {
        return this.messageCount30Sec + 1 <= this.config.msgLimitPer30Sec;
    }

    private deferResponse(msg: IFeatureResponse) {
        for (const m of this.delayedMessages) {
            if (this.responseEquals(m, msg)) {
                return;
            }
        }

        this.delayedMessages.push(msg);
    }

    private responseEquals(m1: IFeatureResponse, m2: IFeatureResponse): boolean {
        if (m1 == m2) {
            return true;
        }

        let compares = [
            [m1.message.channel, m2.message.channel],
            [m1.message.from, m2.message.from],
            [m1.message.tags, m2.message.tags],
            [m1.message.text, m2.message.text]
        ];

        for (const comp of compares) {
            if (comp[0] != comp[1]) {
                return false;
            }
        }

        return true;
    }
}


