
import * as IRC from "irc";

export interface ITags {

}

export interface IMessage {
    from: string;
    channel: string;
    text: string;
    tags: ITags | null;
}

export interface IChatClient {
    connect(channel: string): void;
    onConnect(callback: () => void): void;
    onError(callback: (errorMessage: string) => void): void;
    onMessage(callback: (message: IMessage) => void): void;
    send(to: string, text: string, isCommand?: boolean): void;
}

/** IRChat client that supports Twitch features
 *  Note: this should be imported by MessageProcessor only */
export class TwitchChatClient implements IChatClient {
    private client: IRC.Client;
    private connectListener: Array<() => void> = [];
    private errorListener: Array<(text: string) => void> = [];
    private messageListener: Array<(message: IMessage) => void> = [];

    constructor(server: string, login: string, password: string, ircClient?: IRC.Client) {
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
        this.client.addListener("error", this.handleErrors());

        this.client.addListener("message", this.handleMessages());

        this.client.addListener("raw", this.handleRawMessage());

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

    private handleMessages(): (...args: any[]) => void {
        return (from, to, text) => {
            let message: IMessage = {
                from: from,
                channel: to,
                text: text,
                tags: null
            };
            this.invokeAll1(this.messageListener, message);
        };
    }

    private handleRawMessage(): (...args: any[]) => void {
        return (r) => {
            // let cmd: string = message.command;

            // // thats a twitch chat tagged message something our lib does not recongnize 
            // if (cmd.startsWith("@")) {
            //     let payload: string = message.args[0];

            //     let x: string[] = payload.split(" ", 2); // need to check command
            //     if (x[1].toUpperCase() == "PRIVMSG") {
            //         this.taggedMessageReceived(payload, cmd);
            //         return;
            //     }
            // }

            // // this is a regular message or command
            // if (cmd.toUpperCase() == "PRIVMSG") {
            //     if (message.args.length == 2) {
            //         this.messageReceived(message.user, message.args[0], message.args[1]);
            //         return;
            //     }
            // }

            console.log(r);
        };
    }

    private handleErrors(): (...args: any[]) => void {
        return message => {
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