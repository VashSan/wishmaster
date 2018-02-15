import * as MP from "./src/MessageProcessor";
import * as IRC from "irc";
import { Loopback } from "./src/Features/Loopback";
import { Configuration } from "./src/Configuration";

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

        let proc = new MP.MessageProcessor(client);
        
        let plg = new Loopback("");
        proc.registerPlugin(plg);

        let plg2 = new Loopback("test");
        proc.registerPlugin(plg2);

        client.addListener("raw", message => {
            console.log("raw: ", message);
        });

        client.addListener("error", message => {
            console.log("error: ", message);
        });

        client.addListener("message", (from, to, message) => {
            let m = new MP.Message({from: from, channel: to, text: message});
            proc.process(m);
        });

        client.connect(() => {
            
            client.join(config.channel);

            var helloMessage = [
                "Master", "Apprentice", "Heartborne", 
                "7th Seeker", "Warrior", "Disciple", "Wishmaster"];
            var hi = (Math.random() * 7 | 0);

            client.say(config.channel, helloMessage[hi]);

        });

        return 0;
    }
}

Startup.main();