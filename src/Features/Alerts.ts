import * as IMAP from "imap-simple";
import * as path from "path"
import * as fs  from "fs";
import { execFile } from "child_process"
import { ILogger } from "psst-log";
import { isNullOrUndefined } from "util";


import * as MP from "../MessageProcessor";
import { Configuration, Context, Database, IAlert, IEmailAccess, ObsController, AlertAction } from "../shared";

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
export class Alerts implements MP.IFeature {
    private db: Database;
    private sendResponse: MP.ResponseCallback | null = null;
    private config: Configuration;
    private logger: ILogger;
    private soundsPath: string;
    private connection: IMAP.ImapSimple | null = null;
    private obs: ObsController;
    private alertConfig: IAlert;
    private pendingAlerts: PendingAlert[] = [];
    private timer: NodeJS.Timer | null = null;
    private maxActions: number = 20; // TODO get from config
                                     // TODO action file horizontal or vertical
                                     // TODO action file separator for horizontal
                                     // TODO action file prefix

    public trigger: string = "alert";

    constructor(context: Context, alertConfig: IAlert) {
        this.db = context.db;
        this.config = context.config;
        this.logger = context.logger;   
        this.obs = context.obs;
        this.alertConfig = alertConfig;

        this.soundsPath = path.resolve(this.config.rootPath, "sounds");

        if(this.config.email == null) {
            this.logger.error("Email configuration missing.");
            return;
        }
        let email: IEmailAccess = this.config.email;
        
        let that = this;

        let config = {
            imap: {
                user:     email.login,
                password: email.password,
                host:     email.host,
                port:     email.port,
                tls:      email.tls,
                authTimeout: 3000
            },
            onmail: function(numNewMail: number){
                that.newMail(true);
            }
        };

        function connectionCallback(err: any): void {
            that.logger.error(err);
        }

        IMAP.connect(config).then(function(connection: IMAP.ImapSimple): Promise<void|IMAP.ImapSimple>{
            that.logger.info("Connected to IMAP");

            that.connection = connection;

            return that.newMail(false);
        }, connectionCallback);
        
    }

    public setup(sendResponse: MP.ResponseCallback): void {
        this.sendResponse = sendResponse;
    }

    /** just check whether an alert was triggered manually */
    public act(msg: MP.Message): void {
        if (msg.from.toLowerCase() == this.config.nickname.toLowerCase()) {
            let parts = msg.text.split(" ");
            if (parts.length >= 2 && parts[0].toLowerCase() == "!alert" && parts[1].toLowerCase() == "follower") {
                this.performNewFollowerActions(parts[2]);
            }
        }
    }

    private performNewFollowerActions(newFollower: string) {
        
        let newFollowerAlert = new PendingAlert(newFollower, ()=>{
            this.updateUserDatabase(newFollower);
            this.setObsNewFollowerText(newFollower);
            this.appendToViewerActionsHistory(newFollower, null);
            this.obs.toggleSource(this.alertConfig.parameter, this.alertConfig.durationInSeconds);
            this.sendFollowerThanksToChat(newFollower);
        });

        this.pendingAlerts.push( newFollowerAlert );

        if(this.timer == null){
            this.timer = setInterval(()=>{
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

    private updateUserDatabase(newFollower: string) {
        this.db.users.update({ name: newFollower }, { $set: { followDate: new Date() } }, { upsert: true });
    }
    
    private setObsNewFollowerText(newFollower: string) {
        let text = this.alertConfig.sceneTextPattern.replace(AlertConst.ViewerPlaceholder, newFollower);
        this.obs.setText(this.alertConfig.sceneTextSource, text);
    }

    private newMail(emitAlert: boolean): Promise<void|IMAP.ImapSimple>{
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

    private sendFollowerThanksToChat( newFollower: string ) {
        if(this.sendResponse != null) {
            let text = this.alertConfig.chatPattern.replace(AlertConst.ViewerPlaceholder, newFollower);
            let m = new MP.Message({ channel: this.config.channel, text: text });
            let response = { message: m };
            this.sendResponse(null, response);
        }
    }

    private playFollowerSoundAlert() {
        let alertWav = path.resolve(this.soundsPath, "bell.wav");

        let args: string[] = [];
        this.config.mediaPlayerArgs.forEach(element => {
            args.push( element.replace("{0}", `${alertWav}`) );    
        });
        
        let that = this;
        execFile(this.config.mediaPlayer, args, function(err, data) {
            that.logger.error(`${err}: ${data.toString()}`);
        });
    }

    /** Writes a name to a text file
     * @param viewerName The name of the stream viewer
     * @param action Pass an action to be displayed next to the viewer name or null to leave it out 
     */
    private appendToViewerActionsHistory( viewerName: string, action: string | null ) : void {
        const separator = "  ";
        const endSeparator = "---";

        this.db.users.find({}, {name: 1})
            .sort({ followDate: -1 })
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