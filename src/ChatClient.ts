
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
    send(text: string, to: string): void;
}

/** this should be imported by MessageProcessor only */
export class ChatClient implements IChatClient {
    private client: IRC.Client;
    private connectListener: Array<() => void> = [];
    private errorListener: Array<(text: string) => void> = [];

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

    private invokeAll<T>(listenerList: Array<() => void>) {
        listenerList.forEach(listener => {
            listener();
        });
    }

    connect(channel: string): void {
        this.client.connect(0, () => {
            //this.client.send("CAP REQ", "twitch.tv/tags twitch.tv/commands");
            this.client.join(channel);
            this.invokeAll(this.connectListener);
        });
    }

    onConnect(callback: () => void): void {
        this.connectListener.push(callback);
    }

    onError(callback: (errorMessage: string) => void): void {
        throw new Error("Method not implemented.");
    }

    onMessage(callback: (message: IMessage) => void): void {
        throw new Error("Method not implemented.");
    }

    send(text: string, to: string): void {
        throw new Error("Method not implemented.");
    }
}

export default ChatClient;