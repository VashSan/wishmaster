import * as MP from "./src/MessageProcessor";
import { Loopback } from "./src/Plugins/Loopback";
import * as IRC from "irc";
import { Configuration } from "./src/Configuration";

//import * as Collections from "typescript-collections";

class Startup {
    public static main(): number {

        let config = new Configuration();

        let client = new IRC.Client(
            config.server,
            config.nickname,
            {
                autoConnect: false,
                password: config.password
            }
        );


        client.addListener("raw", message => {
            console.log("raw: ", message);
        });

        client.addListener("error", message => {
            console.log("error: ", message);
        });

        client.addListener("message", (from, to, message) => {
            console.log(from + " => " + to + ": " + message);
        });

        client.connect(() => {

            client.join(config.channel);

            client.say(config.channel, "I'm a bot!");

        });

        let proc = new MP.MessageProcessor();
        let plg: MP.IPlugin = new Loopback(null);

        proc.registerPlugin(plg);

        let m1: MP.Message = new MP.Message({ channel: "1", from: "a", text: "asd1" });
        let m2: MP.Message = new MP.Message({ channel: "1", from: "a", text: "asd2" });
        let m3: MP.Message = new MP.Message({ channel: "1", from: "a", text: "asd3" });
        let m4: MP.Message = new MP.Message({ channel: "1", from: "a", text: "asd4" });
        let m5: MP.Message = new MP.Message({ channel: "1", from: "a", text: "asd5" });
        let m6: MP.Message = new MP.Message({ channel: "1", from: "a", text: "asd6" });

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