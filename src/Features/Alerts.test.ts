import { IAlert, IConfiguration, IContext, IUserCollection, IDatabase } from "../shared";
import { mock, MockProxy } from "jest-mock-extended";
import Alerts from "./Alerts";
import { ILogger } from "psst-log";

function getDatabaseMock(): MockProxy<IDatabase> & IDatabase{
    let userDb = mock<IUserCollection>();

    let db = mock<IDatabase>();
    db.get.calledWith("user").mockReturnValue(userDb);
    return db;
}

test('construction', () => {
    let db = getDatabaseMock();

    let config = mock<IConfiguration>();
    
    config.getRootPath.mockReturnValue("");
    config.getEmail.mockReturnValue(null);
    config.getAlerts.mockReturnValue([mock<IAlert>()]);
    let logger = mock<ILogger>();

    let context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);
    context.getDatabase.mockReturnValue(db);

    expect(() => new Alerts(context, logger)).not.toThrow();
    expect(logger.error).toBeCalledTimes(1);
});
