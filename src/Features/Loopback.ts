import * as mp from "../MessageProcessor";

/** Just for testing purposes this Feature replys all messages when triggered. */
export class Loopback implements mp.IFeature {
    readonly trigger: string;
    private sendResponse: mp.ResponseCallback | null = null;

    /** 
     * You can specify a trigger or send en empty string to be triggered always. 
     * Usually you want this fix, unless it is a user defined command.
     */
    constructor(trigger: string) {
        this.trigger = trigger;
    }

    public setup(sendResponse: mp.ResponseCallback): void {
        this.sendResponse = sendResponse;
    }

    /** Return the message we just received */
    public act(msg: mp.Message): void {
        if (this.sendResponse == null){
            return;
        }
        
        let str: string = msg.toString();

        let answer = new mp.Message({
            from: "",
            channel: msg.channel,
            text: "Loopback-" + msg.toString()
        });

        let response = { message: answer };
        this.sendResponse(null, response);
    }
}

export default Loopback;