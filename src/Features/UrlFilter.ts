import * as MP from "../MessageProcessor";
import { Logger, Context } from "../../app";

/** clears a users chat when posting a not white listed url */
export class UrlFilter implements MP.IFeature {
    readonly trigger: string = "";
    private urlRegex: RegExp = new RegExp(/http[s]?:\/\/[\S]+/g);
    private logger: Logger;
    private whiteList: string[];
    private timeoutedUsers: string[] = [];

    constructor(context: Context) {
        this.logger = context.logger;
        this.whiteList = context.config.urlWhiteList;
    }

    /** Return the message we just received */
    public act(msg: MP.Message, callback: MP.ResponseCallback): void {
        let match = this.urlRegex.exec(msg.text);
        if (match != null) {
            for (const m of match) {
                // TODO 
                // ... this does not work as expected... first twitch links all "xxxx.xx" strings... meh
                // ... second that regex somehow is not doing as well as expected and not returning some matches ... sigh
                let start = m.indexOf("://");
                let end = m.indexOf("/", start + 3);

                let checkString: string;
                if (end == -1) {
                    checkString = m.substring(start + 3)
                } else {
                    checkString = m.substring(start + 3, end);
                }

                if (!this.isWhitelistedDomain(checkString)) {
                    this.logger.info("Found domain worth to be timeouted.");
                    this.takeAction(msg, callback);
                    return;
                }
            }
        }
    }

    private isWhitelistedDomain(host: string): boolean {
        for (const fineDomain of this.whiteList) {
            if (!host.endsWith(fineDomain)) {
                return false;
            }
        }
        return true;
    }

    private takeAction(msg: MP.Message, callback: MP.ResponseCallback) {
        this.timeoutedUsers.push(msg.from); // thats dirty... but they get timedout ... 

        let timeoutCount = this.timeoutedUsers.filter((x) => { return x == msg.from; }).length;
        let timeoutTime = timeoutCount * timeoutCount; // at least 1 sec but gets bad real quick ... 

        let timeoutCommand = `/timeout ${msg.from} ${timeoutTime}`;

        let m = new MP.Message({ channel: msg.channel, text: timeoutCommand });

        let response = { message: m };

        callback(null, response);
    }
}