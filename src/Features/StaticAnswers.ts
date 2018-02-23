import * as mp from "../MessageProcessor";
import { Context } from "../../app";
import { IStaticAnswer } from "../Interfaces";

/** Just for testing purposes this Feature replys all messages when triggered. */
export class StaticAnswers implements mp.IFeature {
    trigger: string = "";
    answers: IStaticAnswer[];

    constructor(context: Context) {
        this.answers = context.config.staticAnswers;
    }

    /** Return a previously defined message if triggerd */
    public act(msg: mp.Message, callback: mp.ResponseCallback): void {
        for (const a of this.answers) {
            if(msg.text.toLowerCase().startsWith(a.trigger)){
                this.sendReply(msg.channel, a.answer, callback);
                break;
            }
        }
    }

    private sendReply(channel: string, reply: string, callback: mp.ResponseCallback){
        let answer = new mp.Message({
            from: "",
            channel: channel,
            text: reply
        });

        let response = { message: answer };
        callback(null, response);
    }
}
