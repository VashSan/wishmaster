import * as IMAP from "imap-simple";
import * as path from "path"
import { ILogger } from "psst-log";

import { Context, Database, IAlert, IEmailConfig, ObsController, AlertAction, IMediaPlayer } from "../shared";
import { IMessage } from "../ChatClient";
import { FeatureBase } from "./FeatureBase";

class AlertConst {
    /** Placeholder in config pattern entries */
    public static readonly ViewerPlaceholder = "{Viewer}";
    /** Default encoding for file actions */
    public static readonly Encoding = "utf8";
}

class PendingAlert {
    public readonly viewer: string;
    public readonly action: Function;

    constructor(viewer: string, action: Function) {
        this.viewer = viewer;
        this.action = action;
    }
}

/** Perform actions (alerts) on events like "New Follower", "New Sub" ... */
export class Alerts extends FeatureBase {
    private db: Database;
    private logger: ILogger;
    private soundsPath: string;
    private connection: IMAP.ImapSimple | null = null;
    private mediaPlayer: IMediaPlayer;
    private obs: ObsController;
    private alertConfig: IAlert;
    private pendingAlerts: PendingAlert[] = [];
    private timer: NodeJS.Timer | null = null;
    private maxActions: number = 20; // TODO get from config
    // TODO action file horizontal or vertical
    // TODO action file separator for horizontal
    // TODO action file prefix

    constructor(context: Context, alertConfig: IAlert) {
        super(context.config);

        this.mediaPlayer = context.getMediaPlayer();
        this.db = context.db;
        this.logger = context.logger;
        this.obs = context.obs;
        this.alertConfig = alertConfig;

        this.soundsPath = path.resolve(this.config.getRootPath(), "sounds");

        let email: IEmailConfig | null = this.config.getEmail();
        if (email == null) {
            this.logger.error("Email configuration missing.");
            return;
        }


        let that = this;

        let config = {
            imap: {
                user: email.login,
                password: email.password,
                host: email.host,
                port: email.port,
                tls: email.tls,
                authTimeout: 3000
            },
            onmail: function (numNewMail: number) {
                that.newMail(true);
            }
        };

        function connectionCallback(err: any): void {
            that.logger.error(err);
        }

        IMAP.connect(config).then(function (connection: IMAP.ImapSimple): Promise<void | IMAP.ImapSimple> {
            that.logger.info("Connected to IMAP");

            that.connection = connection;

            return that.newMail(false);
        }, connectionCallback);

    }

    /** just check whether an alert was triggered manually */
    public act(msg: IMessage): void {
        if (msg.from.toLowerCase() == this.config.getNickname().toLowerCase() && msg.text.toLowerCase().startsWith("!alert")) {
            this.handleUserToBotCommand(msg);
            return;
        }

        // I think bots will not get the notification of being hosted via a whisper?
        if (msg.from.toLowerCase() == "jtv") {
            this.handleTwitchCommands(msg);
        }
    }
    private handleTwitchCommands(msg: IMessage): void {
        // radiodefiant is now hosting you.
        const regex = /(\w+) is now hosting you\./;
        let match = regex.exec(msg.text);
        if (match != null && match.length > 0) {
            this.performNewHostActions(match[1]);
        }
    }
    private performNewHostActions(hostFrom: string) {

        let newFollowerAlert = new PendingAlert(hostFrom, () => {
            this.updateUserDatabase(hostFrom, "host");
            this.playBell();
            //this.setObsNewHostText(hostFrom);
            this.appendToViewerActionsHistory(hostFrom, "Host");
            //this.obs.toggleSource(this.alertConfig.parameter, this.alertConfig.durationInSeconds);
            this.sendHostThanksToChat(hostFrom);
        });

        this.notifyNewAlert(newFollowerAlert);
    }

    private sendHostThanksToChat(hostFrom: string) {
        // let text = this.alertConfig.chatPattern.replace(AlertConst.ViewerPlaceholder, hostFrom);
        let text = "Danke für Deinen Host {Viewer}!".replace(AlertConst.ViewerPlaceholder, hostFrom);
        let response = this.createResponse(text);
        this.sendResponse(response);
    }

    private handleUserToBotCommand(msg: IMessage): void {
        let parts = msg.text.split(" ");
        if (parts.length >= 2 && parts[0].toLowerCase() == "!alert" && parts[1].toLowerCase() == "follower") {
            this.performNewFollowerActions(parts[2]);
        }
    }

