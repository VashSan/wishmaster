import { execFile } from "child_process"
import * as IMAP from "imap-simple";
import * as MP from "../MessageProcessor";
import { Context } from "../../app";
import { Configuration } from "../Configuration";
import { ILogger } from "psst-log";
import { IEmailAccess } from "../Interfaces";
import path = require("path");

/** Perform actions (alerts) on events like "New Follower", "New Sub" ... */
export class Alerts implements MP.IFeature {
    public trigger: string = "alert";
    private sendResponse: MP.ResponseCallback | null = null;
    private config: Configuration;
    private logger: ILogger;
    private soundsPath: string;
    private connection: IMAP.ImapSimple | null = null;


    constructor(context: Context) {
        this.config = context.config;
        this.logger = context.logger;    

        this.soundsPath = path.resolve(this.config.rootPath, "sounds");

        if(this.config.email == null) {
            this.logger.error("Email configuratio is null");
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
            
                this.playFollowerAlert(parts[2]);
            }
            
        }
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
     
                if (emitAlert){
                    that.newAlerts(subjects);
                }

            });
        });
    }

    private newAlerts(subjectList:string[]) {
        
        subjectList.forEach(subject => {
            let regex = /(.*) folgt dir jetzt auf Twitch$/g;
            let result = regex.exec(subject);
            if (result != null && result.length > 1) {                
                this.playFollowerAlert(result[1]);
            }
        });
    }

    private playFollowerAlert( newFollower: string ) {
        if(this.sendResponse != null) {
            let m = new MP.Message({ channel: this.config.channel, text: "Vielen Dank für Deinen Follow " + newFollower });
            let response = { message: m };
            this.sendResponse(null, response);

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
    }

}

export default Alerts;