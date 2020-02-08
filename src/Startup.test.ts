import Startup from "./Startup";
import { IFileSystem, IConfiguration, IContext, IEmailAccess, IEmail, IDatabase } from "./shared";
import { mock, MockProxy } from "jest-mock-extended";
import { ILogger } from "psst-log";
import { IMessageProcessor } from "./MessageProcessor";

let fs: MockProxy<IFileSystem> & IFileSystem;
let config: MockProxy<IConfiguration> & IConfiguration;
let logger: MockProxy<ILogger> & ILogger;
let context: MockProxy<IContext> & IContext;
let email: MockProxy<IEmailAccess> & IEmailAccess;
let database: MockProxy<IDatabase> & IDatabase;
let msgProcessor: MockProxy<IMessageProcessor> & IMessageProcessor;

beforeEach(() => {
    msgProcessor = mock<IMessageProcessor>();

    database = mock<IDatabase>();
    database.waitAllLoaded.mockResolvedValue(undefined);

    fs = mock<IFileSystem>();
    fs.exists.mockReturnValue(true);
    fs.readAll.mockReturnValueOnce("{}");

    config = mock<IConfiguration>();
    logger = mock<ILogger>();
    email = mock<IEmailAccess>();

    context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);
    context.getDatabase.mockReturnValue(database);
    context.getEmail.mockReturnValue(email);
    //context.getObs.mockReturnValue(obs);
});

test('construction', () => {
    // Arrange

    // Act & Assert
    expect(() => new Startup(context, config, logger, msgProcessor)).not.toThrow();
});

test('construction', (done) => {
    // Arrange
    const startup = new Startup(context, config, logger, msgProcessor);

    // Act
    startup.main();

    // Assert
    setTimeout(() => {
        expect(database.createCollection).toBeCalledTimes(2);
        expect(msgProcessor.connect).toBeCalledTimes(1);
        done();
    }, 100);
});