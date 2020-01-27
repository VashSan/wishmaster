
import { mock } from "jest-mock-extended";
import { Context, Configuration, Database, ObsController } from "../shared";
import { SongRequest } from "./SongRequest";
import { ILogger } from "psst-log";


test('construction with no init', () => {
    let configuration = new Configuration();
    configuration.songRequest = null;
    
    let context = new Context(configuration, mock<ILogger>(), mock<Database>(), mock<ObsController>());
    expect(() => new SongRequest(context)).not.toThrow();
});