    private performNewFollowerActions(newFollower: string) {

        let newFollowerAlert = new PendingAlert(newFollower, () => {
            this.updateUserDatabase(newFollower, "follow");
            this.setObsNewFollowerText(newFollower);
            this.appendToViewerActionsHistory(newFollower, null);
            this.obs.toggleSource(this.alertConfig.parameter, this.alertConfig.durationInSeconds);
            this.sendFollowerThanksToChat(newFollower);
        });

        this.notifyNewAlert(newFollowerAlert);
    }

    private notifyNewAlert(newAlert: PendingAlert) {
        this.pendingAlerts.push(newAlert);

        if (this.timer == null) {
            this.timer = setInterval(() => {
                let alert = this.pendingAlerts.shift();
                if (alert == undefined) {
                    if (this.timer != null) {
                        let t = this.timer;
                        this.timer = null;
                        clearInterval(t);
                    }
                } else {
                    alert.action();
                }
            }, (this.alertConfig.durationInSeconds + this.alertConfig.timeoutInSeconds) * 1000 + 1000); //1s if all is 0 is minimum
        }
    }

    // TODO make action an enum
    private updateUserDatabase(newFollower: string, action: string) {
        let now = new Date();
        let nedbUpdate = null;
        switch (action) {
            case "host":
                nedbUpdate = {
                    $inc: { hostCount: 1 },
                    $set: { lastHostDate: now, lastAction: "host", lastActionDate: now },
                };
                break;
            case "follow":
                nedbUpdate = { $set: { followDate: now, lastAction: "follow", lastActionDate: now } };
                break;

        }

        this.db.users.update({ name: newFollower }, nedbUpdate, { upsert: true });
    }

    private setObsNewFollowerText(newFollower: string) {
        let text = this.alertConfig.sceneTextPattern.replace(AlertConst.ViewerPlaceholder, newFollower);
        this.obs.setText(this.alertConfig.sceneTextSource, text);
    }

    private newMail(emitAlert: boolean): Promise<void | IMAP.ImapSimple> {
        if (this.connection == null) {
            return Promise.reject("connection is not set up");
        }

        let that = this;
        let connection = this.connection;

        return this.connection.openBox('INBOX').then(function () {
            var searchCriteria = [
                'UNSEEN'
            ];

            var fetchOptions = {
                bodies: ['HEADER', 'TEXT'],
                markSeen: true
            };

            return connection.search(searchCriteria, fetchOptions).then(function (results) {
                var subjects = results.map(function (res) {
                    return res.parts.filter(function (part) {
                        return part.which === 'HEADER';
                    })[0].body.subject[0];
                });

                that.unreadMails(subjects);
            });
        });
    }

    private unreadMails(subjectList: string[]) {
        subjectList.forEach(subject => {
            let regex = /(.*) folgt dir jetzt auf Twitch$/g; // TODO configurable regex
            let result = regex.exec(subject);
            if (result != null && result.length > 1) {
                this.performNewFollowerActions(result[1]);
            }
        });
    }

    private sendFollowerThanksToChat(newFollower: string) {
        let text = this.alertConfig.chatPattern.replace(AlertConst.ViewerPlaceholder, newFollower);
        let response = this.createResponse(text);
        this.sendResponse(response);
    }

    private playBell() {
        let alertWav = path.resolve(this.soundsPath, "bell.wav");
        this.mediaPlayer.playAudio(alertWav);
    }

    /** Writes a name to a text file
     * @param viewerName The name of the stream viewer
     * @param action Pass an action to be displayed next to the viewer name or null to leave it out 
     */
    private appendToViewerActionsHistory(viewerName: string, action: string | null): void {
        const separator = "  ";
        const endSeparator = "---";

        this.db.users.find({}, { name: 1, lastAction: 1 })
            .sort({ lastActionDate: -1 })
            .limit(this.maxActions)
            .exec((err, docs) => {
                let bannerText = "";
                docs.forEach(element => {
                    let name = this.alertConfig.bannerTextPattern.replace(AlertConst.ViewerPlaceholder, element.name.toString());
                    bannerText += name + separator;
                });
                bannerText += endSeparator + separator;

                this.obs.setText(this.alertConfig.bannerTextSource, bannerText);
            });
    }
}

export default Alerts;