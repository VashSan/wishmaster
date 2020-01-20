import { ITags } from "../ChatClient";
import { ILogger, LogManager } from "psst-log";

export enum UserType {
    Normal,
    Moderator,
    GlobalMod,
    Admin,
    Staff
}

export class Emote {
    id: number = 0;
    start: number = 0;
    end: number = 0;
}

export class TagReader {

    private readonly tags: ITags;
    private readonly logger: ILogger;

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

    constructor(tags: ITags, logger?: ILogger) {
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }
        this.tags = tags;
        this.assignValues();
    }

    public isBroadcaster(): boolean {
        for (const badge of this.badgeList) {
            if (badge.toLowerCase() == "broadcaster") {
                return true;
            }
        }
        return false;
    }

    private assignValues() {
        for (const element of this.tags.getAvailableTags()) {
            let value = this.tags.get(element);
            this.assignValue(element, value);
        }
    }

    private assignValue(name: string, value: string) {
        switch (name.toLowerCase()) {
            case "color":
                this.color = value;
                break;
            case "bits":
                this.bits = this.parseInt(value);
                break;
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