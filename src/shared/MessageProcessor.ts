import { isNullOrUndefined } from "util";
import { ILogger, LogManager } from "psst-log";
import {
    TwitchChatClient, Seconds,
    IChatClient, IMessage, IContext, IConfiguration, IMessageProcessorConfig
} from ".";

export type ResponseCallback = (error: string | null, response: IFeatureResponse) => void;

export interface IFeature {
    getTrigger(): string;
    setup(callback: ResponseCallback): void;
    act(message: IMessage): void;
}

export interface IFeatureResponse {
    message: IMessage;
}

export interface IMessageProcessor {
    connect(): void;
    registerFeature(plugin: IFeature): void;
}

/** Takes care of distributing chat messages to the Feature classes */
export class MessageProcessor implements IMessageProcessor {
    private featureMap = new Map<string, Set<IFeature>>();
    private client: IChatClient;
    private context: IContext;
    private config: IConfiguration;
    private myConfig: IMessageProcessorConfig;
    private logger: ILogger;
    private delayedMessages: IFeatureResponse[] = [];
    private messageCountInInterval = 0;
    private timerHandles: NodeJS.Timer[] = [];

    constructor(context: IContext, chatClient?: IChatClient, logger?: ILogger) {
        this.context = context;
        this.config = context.getConfiguration();

        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }

        if (chatClient) {
            this.client = chatClient;
        } else {
            this.client = new TwitchChatClient(this.config.getServer(), this.config.getNickname(), this.config.getPassword());
        }

        let mpConfig = this.config.getMessageProcessorConfig();
        if (mpConfig != null) {
            this.myConfig = mpConfig;
        } else {
            this.myConfig = {
                responseIntervalInMilliseconds: new Seconds(30).inMilliseconds(),
                responseLimitPerInterval: 20,
                delayIntervalInMilliseconds: new Seconds(1).inMilliseconds(),
                maxNumberOfResponsesPerDelayInterval: 1
            };
        }

        this.client.onMessage((msg: IMessage): void => {
            this.process(msg);
        });

        this.client.onError((error: string): void => {
            this.logger.error(error);
        });
    }

    public connect() {
        let timersToCreate = [
            { method: this.resetMessageCount, timeout: this.myConfig.responseIntervalInMilliseconds },
            { method: this.processDelayedMessages, timeout: this.myConfig.delayIntervalInMilliseconds }
        ];

        timersToCreate.forEach((t) => {
            let timer = setInterval(t.method.bind(this), t.timeout);
            this.timerHandles.push(timer);
        });

        this.client.connect(this.config.getChannel());
    }

    public disconnect() {
        this.timerHandles.forEach((timer) => {
            clearInterval(timer);
        });
        // TODO this.client.disconnect
    }

    private resetMessageCount() {
        this.messageCountInInterval = 0;
    }

    private processDelayedMessages() {
        if (this.delayedMessages.length > this.myConfig.responseLimitPerInterval) {
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
            if (count > this.myConfig.maxNumberOfResponsesPerDelayInterval) {
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
                this.messageCountInInterval += 1;
                this.client.send(r.message.channel, r.message.text);
            } else {
                this.deferResponse(r);
            }
        }
    }

    private isUnderMessageLimit(): boolean {
        return this.messageCountInInterval + 1 <= this.myConfig.responseLimitPerInterval;
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

        if (msg1.tags && msg2.tags) {
            compares.push([msg1.tags, msg2.tags]);
        }

        for (const comp of compares) {
            if (comp[0] != comp[1]) {
                return false;
            }
        }

        return true;
    }
}


