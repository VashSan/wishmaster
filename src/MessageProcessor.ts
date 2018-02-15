import * as IRC from "irc";
import { isNullOrUndefined } from "util";

export interface IFeature {
    trigger: string;
    act(message: Message): IFeatureResponse;
}

export interface IFeatureResponse {
    message: Message;
}

export class Message {
    text: string;
    from: string;
    channel: string;

    constructor(init?: Partial<Message>) {
        (<any>Object).assign(this, init);
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

    public registerPlugin(plugin: IFeature) {
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


