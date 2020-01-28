import * as os from "os";
import * as path from "path";

import Startup from "./Startup";
import { Configuration, IFileSystem } from "./shared";
import { mock } from "jest-mock-extended";

test('construction', ()=>{
    let configDir = path.join(process.env.localappdata || os.homedir(), '.wishmastertest');
    let fs = mock<IFileSystem>();
    fs.exists.mockReturnValue(true);
    fs.readAll.mockReturnValueOnce("{}");
    
    let configuration = new Configuration(configDir, fs);
    expect(()=>new Startup(configuration)).not.toThrow();
});