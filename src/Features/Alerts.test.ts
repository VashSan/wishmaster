import * as os from "os";
import * as path from "path";

import { Context, IAlert, Configuration, Database, ObsController, IFileSystem } from "../shared";
import { mock } from "jest-mock-extended";
import Alerts from "./Alerts";
import { ILogger } from "psst-log";

test('construction', () => {
    let configDir = path.join(process.env.localappdata || os.homedir(), '.wishmaster');
    let fs = mock<IFileSystem>();
    fs.exists.mockReturnValue(true);
    fs.readAll.mockReturnValueOnce("{}");

    let config = new Configuration(configDir, fs);
    config.rootPath = "";
    config.email = null;
    config.alerts = [mock<IAlert>()];
    let logger = mock<ILogger>();
    let context = new Context(config, logger, mock<Database>(), mock<ObsController>());

    expect(() => new Alerts(context, logger)).not.toThrow();
    expect(logger.error).toBeCalledTimes(1);
});