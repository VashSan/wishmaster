
import { mock } from "jest-mock-extended";
import { IContext, IDatabase, IUserCollection, ILogCollection } from "../../shared";
import Harvest from "../Harvest";


test('construction with no init', () => {

    let userDb = mock<IUserCollection>();
    let logDb = mock<ILogCollection>();

    let db = mock<IDatabase>();
    db.get.calledWith("user").mockReturnValue(userDb);
    db.get.calledWith("log").mockReturnValue(logDb);

    let context = mock<IContext>();
    context.getDatabase.mockReturnValue(db);
    
    expect( () => new Harvest(context)).not.toThrow();
});