import * as Collections from 'typescript-collections';

export interface IPlugin {
    trigger: string;
    act(message: Message): BotAnswer;
}

export class BotAnswer {
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
    messageProcessingThreshold = 5;
    messageQueue = new Collections.Queue<Message>();
    plugins = new Collections.LinkedList<IPlugin>();

    constructor() {

    }

    add(message: Message) {
        this.messageQueue.enqueue(message);
        if (this.messageQueue.size() % this.messageProcessingThreshold == 0) {
            this.processMessages();
        }
    }

    registerPlugin(plugin: IPlugin) {
        if (plugin.trigger != null) {
            plugin.trigger = plugin.trigger.toLowerCase();
        }

        this.plugins.forEach(function (p) {
            if (p.trigger == plugin.trigger) {
                throw "Can not add plugin because same trigger exists already";
            }
        });

        this.plugins.add(plugin);
    }

    private processMessages() {

        while (this.messageQueue.size() > 0) {
            let msg = this.messageQueue.dequeue();
            this.plugins.forEach(function (p) {
                let words = msg.text.split(" ", 1);
                if (p.trigger == null || words[0].toLowerCase() == p.trigger) {
                    p.act(msg);
                }
            });
        }

    }
}


