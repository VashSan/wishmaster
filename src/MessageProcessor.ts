import * as IRC from "irc";
import { isNullOrUndefined } from "util";
import { DH_CHECK_P_NOT_SAFE_PRIME } from "constants";

export interface IFeature {
    readonly trigger: string;
    act(message: Message): IFeatureResponse;
}

export interface IFeatureResponse {
    message: Message;
}

export class Emote {
    id: number;
    start: number;
    end: number;
}

export enum UserType {
    Normal,
    Moderator,
    GlobalMod,
    Admin,
    Staff
}

export class Tags {
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

    constructor(tags: string){
        if(!tags.startsWith("@")){
            console.error("does not seem to be valid tag", tags);
            return;
        }

        this.parseTags(tags.substring(1));
    }

    private parseTags(tags: string){
        let tagList: string[] = tags.split(";");

        for (const tag of tagList) {
            let tagTuple = tag.split("=");
            let tagName = tagTuple[0];
            let tagValue = tagTuple[1];
            
            this.assignTag(tagName, tagValue);
        }
    }

    private assignTag(name: string, value: string): void{
        switch(name.toLowerCase()){
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
                console.error(`Unknown tag: '${name}' = '${value}'`);
        }
    }

    private parseUserType(t:string): UserType{
        switch(t.toLowerCase()){
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

        console.error("Unknown UserType:", t);
        return UserType.Normal;
    }

    private parseBool(b:string): boolean{
        try {
            return b != "0";
        } catch (ex) {
            console.error(ex);
            return false;
        }
    }

    private parseInt(i:string): number{
        try {
            return Number.parseFloat(i);
        } catch (ex) {
            console.error(ex);
            return 0;
        }
    }

    private parseBadges(badgesString:string): string[] {
        let bList = badgesString.split(",");
        let result: string[] = [];
        
        for (const badge of bList) {
            let b = badge.split("/");

            if(b[0].length > 0) {
                result.push(b[0]);
            }
        }

        return result;
    }

    private parseEmotes(value: string){
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
    text: string;
    from: string;
    channel: string;
    tags: Tags;

    constructor(init: Partial<Message>, tags?: Tags) {
        (<any>Object).assign(this, init);
        if(isNullOrUndefined(tags)){
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
    private plugins = new Map<string, Set<IFeature>>();
    private client: IRC.Client;

    constructor(client: IRC.Client){
        this.client = client;
    }

    public registerFeature(plugin: IFeature) {
        if (plugin.trigger == null){
            return;
        }
        
        let trigger = plugin.trigger.toLowerCase().trim();

        let pluginSet : Set<IFeature>;
        if (this.plugins.has(trigger)){
            pluginSet = this.plugins.get(trigger);
        } else {
            pluginSet = new Set<IFeature>();
            this.plugins.set(trigger, pluginSet);
        }

        pluginSet.add(plugin);
    }

    public process(message: Message) {
        let alwaysTriggered = this.plugins.get("");
        this.invokePlugins(message, alwaysTriggered);

        let trigger = this.getTrigger(message);
        if (trigger == null){
            return;
        }

        let thisTimeTriggered = this.plugins.get(trigger);
        this.invokePlugins(message, thisTimeTriggered);
    }

    private getTrigger(msg: Message) : string{
        if(!msg.text.startsWith("!")){
            return null;
        }

        let spaceIndex = msg.text.indexOf(" ");
        if (spaceIndex == 1){
            return null; // second char is " " ... thats not triggering stuff
        }
        if (spaceIndex == -1){
            return msg.text.substring(1); // trigger is one word only
        }

        return msg.text.substring(1, spaceIndex).toLowerCase();
    }

    private invokePlugins(msg: Message, plugins : Set<IFeature> ){
        if (!isNullOrUndefined(plugins)){
            for(let p of plugins){
                let response = p.act(msg);
                this.processResponse(response);
            }
        }
    }

    private processResponse(r: IFeatureResponse){
        if (r == null){
            return;
        }

        if(!isNullOrUndefined(r.message) && !isNullOrUndefined(r.message.text)){
            this.client.say(r.message.channel, r.message.text);
        }
    }
}


