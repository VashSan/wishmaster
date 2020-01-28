import { ILogger } from "psst-log";

import { Context, IStaticAnswer } from "../shared";
import { IMessage } from "../ChatClient";
import { FeatureBase } from "./FeatureBase";

/** When a command the answer command listens to is found, a text message is replied. */
export class StaticAnswers extends FeatureBase {
    private answers: IStaticAnswer[];
    private logger: ILogger;

    constructor(context: Context) {
        super(context.config);
        this.answers = this.config.getStaticAnswers();
        this.logger = context.logger;
    }

    public act(msg: IMessage): void {
        for (const a of this.answers) {
            if (msg.text.toLowerCase().startsWith(a.trigger)) {
                this.sendReply(a.answer);
                break;
            }
        }
    }

    private sendReply(reply: string): void {
        let response = this.createResponse(reply);
        this.sendResponse(response);
    }
}
