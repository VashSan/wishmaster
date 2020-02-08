import { ILogger, LogManager } from "psst-log";

import { IContext } from "../shared";
import { FeatureBase } from "./FeatureBase";
import { IMessage } from "../shared/ChatClient";

enum State {
    Idle,
    Open,
    WaitingForResult
}

interface IAnswer {
    user: string;
    text: string;
}

/** Often twitch bets are done by betting a virtual currency and wawiting for a RNG.
 * This is different, and shall enable betting real results.
 */
export class Bets extends FeatureBase {
    private logger: ILogger;
    private state: State;
    private answers: IAnswer[] = [];

    constructor(context: IContext, logger?: ILogger) {
        super(context.getConfiguration());

        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }

        this.state = State.Idle;
    }

    public getTrigger(): string {
        return "bet";
    }

    public act(msg: IMessage): void {
        let answerText: string = "";


        let payload = msg.text.split(" ");
        /* let trigger = */ payload.splice(0, 1);
        let command = payload[0];

        if (msg.from.toLowerCase() == this.config.getNickname().toLowerCase()) {
            if (this.state == State.Idle && command.toLowerCase() == "open") {
                this.answers.length = 0;
                this.state = State.Open;
                answerText = "Place your bet by entering !bet <choice>";
            }

            if (this.state == State.Open && command.toLowerCase() == "close") {
                this.state = State.Idle;
                answerText = "Bets are closed!";
                // TODO write all answers to report
            }

            if (this.state == State.Idle && command.toLowerCase() == "result") {
                payload.splice(0, 1);
                let result = payload.join(" ");
                let resultLower = result.toLowerCase();



                let winners = this.answers.filter(a => a.text.toLowerCase() == resultLower);
                let winnerNames = winners.map(w => w.user);
                let winnerText = winnerNames.join(", ");

                answerText = "Winners: " + winnerText;
                // TODO write winners to report
            }
        }
        else if (this.state == State.Open) {
            let betText = payload.join(" ");
            let answer = this.answers.find(a => a.user == msg.from);
            if (answer == undefined) {
                let newAnswer: IAnswer = {
                    user: msg.from,
                    text: betText
                };
                this.answers.push(newAnswer);
            }
            else {
                answer.text = betText;
            }
        }

        if (answerText != "") {
            let response = this.createResponse(answerText);
            this.sendResponse(response);
        }
    }
}

export default Bets;