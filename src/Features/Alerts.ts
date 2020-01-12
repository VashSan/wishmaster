import * as IMAP from "imap-simple";
import * as path from "path"
import * as fs  from "fs";
import { execFile } from "child_process"
import { ILogger } from "psst-log";
import { isNullOrUndefined } from "util";


import * as MP from "../MessageProcessor";
import { Configuration, Context, IEmailAccess, ObsController, IAlert } from "../shared";

class AlertConst {
    /** Placeholder in config pattern entries */
    public static readonly ViewerPlaceholder = "{Viewer}";
    /** Default encoding for file actions */
    public static readonly Encoding = "utf8";
}

/** Perform actions (alerts) on events like "New Follower", "New Sub" ... */
export class Alerts implements MP.IFeature {
    private sendResponse: MP.ResponseCallback | null = null;
    private config: Configuration;
    private logger: ILogger;
    private soundsPath: string;
    private connection: IMAP.ImapSimple | null = null;
    private obs: ObsController;
    private alertConfig: IAlert;
    private maxActions: number = 20; // TODO get from config
                                     // TODO action file horizontal or vertical
                                     // TODO action file separator for horizontal
                                     // TODO action file prefix

    public trigger: string = "alert";

    constructor(context: Context, alertConfig: IAlert) {
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
                this.performNewFollowerActions(parts[2], true);
            }
        }
    }

    private performNewFollowerActions(newFollower: string, emitAlert: boolean) {
        // TODO evaluate timeout, 
        // TODO enqueue if duration action currently playing
        // if(emitAlert) {
        //     this.playFollowerSoundAlert();
        // }
        this.setObsNewFollowerText(newFollower);
        this.appendToViewerActionsHistory(newFollower, null);
        this.obs.toggleSource(this.alertConfig.parameter, this.alertConfig.durationInSeconds);
        this.sendFollowerThanksToChat(newFollower);
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
     
                that.unreadMails(subjects, emitAlert);
            });
        });
    }

    private unreadMails(subjectList: string[], emitAlert: boolean) {
        subjectList.forEach(subject => {
            let regex = /(.*) folgt dir jetzt auf Twitch$/g; // TODO configurable regex
            let result = regex.exec(subject);
            if (result != null && result.length > 1) {    
                this.performNewFollowerActions(result[1], emitAlert);
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

    private createFileIfNotExistsSync(filePath:string){
        if (!fs.existsSync(filePath)) {
            // create file
            fs.closeSync(fs.openSync(filePath, 'w'));
        }
    }

    private getFilePathInConfigDir(fileName: string){
        let configPath = this.config.getConfigDir();
        return path.resolve(configPath, fileName);
    }

    /** Writes a name to a text file
     * @param viewerName The name of the stream viewer
     * @param action Pass an action to be displayed next to the viewer name or null to leave it out 
     */
    private appendToViewerActionsHistory( viewerName: string, action: string | null ) : void {
       
        let actionFile = this.getFilePathInConfigDir("viewerActions.txt");
        this.createFileIfNotExistsSync(actionFile);

        const separator = "  ";
        const endSeparator = "---";
        let that = this;
        fs.readFile(actionFile, AlertConst.Encoding, function read(err, data) {
            if (err) {
                that.logger.error("error reading file " + actionFile);
                return;
            }

            let list = data.split(separator);
            if (list.length == 0) {
                list.push( endSeparator ); // empty entry to avoid connecting end & start
            }

            that.removeLastExpectedListEntry("", list);
            that.removeLastExpectedListEntry(endSeparator, list);
            
            if (isNullOrUndefined(action)) {
                list.push(viewerName);
            } else {
                list.push(`${viewerName} (${action})`);
            }
            
            list.push(endSeparator);
            list.push("");
            
            while (list.length > that.maxActions + 2) {
                list.shift();
            }

            let newData = list.join(separator) + separator; // add separator at end
            fs.writeFile(actionFile, newData, AlertConst.Encoding, err => {
                if (err != null) {
                    that.logger.error(`Error writing to file '${actionFile}'. ${err}`);
                }
            });
        });
    }

    private removeLastExpectedListEntry(expectedEntry: string, list: string[]): string[] {
        if (list[list.length - 1] == expectedEntry){
            list.pop();
        }
        return list;
    }
}

export default Alerts;