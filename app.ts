import * as mp from "./src/MessageProcessor";
import {Loopback} from "./src/Plugins/Loopback";

//import * as Collections from "typescript-collections";

class Startup {
    public static main(): number {
        
        let proc = new mp.MessageProcessor();
        let plg : mp.IPlugin = new Loopback(null);

        proc.registerPlugin( plg );

        let m1 : mp.Message = new mp.Message({ channel: "1", from: "a", text: "asd1" });
        let m2 : mp.Message = new mp.Message({ channel: "1", from: "a", text: "asd2" });
        let m3 : mp.Message = new mp.Message({ channel: "1", from: "a", text: "asd3" });
        let m4 : mp.Message = new mp.Message({ channel: "1", from: "a", text: "asd4" });
        let m5 : mp.Message = new mp.Message({ channel: "1", from: "a", text: "asd5" });
        let m6 : mp.Message = new mp.Message({ channel: "1", from: "a", text: "asd6" });

        console.log(m1.toString());

        proc.add(m1);
        proc.add(m2);
        proc.add(m3);
        proc.add(m4);
        proc.add(m5);
        proc.add(m6);

        return 0;
    }
}

Startup.main();