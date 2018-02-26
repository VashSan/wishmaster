import * as mp from "../MessageProcessor";
import { Context } from "../../app";
import { Logger } from "../Logger";


/** Just for testing purposes this Feature replys all messages when triggered. */
export class SongRequest implements mp.IFeature {
    trigger: string = "sr";

    constructor(context: Context) {
    }

    /** Enqueue the requested song to the playlist */
    public act(msg: mp.Message, callback: mp.ResponseCallback): void {
        let str: string = msg.toString();

        let answer = new mp.Message({
            from: "",
            channel: msg.channel,
            text: "Loopback-" + msg.toString()
        });

        let response = { message: answer };
        callback(null, response);
    }
}
