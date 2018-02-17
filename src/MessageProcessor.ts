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

export class Tags {
    public color = "";

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
            switch(tagName.toLowerCase()){
                case "color":
                    this.color = tagValue;
                    break;
                default:
                    console.warn("Unknown tag: ", tagName);
            }
        }
            // badges=subscriber/6,bits/50000
            // color=#FF0000"
            // display-name=Kemli
            // emote-only=1
            // emotes=425618:0-2
            // id=a6da0696-e409-4a3b-85d0-0884e1bb3d33
            // mod=0
            // room-id=19571641
            // subscriber=1
            // tmi-sent-ts=1518890298206
            // turbo=0
            // user-id=29515071
            // user-type=
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


