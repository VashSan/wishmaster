import IMAP = require("imap-simple");
import { ILogger, LogManager } from "psst-log";
import { IConfiguration, IEmailConfig } from ".";

export interface IEmail {
    subject: string;
    from: string;
    textBody: string;
}

export interface IEmailTrigger {
    subjectRegex: RegExp;
    callback: (mail: IEmail) => void;
}

export interface IEmailAccess {
    connect(): void;
    onNewMail(trigger: IEmailTrigger): void;
}

export class EmailAccess implements IEmailAccess {
    private readonly mails: IEmail[] = [];
    private readonly logger: ILogger;
    private readonly emailConfig: IEmailConfig | null = null;

    private connection: IMAP.ImapSimple | null = null;

    constructor(config: IConfiguration, logger?: ILogger) {
        if (logger) {
            this.logger = logger;
        } else {
            this.logger = LogManager.getLogger();
        }

        this.emailConfig = config.getEmail();
    }

    connect(): void {
        if (this.emailConfig == null) {
            this.logger.warn("Email configuration missing.");
            return;
        }

        let that = this;

        let config = {
            imap: {
                user: this.emailConfig.login,
                password: this.emailConfig.password,
                host: this.emailConfig.host,
                port: this.emailConfig.port,
                tls: this.emailConfig.tls,
                authTimeout: 3000
            },
            onmail: function (numNewMail: number) {
                that.newMail(true);
            }
        };

        function connectionCallback(err: any): void {
            that.logger.error(err);
        }

        IMAP.connect(config)
            .then(function (connection: IMAP.ImapSimple): Promise<void | IMAP.ImapSimple> {
                that.logger.log("Connected to IMAP");

                that.connection = connection;

                return that.newMail(false);
            }, connectionCallback)
            .catch((reason) => {
                this.logger.warn("Could not connect to IMAP server", reason);
            });
    }

    private triggerList: IEmailTrigger[] = [];

    onNewMail(trigger: IEmailTrigger): void {
        this.triggerList.push(trigger);
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

                results.forEach((newMail) => {
                    let header = newMail.parts.filter(function (part) {
                        return part.which === 'HEADER';
                    })[0];

                    that.mails.push({ subject: header.body.subject, from: "", textBody: "" });
                });

                that.unreadMails();
            });
        });
    }
    private unreadMails() {
        while (this.mails.length > 0) {
            const email = this.mails.shift();
            if (email == undefined) {
                continue;
            }

            this.triggerList.forEach((trigger) => {
                const regex = trigger.subjectRegex;
                if (regex.test(email.subject)) {
                    trigger.callback(email);
                }
            });
        }
    }


}