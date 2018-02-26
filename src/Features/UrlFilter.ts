import * as MP from "../MessageProcessor";
import { Context } from "../../app";
import { Logger } from "../Logger";

/** clears a users chat when posting a not white listed url */
export class UrlFilter implements MP.IFeature {
    readonly trigger: string = "";
    private urlRegex = /(?:http[s]?:\/\/)?((?:[a-z0-9]+\.)*[a-z0-9]+\.[a-z]{2,6})(?:\/[a-z0-9]+)*(?=\s)?/gi;
    private logger: Logger;
    private whiteList: string[];
    private timeoutedUsers: string[] = [];

    constructor(context: Context) {
        this.logger = context.logger;
        this.whiteList = context.config.urlWhiteList;
    }

    /** Return the message we just received */
    public act(msg: MP.Message, callback: MP.ResponseCallback): void {
        let result;
        while ((result = this.urlRegex.exec(msg.text)) != null) {
            if (result != null && result.length > 1) {
                let domain = result[1];

                if (!this.isWhitelistedDomain(domain)) {
                    this.takeAction(msg, domain, callback);
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

    private takeAction(msg: MP.Message, domain: string, callback: MP.ResponseCallback) {
        this.timeoutedUsers.push(msg.from); // thats dirty... but they get timedout ... 

        let timeoutCount = this.timeoutedUsers.filter((x) => { return x == msg.from; }).length;
        let timeoutTime = timeoutCount * timeoutCount; // at least 1 sec but gets bad real quick ... 

        this.logger.info(`Found '${domain}'. User ${msg.from} is timeouted for ${timeoutTime}s.`);

        let timeoutCommand = `/timeout ${msg.from} ${timeoutTime}`;
        let m = new MP.Message({ channel: msg.channel, text: timeoutCommand });
        let response = { message: m };
        callback(null, response);
    }
}