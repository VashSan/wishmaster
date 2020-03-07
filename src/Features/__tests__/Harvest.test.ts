
import { mock, MockProxy } from "jest-mock-extended";
import { IContext, IDatabase, IUserCollection, ILogCollection, ITagReader } from "../../shared";
import Harvest from "../Harvest";
import { ILogger } from "psst-log";

let logger: MockProxy<ILogger> & ILogger;
let db: MockProxy<IDatabase> & IDatabase;
let userDb: MockProxy<IUserCollection> & IUserCollection;
let logDb: MockProxy<ILogCollection> & ILogCollection;

beforeEach(() => {
    logger = mock<ILogger>();
    userDb = mock<IUserCollection>();
    logDb = mock<ILogCollection>();

    db = mock<IDatabase>();
    db.get.calledWith("user").mockReturnValue(userDb);
    db.get.calledWith("log").mockReturnValue(logDb);
});

test('construction with no init', () => {
    // Arrange
    const context = mock<IContext>();
    context.getDatabase.mockReturnValue(db);

    // Act & Assert
    expect(() => new Harvest(context, logger)).not.toThrow();
});

test('log chat', () => {
    // Arrange
    const context = mock<IContext>();
    context.getDatabase.mockReturnValue(db);

    const harvest = new Harvest(context, logger);

    // Act
    const tags = mock<ITagReader>();
    harvest.act({ channel: "#mychan", text: "text", from: "alice", tags: tags });

    // Assert
    expect(userDb.newMessage).toBeCalledTimes(1);
});