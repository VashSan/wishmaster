import { ILogger, LogManager } from "psst-log";

import { IStaticAnswer, IContext, IgnoreDuringTimeout, Seconds, IMediaPlayer } from "../shared";
import { IMessage } from "../shared/ChatClient";
import { FeatureBase } from "./FeatureBase";

type StaticAnswerTimeout = IgnoreDuringTimeout<IStaticAnswer>;

/** When a command the answer command listens to is found, a text message is replied. */
export class StaticAnswers extends FeatureBase {
    private readonly globalTimeout: Seconds;
    private readonly answers: Map<string, StaticAnswerTimeout> = new Map<string, StaticAnswerTimeout>();
    private readonly logger: ILogger;
    private readonly mediaPlayer: IMediaPlayer;

    private nextTime: number = 0;

    constructor(context: IContext, logger?: ILogger) {
        super(context.getConfiguration());
        this.logger = logger ? logger : LogManager.getLogger();
        this.globalTimeout = new Seconds(this.config.getStaticAnswersGlobalTimeout());

        this.mediaPlayer = context.getMediaPlayer();

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
        
        if (timedHandler && Date.now() >= this.nextTime) {
            this.nextTime = Date.now() + this.globalTimeout.inMilliseconds();
            timedHandler.handle();
        }
    }

    private getFirstWord(msg: IMessage): string {
        let parts = msg.text.split(" ");
        return parts[0];
    }

    private sendReply(reply: string): void {
        if (reply != "") {
            let response = this.createResponse(reply);
            this.sendResponse(response);
        }
    }

    private playSound(soundFile: string): void {
        this.mediaPlayer.playAudio(soundFile);
    }
}
