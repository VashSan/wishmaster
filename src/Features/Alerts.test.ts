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
    let logger = mock<ILogger>();
    let context = new Context(config, logger, mock<Database>(), mock<ObsController>());
    let alertConfig = mock<IAlert>();

    expect(() => new Alerts(context, alertConfig)).not.toThrow();
    expect(logger.error).toBeCalledTimes(1);
});