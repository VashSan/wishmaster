import Startup from "./Startup";
import { IFileSystem, IConfiguration, IContext, IEmailAccess } from "./shared";
import { mock } from "jest-mock-extended";
import { ILogger } from "psst-log";

test('construction', ()=>{
    //let configDir = path.join(process.env.localappdata || os.homedir(), '.wishmastertest');
    let fs = mock<IFileSystem>();
    fs.exists.mockReturnValue(true);
    fs.readAll.mockReturnValueOnce("{}");
    
    let config = mock<IConfiguration>();

    let logger = mock<ILogger>();

    let context = mock<IContext>();
    context.getConfiguration.mockReturnValue(config);

    let email = mock<IEmailAccess>();

    expect(()=>new Startup(context, config, logger, email)).not.toThrow();
});