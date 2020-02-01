import { ILogger, LogManager } from "psst-log";

import { IStaticAnswer, IContext } from "../shared";
import { IMessage } from "../ChatClient";
import { FeatureBase } from "./FeatureBase";

/** When a command the answer command listens to is found, a text message is replied. */
export class StaticAnswers extends FeatureBase {
    private answers: IStaticAnswer[];
    private logger: ILogger;

    constructor(context: IContext, logger?: ILogger) {
        super(context.getConfiguration());
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }

        this.answers = this.config.getStaticAnswers();
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
        if (reply != "") {
            let response = this.createResponse(reply);
            this.sendResponse(response);
        }
    }
}
