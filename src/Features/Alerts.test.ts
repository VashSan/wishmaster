import { Context, IAlert, Configuration, Database, ObsController } from "../shared";
import { mock } from "jest-mock-extended";
import Alerts from "./Alerts";
import { ILogger } from "psst-log";

test('construction', () => {
    let config = new Configuration();
    config.email = null;
    let logger = mock<ILogger>();
    let context = new Context(config, logger, mock<Database>(), mock<ObsController>());
    let alertConfig = mock<IAlert>();

    expect(() => new Alerts(context, alertConfig)).not.toThrow();
    expect(logger.error).toBeCalledTimes(1);
});