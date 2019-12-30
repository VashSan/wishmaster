import * as mp from "../MessageProcessor";
import * as request from "request";
import { Context } from "../../app";
import { ILogger } from "psst-log";

/** Just for testing purposes this Feature replys all messages when triggered. */
export class Stomt implements mp.IFeature {
    trigger = "i";
    appId: string = "";
    url: string = "";
    logger: ILogger;
    isInitialized: boolean = false;
    sendResponse: mp.ResponseCallback | null = null;


    constructor(context: Context) {
        this.logger = context.logger;
        
        if (context.config.stomt == null) {
            return;
        }
        this.appId = context.config.stomt.applicationId;
        this.url = context.config.stomt.baseUrl;

        this.isInitialized = true;
    }

    public setup(sendRepsonse: mp.ResponseCallback): void {
        this.sendResponse = sendRepsonse;
    }

    public act(msg: mp.Message): void {
        if (!this.isInitialized) {
            return;
        }

        // !i wish vash would
        // !i like vash because 
        let parts = msg.text.split(" ");
        if (parts.length < 4) {
            this.logger.warn("Stomt with no meaningful text");
            return;
        }

        let wishOrLike = parts[1].toLowerCase();
        let positive = wishOrLike == "wish" ? false : wishOrLike == "like" ? true : null;
        if (positive == null) {
            this.logger.warn("Stomt with wrong Syntax");
            return;
        }

        // let target = parts[2]; // TODO could address different targets if we find out id ... does this make sense?
        // should we verify name even if we cant address?

        let textParts = parts.slice(3);
        let text = textParts.join(" ");

        let payload = {
            "text": text,
            //"target_id":    (string),   // if not specified page of the appid will be used
            "positive": positive,  // (default: false => wish)
            //"lang":         (string),   // en, de, ...
            //"url":          (string),
            "anonym": true,
            //"img_name":     (string),
            //"file_uid":     (string),
            //"lonlat":       (string),   // (float), (float)
            // "files": {
            //     "stomt": {        
            //         "file_uid":    (string) // File-uid
            //     }
            // },
            // "extradata": {
            //     "labels":   (array),    // label names that will be attached to the stomt
            //     (json)                  // any json data you want to attach
            // }, 
        };

        let that = this;
        request({
            url: this.url,
            method: "POST",
            json: true,
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "appid": this.appId
            },
            body: payload
        },
            (error, response, body) => {
                that.logger.log(`Stomt returned code ${response.statusCode}.`);
                if (error) {
                    that.logger.error(body, error);
                }
            }
        );
    }
}
