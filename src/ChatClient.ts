///<reference path="./sub/irc-types/irc.d.ts" />

import { isNullOrUndefined } from "util";
import * as IRC from "irc";
import { ILogger, LogManager } from "psst-log";


export interface ITags {
    getAvailableTags(): IterableIterator<string>;
    get(name: string): string;
}

export interface IMessage {
    from: string;
    channel: string;
    text: string;
    tags?: ITags;
}

export interface IChatClient {
    connect(channel: string): void;
    onConnect(callback: () => void): void;
    onError(callback: (errorMessage: string) => void): void;
    onMessage(callback: (message: IMessage) => void): void;
    send(to: string, text: string, isCommand?: boolean): void;
}

export class Message implements IMessage {
    text: string = "";
    from: string = "";
    /** Channel starts with # otherwise it is a whisper or system notice I guess */
    channel: string = "";
    tags?: ITags;


    constructor(init: Partial<Message>, tags?: ITags) {
        (<any>Object).assign(this, init);
        if (!isNullOrUndefined(tags)) {
            this.tags = tags;
        }
    }

    toString(): string {
        let result: string = `Message from '${this.from}' to '${this.channel}': ${this.text}`;
        return result;
    }
}

export class Tags implements ITags {
    private readonly logger: ILogger;
    private readonly tagMap: Map<string, string> = new Map<string, string>();

    constructor(tags: string, logger?: ILogger) {
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }

        if (!tags.startsWith("@")) {
            this.logger.error("does not seem to be valid tag", tags);
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
        let tagName = name.toLowerCase();
        this.tagMap.set(tagName, value);
    }

    getAvailableTags(): IterableIterator<string> {
        return this.tagMap.keys();
    }

    get(name: string): string {
        return this.tagMap.get(name) || "";
    }
}


/** IRChat client that supports Twitch features
 *  Note: this should be imported by MessageProcessor only */
export class TwitchChatClient implements IChatClient {
    private readonly logger: ILogger;
    private readonly client: IRC.Client;

    private connectListener: Array<() => void> = [];
    private errorListener: Array<(text: string) => void> = [];
    private messageListener: Array<(message: IMessage) => void> = [];

    unhandledMessages: Array<any> = [];
    readonly maxUnhandledMessages: number = 200;
    readonly minUnhandledMessages: number = 100;

    messageOfTheDay: string = "";

    constructor(server: string, login: string, password: string, ircClient?: IRC.Client, logger?: ILogger) {
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }

        if (ircClient == undefined) {
            this.client = new IRC.Client(server, login, {
                autoConnect: false,
                password: password
            });
        } else {
            this.client = ircClient;
        }
    }

    connect(channel: string): void {
        this.client.addListener("error", this.getErrorHandler());

        this.client.addListener("message", this.getMessageHandler());

        this.client.addListener("raw", this.getRawMessageHandler());

        this.client.connect(0, () => {
            this.client.send("CAP REQ", "twitch.tv/tags twitch.tv/commands");
            this.client.join(channel);
            this.invokeAll(this.connectListener);
        });
    }

    onConnect(callback: () => void): void {
        this.connectListener.push(callback);
    }

    onError(callback: (errorMessage: string) => void): void {
        this.errorListener.push(callback);
    }

    onMessage(callback: (message: IMessage) => void): void {
        this.messageListener.push(callback);
    }

    send(to: string, text: string, isCommand?: boolean): void {
        if (isCommand) {
            this.client.send(to, text);
        } else {
            this.client.say(to, text);
        }
    }

    private invokeAll(listenerList: Array<() => void>) {
        listenerList.forEach(listener => {
            listener();
        });
    }

    private invokeAll1<T>(listenerList: Array<(p: T) => void>, param: T) {
        listenerList.forEach(listener => {
            listener(param);
        });
    }

    private getMessageHandler(): (...args: any[]) => void {
        return (from, to, text, obj) => {
            let message: IMessage = {
                from: from,
                channel: to,
                text: text
            };
            this.invokeAll1(this.messageListener, message);
        }
    }

    private getRawMessageHandler(): (...args: any[]) => void {
        return (message) => {
            let cmd: string = message.command;

            // thats a twitch chat tagged message
            if (cmd.startsWith("@")) {
                let payload: string = message.args[0];

                let x: string[] = payload.split(" ", 2); // need to check command
                if (x[1].toUpperCase() == "PRIVMSG") {
                    this.handleTaggedMessage(payload, cmd);
                    return;
                }
            }

            // this is a regular message or command
            if (cmd.toUpperCase() == "PRIVMSG") {
                if (message.args.length == 2) {
                    this.getMessageHandler()(message.user, message.args[0], message.args[1], null);
                    return;
                }
            }

            this.handleUnhandledMessage(message);
        }
    }

    private handleTaggedMessage(payload: string, tagString: string) {
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
                let tags = new Tags(tagString, this.logger);

                let message: IMessage = {
                    from: from,
                    channel: to,
                    text: text,
                    tags: tags
                };
                this.invokeAll1(this.messageListener, message);
            }
        }
    }

    private handleUnhandledMessage(message: any) {
        switch (message.rawCommand.toLowerCase()) {
            case "001": //"rpl_welcome"
            case "002": //"rpl_yourhost"
            case "003": //"rpl_created"
            case "004": //"rpl_myinfo"
            case "353": //"rpl_namreply" ... wehn joining a channel this is sent automatically
            case "366": //"rpl_endofnames"
            case "375": // message of the day start
            case "376": // message of the day end
            case "cap": // capabilities ... if we want to track different feature we should save this
            case "join": // on joining channel
            case "ping":
            case "pong": // sent by twitch every ~15 secs
                let text: string = `${Date.now()} ${message.command}: ${message.args.join(" ")}`;
                this.unhandledMessages.push(text);
                if (this.unhandledMessages.length > this.maxUnhandledMessages) {
                    while (this.unhandledMessages.length > this.minUnhandledMessages) {
                        this.unhandledMessages.shift();
                    }
                }
                break;

            case "372":
                this.messageOfTheDay += message.args.join(" ") + "\n";
                break;

            case "421": // err_unknowncommand
                let errorText = `${message.command}: ${message.args.join(" ")}`;
                this.logger.error("cmd: ", errorText);
                break;

            default:
                this.logger.error(`Recieved unhandled message type: ${message.command}`);
                break;
        }
    }

    private getErrorHandler(): (...args: any[]) => void {
        return (message: any): void => {
            function shouldIgnoreError(message: any): boolean {
                // client sends whois autmatically, we will ignore the first
                return message.args.length > 0 && message.args[1].toLowerCase() == "whois";
            }

            if (!shouldIgnoreError(message)) {
                let errorMessage = "Unknown error";
                if (message.args.length > 0) {
                    errorMessage = message.args.join(" ");
                }
                this.invokeAll1(this.errorListener, errorMessage);
            }
        };
    }
}

export default TwitchChatClient;