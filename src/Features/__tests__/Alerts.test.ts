import { IAlert, IConfiguration, IContext, IUserCollection, IDatabase, IObsController, ViewerAction, IEmail, IEmailAccess, IMediaPlayer } from "../../shared";
import { mock, MockProxy } from "jest-mock-extended";
import Alerts from "../Alerts";
import { ILogger } from "psst-log";

const bob = "bob";
const twitch = "jtv";
let userDb: MockProxy<IUserCollection> & IUserCollection;
let obs: MockProxy<IObsController> & IObsController;
let mediaPlayer: MockProxy<IMediaPlayer> & IMediaPlayer;

function getDatabaseMock(): MockProxy<IDatabase> & IDatabase {
    let db = mock<IDatabase>();
    db.get.calledWith("user").mockReturnValue(userDb);
    return db;
}

function getContextMock(): MockProxy<IContext> & IContext {
    mediaPlayer = mock<IMediaPlayer>();
    
    let alert = mock<IAlert>();
    alert.sceneTextPattern = "Thanks {0}";
    alert.bannerTextPattern = "Hey {0}";
    alert.chatPattern = "Jay {0}";

    let config = mock<IConfiguration>();
    config.getRootPath.mockReturnValue("");
    config.getEmail.mockReturnValue(null);
    config.getAlerts.mockReturnValue([alert]);
    config.getNickname.mockReturnValue(bob);

    let context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);

    let db = getDatabaseMock();
    context.getDatabase.mockReturnValue(db);

    let email = mock<IEmailAccess>();
    context.getEmail.mockReturnValue(email);
    context.getMediaPlayer.mockReturnValue(mediaPlayer);
    context.getObs.mockReturnValue(obs);

    return context;
}

beforeEach(() => {
    obs = mock<IObsController>();
    userDb = mock<IUserCollection>();
});

test('construction', () => {
    let logger = mock<ILogger>();

    let context = getContextMock();

    expect(context.getDatabase().get("user")).toBe(userDb);

    expect(() => new Alerts(context, logger)).not.toThrow();
});

test('handle alert command', (done) => {
    // Arrange
    let logger = mock<ILogger>();
    let context = getContextMock();

    userDb.findLastActions.mockResolvedValue([{ name: bob, lastAction: ViewerAction.Follow, lastActionDate: new Date() }]);

    // Act
    let alerts = new Alerts(context, logger);
    alerts.setup(() => setTimeout(() => {
        // Assert
        expect(userDb.newFollowFrom).toBeCalledTimes(1);
        expect(obs.setText).toBeCalledTimes(2); // 1. banner 2. alert
        done();
    }, 300));

    alerts.act({ channel: "#mine", from: bob, text: "!alert follower alice" });

});

test('host', (done) => {
    // Arrange
    let logger = mock<ILogger>();
    let context = getContextMock();

    userDb.findLastActions.mockResolvedValue([{ name: bob, lastAction: ViewerAction.Follow, lastActionDate: new Date() }]);

    // Act
    let alerts = new Alerts(context, logger);
    
    alerts.setup(() => setTimeout(() => {
        // Assert
        expect(userDb.newHostFrom).toBeCalledTimes(1);
        expect(mediaPlayer.play).toBeCalledTimes(1);
        expect(obs.setText).toBeCalledTimes(1);
        done();
    }, 100));

    alerts.act({ channel: "#bob", from: twitch, text: "alice is now hosting you." });
});
