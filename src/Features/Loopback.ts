import * as mp from "../MessageProcessor";

/** Just for testing purposes this Feature replys all messages when triggered. */
export class Loopback implements mp.IFeature {
    trigger: string;

    /** 
     * You can specify a trigger or send en empty string to be triggered always. 
     * Usually you want this fix, unless it is a user defined command.
     */
    constructor(trigger: string) {
        this.trigger = trigger;
    }

    /** Return the message we just received */
    act(msg: mp.Message): mp.IFeatureResponse {
        let str: string = msg.toString();

        let answer = new mp.Message({
            from: null,
            channel: msg.channel,
            text: "Loopback-" + msg.toString()
        });

        let response = { message: answer };
        return response;
    }
}

export default Loopback;