import Startup from "./Startup";
import { IFileSystem, IConfiguration, IContext, IEmailAccess, IDatabase, DefeatableFeature, IObsController } from "./shared";
import { mock, MockProxy } from "jest-mock-extended";
import { ILogger } from "psst-log";
import { IMessageProcessor } from "./shared/MessageProcessor";
import { IMainFactory } from "./MainFactory";

let openStdin: jest.SpyInstance<NodeJS.Socket, []>; 

let obs: MockProxy<IObsController> & IObsController;
let fs: MockProxy<IFileSystem> & IFileSystem;
let config: MockProxy<IConfiguration> & IConfiguration;
let logger: MockProxy<ILogger> & ILogger;
let context: MockProxy<IContext> & IContext;
let email: MockProxy<IEmailAccess> & IEmailAccess;
let database: MockProxy<IDatabase> & IDatabase;
let msgProcessor: MockProxy<IMessageProcessor> & IMessageProcessor;
let factory: MockProxy<IMainFactory> & IMainFactory;

beforeEach(() => {
    config = mock<IConfiguration>();
    config.getEnabledFeatures.mockReturnValue([
        DefeatableFeature.Alerts,
        DefeatableFeature.Bets,
        DefeatableFeature.Console,
        DefeatableFeature.EmailConnection,
        DefeatableFeature.MediaPlayer,
        DefeatableFeature.ObsController,
        DefeatableFeature.SongRequest,
        DefeatableFeature.StaticAnswers,
        DefeatableFeature.Stomt,
        DefeatableFeature.UrlFilter
    ]);

    obs = mock<IObsController>();
    obs.connect.mockRejectedValue("we test without OBS");

    factory = mock<IMainFactory>();
    factory.createConfiguration.mockReturnValue(config);

    msgProcessor = mock<IMessageProcessor>();

    database = mock<IDatabase>();
    database.waitAllLoaded.mockResolvedValue(undefined);

    fs = mock<IFileSystem>();
    fs.exists.mockReturnValue(true);
    fs.readAll.mockReturnValueOnce("{}");

    logger = mock<ILogger>();
    email = mock<IEmailAccess>();

    context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);
    context.getDatabase.mockReturnValue(database);
    context.getEmail.mockReturnValue(email);
    context.getObs.mockReturnValue(obs);

    openStdin = jest.spyOn(process, 'openStdin').mockImplementation(() => mock<NodeJS.Socket>());
});

afterEach(()=>{
    openStdin.mockRestore();
});

test('construction', () => {
    // Arrange

    // Act & Assert
    expect(() => new Startup(factory, context, logger, msgProcessor)).not.toThrow();
});

test('main (disabled features)', (done) => {
    // Arrange
    const startup = new Startup(factory, context, logger, msgProcessor);

    // Act
    startup.main([]);

    // Assert
    setTimeout(() => {
        expect(database.createCollection).toBeCalledTimes(2);
        expect(msgProcessor.connect).toBeCalledTimes(1);
        done();
    }, 100);
});

test('main with enabled features', (done) => {
    // Arrange
    const obs = mock<IObsController>();
    obs.connect.mockResolvedValue();

    context.getObs.mockReturnValue(obs);

    const startup = new Startup(factory, context, logger, msgProcessor);

    // Act
    startup.main([]);

    // Assert
    setTimeout(() => {
        expect(database.createCollection).toBeCalledTimes(2);
        expect(msgProcessor.connect).toBeCalledTimes(1);
        expect(openStdin).toBeCalledTimes(1);
        done();
    }, 200);
});