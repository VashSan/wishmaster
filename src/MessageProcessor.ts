import { isNullOrUndefined } from "util";
import { ILogger } from "psst-log";
import { Configuration, Context } from "./shared";
import { TwitchChatClient, IChatClient, IMessage, ITaggedMessage, hasTags } from "./ChatClient";

export type ResponseCallback = (error: string | null, response: IFeatureResponse) => void;

export interface IFeature {
    getTrigger(): string;
    setup(callback: ResponseCallback): void;
    act(message: IMessage): void;
}

export interface IFeatureResponse {
    message: IMessage;
}

/** Takes care of distributing chat messages to the Feature classes */
export class MessageProcessor {
    private featureMap = new Map<string, Set<IFeature>>();
    private client: IChatClient;
    private context: Context;
    private config: Configuration;
    private logger: ILogger;
    private delayedMessages: IFeatureResponse[] = [];
    private messageCount30Sec = 0;

    constructor(context: Context, chatClient?: IChatClient) {
        this.context = context;
        this.config = context.config;
        this.logger = context.logger;

        if (chatClient) {
            this.client = chatClient;
        } else {
            this.client = new TwitchChatClient(this.config.server, this.config.nickname, this.config.password);
        }

        this.client.onMessage((msg: IMessage): void => {
            this.process(msg);
        });

        this.client.onError((error: string): void => {
            this.logger.error(error);
        });
    }

    public connect() {
        setInterval(this.resetMessageCount.bind(this), 1000 * 30);
        setInterval(this.processDelayedMessages.bind(this), 1000 * 10);

        this.client.connect(this.config.channel);
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

    public registerFeature(plugin: IFeature) {
        plugin.setup(this.processResponse.bind(this));

        let trigger = plugin.getTrigger().toLowerCase().trim();

        let featureList = this.featureMap.get(trigger);
        if (isNullOrUndefined(featureList)) {
            featureList = new Set<IFeature>();
            this.featureMap.set(trigger, featureList);
        }

        featureList.add(plugin);
    }

    private process(message: IMessage) {
        let alwaysTriggered = this.featureMap.get("");
        this.invokePlugins(message, alwaysTriggered);

        let trigger = this.getTrigger(message);
        if (trigger == null) {
            return;
        }

        let thisTimeTriggered = this.featureMap.get(trigger);
        this.invokePlugins(message, thisTimeTriggered);
    }

    private getTrigger(msg: IMessage): string | null {
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

    private invokePlugins(msg: IMessage, plugins: Set<IFeature> | undefined) {
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
                this.client.send(r.message.channel, r.message.text);
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

        const msg1 = m1.message;
        const msg2 = m2.message;

        let compares: any[][] = [
            [msg1.channel, msg2.channel],
            [msg1.from, msg2.from],
            [msg1.text, msg2.text]
        ];

        if (hasTags(msg1) && hasTags(msg2)) {
            let msgT1 = (msg1 as ITaggedMessage);
            let msgT2 = (msg2 as ITaggedMessage);
            compares.push([msgT1.tags, msgT2.tags]);
        }

        for (const comp of compares) {
            if (comp[0] != comp[1]) {
                return false;
            }
        }

        return true;
    }
}


