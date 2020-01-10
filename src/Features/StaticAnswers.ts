import { ILogger } from "psst-log";

import * as mp from "../MessageProcessor";
import { Context } from "../../app";
import { IStaticAnswer } from "../Interfaces";

/** When a command the answer command listens to is found, a text message is replied. */
export class StaticAnswers implements mp.IFeature {
    readonly trigger: string = "";
    private answers: IStaticAnswer[];
    private sendResponse: mp.ResponseCallback | null = null;
    private logger: ILogger;

    constructor(context: Context) {
        this.answers = context.config.staticAnswers;
        this.logger = context.logger;
    }

    public setup(sendResponse: mp.ResponseCallback): void {
        this.sendResponse = sendResponse;
    }

    public act(msg: mp.Message): void {
        for (const a of this.answers) {
            if(msg.text.toLowerCase().startsWith(a.trigger)){
                this.sendReply(msg.channel, a.answer);
                break;
            }
        }
    }

    private sendReply(channel: string, reply: string): void{
        if(this.sendResponse == null) {
            this.logger.error("sendResponse callback not set up for message:" + reply);
            return;
        }

        let answer = new mp.Message({
            from: "",
            channel: channel,
            text: reply
        });

        let response = { message: answer };
        this.sendResponse(null, response);
    }
}
