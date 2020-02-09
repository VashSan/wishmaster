import { EmailAccess, IEmail } from "../Email";
import { mock, MockProxy } from "jest-mock-extended";
import { IConfiguration } from "..";
import { ILogger } from "psst-log";

jest.mock("imap-simple");
import IMAP = require("imap-simple");
import { IEmailConfig } from "../Configuration";
import { mocked } from "ts-jest/utils";
import { Message } from "../ChatClient";

let config: MockProxy<IConfiguration> & IConfiguration;
let emailConfig: MockProxy<IEmailConfig> & IEmailConfig;
let logger: MockProxy<ILogger> & ILogger;
let imap = mocked(IMAP, true);

beforeEach(() => {
    emailConfig = mock<IEmailConfig>();
    logger = mock<ILogger>();

    config = mock<IConfiguration>();
    config.getEmail.mockReturnValue(emailConfig);

    imap.connect.mockResolvedValue(mock<IMAP.ImapSimple>());
});

test('connect wihtout config', () => {
    // Arrange
    config.getEmail.mockReturnValue(null);

    // Act
    let email = new EmailAccess(config, logger);

    expect(logger.warn).toBeCalledTimes(0);
    email.connect();

    // Assert
    expect(logger.warn).toBeCalledTimes(1);
    expect(IMAP.connect).toBeCalledTimes(0);
});

test('connect', () => {
    // Arrange
    let email = new EmailAccess(config, logger);
    expect(logger.warn).toBeCalledTimes(0);

    // Act  
    email.connect();

    // Assert
    expect(logger.warn).toBeCalledTimes(0);
    expect(IMAP.connect).toBeCalledTimes(1);
});

test('incoming mail', (done) => {
    // Arrange
    let connection = mock<IMAP.ImapSimple>();
    let imapOnMail: ((numNewMail: number) => void) | undefined;
    imap.connect.mockImplementation((c: IMAP.ImapSimpleOptions) => {
        imapOnMail = c.onmail;
        return new Promise<IMAP.ImapSimple>((resolve, reject) => {
            resolve(connection);
        });
    });

    connection.openBox.mockResolvedValue("opened");
    const message = mock<IMAP.Message>();
    message.parts = [
        { which: "HEADER", body: { subject: "x" }, size: 1 }];
    connection.search.mockResolvedValue([message]);

    let email = new EmailAccess(config, logger);
    email.connect();

    email.onNewMail({
        subjectRegex: new RegExp("x"),
        callback: (mail: IEmail) => {

            // Assert
            expect(mail.subject).toBe("x");
            done();
        }
    });

    // Act  
    if (imapOnMail != undefined) {
        imapOnMail(1);
    } else {
        throw new Error("Missing imapOnMail callback");
    }
});