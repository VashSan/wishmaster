import { ILogger, LogManager } from "psst-log";

import { IStaticAnswer, IContext, IgnoreDuringTimeout, Seconds } from "../shared";
import { IMessage } from "../ChatClient";
import { FeatureBase } from "./FeatureBase";

type StaticAnswerTimeout = IgnoreDuringTimeout<IStaticAnswer>;

/** When a command the answer command listens to is found, a text message is replied. */
export class StaticAnswers extends FeatureBase {
    private answers: Map<string, StaticAnswerTimeout> = new Map<string, StaticAnswerTimeout>();
    private logger: ILogger;

    constructor(context: IContext, logger?: ILogger) {
        super(context.getConfiguration());
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }

        this.config.getStaticAnswers().forEach((answer: IStaticAnswer) => {
            let seconds = 0;
            if (answer.timeoutInSeconds) {
                seconds = answer.timeoutInSeconds;
            }

            const timeout = new IgnoreDuringTimeout<IStaticAnswer>(
                new Seconds(seconds),
                answer,
                (a) => {
                    if (a.answer != "") this.sendReply(a.answer);
                    if (a.soundFile) this.playSound(a.soundFile);
                });

            this.answers.set(answer.trigger, timeout);
        });
    }

    public act(msg: IMessage): void {
        const firstWord = this.getFirstWord(msg);
        let timedHandler = this.answers.get(firstWord);
        timedHandler?.handle();
    }

    private getFirstWord(msg: IMessage): string {
        let parts = msg.text.split(" ", 2);
        return parts[0];
    }

    private sendReply(reply: string): void {
        if (reply != "") {
            let response = this.createResponse(reply);
            this.sendResponse(response);
        }
    }

    private playSound(soundFile: string): void {
        throw "not implemented";
    }
}
