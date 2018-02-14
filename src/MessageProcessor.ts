import { isNullOrUndefined } from "util";

export interface IPlugin {
    trigger: string;
    act(message: Message): IPluginResponse;
}

export interface IPluginResponse {
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
    plugins = new Map<string, Set<IPlugin>>();

    registerPlugin(plugin: IPlugin) {
        if (plugin.trigger == null){
            return;
        }
        
        let trigger = plugin.trigger.toLowerCase().trim();

        let pluginSet : Set<IPlugin>;
        if (this.plugins.has(trigger)){
            pluginSet = this.plugins.get(trigger);
        } else {
            pluginSet = new Set<IPlugin>();
            this.plugins.set(trigger, pluginSet);
        }

        pluginSet.add(plugin);
    }

    process(message: Message) {
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
            return msg.text; // trigger is one word only
        }

        return msg.text.substring(1, spaceIndex).toLowerCase();
    }

    private invokePlugins(msg: Message, plugins : Set<IPlugin> ){
        if (!isNullOrUndefined(plugins)){
            for(let p of plugins){
                p.act(msg);
            }
        }
    }
}


