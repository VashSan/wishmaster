import { ILogger, LogManager } from "psst-log";

import { IContext } from "../shared";
import { FeatureBase } from "./FeatureBase";
import { IMessage } from "../shared/ChatClient";

/** clears a users chat when posting a not white listed url */
export class UrlFilter extends FeatureBase {
    private urlRegex = /(?:http[s]?:\/\/)?((?:[a-z0-9]+\.)*[a-z0-9]+\.[a-z]{2,6})(?:\/[a-z0-9]+)*(?=\s)?/gi;
    private logger: ILogger;
    private whiteList: string[];
    private timeoutedUsers: string[] = [];

    constructor(context: IContext, logger?: ILogger) {
        super(context.getConfiguration());
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }

        this.whiteList = this.config.getUrlWhiteList();
    }

    /** Return the message we just received */
    public act(msg: IMessage): void {
        let result;
        while ((result = this.urlRegex.exec(msg.text)) != null) {
            if (result != null && result.length > 1) {
                let domain = result[1];

                if (this.shallCheckDomain(msg) && !this.isWhitelistedDomain(domain)) {
                    this.takeAction(msg, domain);
                    return;
                }
            }
        }
    }

    private shallCheckDomain(message: IMessage): boolean {
        if (message.tags) {
            let tags = message.tags;
            if (tags.isMod() || tags.isEmoteOnly() || tags.isBroadcaster()) {
                return false;
            }
        }
        return true;
    }

    private isWhitelistedDomain(host: string): boolean {
        for (const fineDomain of this.whiteList) {
            if (host.endsWith(fineDomain)) {
                return true;
            }
        }
        return false;
    }

    private takeAction(msg: IMessage, domain: string) {
        this.timeoutedUsers.push(msg.from); // thats dirty... but they get timedout ... 

        const maxTimeOut = 600;
        let timeoutCount = this.timeoutedUsers.filter((x) => { return x == msg.from; }).length;
        let timeoutTime = timeoutCount * timeoutCount; // at least 1 sec but gets bad real quick ... 
        if (timeoutTime > maxTimeOut) {
            timeoutTime = maxTimeOut;
        }

        this.logger.info(`Found '${domain}'. User ${msg.from} is timeouted for ${timeoutTime}s.`);

        let timeoutResponse = this.createResponse(`/timeout ${msg.from} ${timeoutTime}`);
        this.sendResponse(timeoutResponse);

        let whiteDomains = this.getWhitelistedDomainsAsString();
        let userResponse = this.createResponse(`@${msg.from} please do not post links, except ${whiteDomains}`);
        this.sendResponse(userResponse);
    }

    private getWhitelistedDomainsAsString(): string {
        return this.whiteList.join(", ");
    }
}