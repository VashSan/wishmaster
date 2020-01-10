import { ILogger } from "psst-log";

import * as MP from "../MessageProcessor";
import { Context } from "../../app";

/** clears a users chat when posting a not white listed url */
export class UrlFilter implements MP.IFeature {
    readonly trigger: string = "";
    private urlRegex = /(?:http[s]?:\/\/)?((?:[a-z0-9]+\.)*[a-z0-9]+\.[a-z]{2,6})(?:\/[a-z0-9]+)*(?=\s)?/gi;
    private logger: ILogger;
    private whiteList: string[];
    private timeoutedUsers: string[] = [];
    private sendResponse: MP.ResponseCallback | null = null;

    constructor(context: Context) {
        this.logger = context.logger;
        this.whiteList = context.config.urlWhiteList;
    }

    public setup(sendResponse: MP.ResponseCallback){
        this.sendResponse = sendResponse;
    }

    /** Return the message we just received */
    public act(msg: MP.Message): void {
        let result;
        while ((result = this.urlRegex.exec(msg.text)) != null) {
            if (result != null && result.length > 1) {
                let domain = result[1];

                if (!this.isWhitelistedDomain(domain)) {
                    this.takeAction(msg, domain);
                    return;
                }
            }
        }
    }

    private isWhitelistedDomain(host: string): boolean {
        for (const fineDomain of this.whiteList) {
            if (host.endsWith(fineDomain)) {
                return true;
            }
        }
        return false;
    }

    private takeAction(msg: MP.Message, domain: string) {
        this.timeoutedUsers.push(msg.from); // thats dirty... but they get timedout ... 

        const maxTimeOut = 600;
        let timeoutCount = this.timeoutedUsers.filter((x) => { return x == msg.from; }).length;
        let timeoutTime = timeoutCount * timeoutCount; // at least 1 sec but gets bad real quick ... 
        if (timeoutTime > maxTimeOut) {
            timeoutTime = maxTimeOut;
        }

        this.logger.info(`Found '${domain}'. User ${msg.from} is timeouted for ${timeoutTime}s.`);

        let timeoutCommand = `/timeout ${msg.from} ${timeoutTime}`;

        this.respond(msg, timeoutCommand);

        let whiteDomains = this.getWhitelistedDomainsAsString();
        this.respond(msg, `Please do not post links, except ${whiteDomains}`);
    }

    private getWhitelistedDomainsAsString(): string {
        return this.whiteList.join(", ");
    }

    private respond(originalMsg: MP.Message, text: string){
        let m = new MP.Message({ channel: originalMsg.channel, text: text });
        let response = { message: m };

        if(this.sendResponse == null) {
            this.logger.error("response callback missing for message: " + text);
        }
        else {
            this.sendResponse(null, response);
        }
    }
}