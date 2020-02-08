import Bets from "./Bets";
import { IConfiguration, IContext } from "../shared";
import { mock, MockProxy } from "jest-mock-extended";
import { ILogger } from "psst-log";
import { ResponseCallback, IFeatureResponse } from "../shared/MessageProcessor";

describe('Bets', () => {
    const testChannel = "#test";
    const alice = "alice"; // is our login
    const bob = "bob";

    let logger: MockProxy<ILogger> & ILogger;
    let context: MockProxy<IContext> & IContext;
    let configuration: MockProxy<IConfiguration> & IConfiguration;

    let responseError: string | null;
    let response: IFeatureResponse | null;
    let responseCallback: ResponseCallback = (error, r) => {
        responseError = error;
        response = r;
    };

    function createBets() {
        const bets = new Bets(context, logger);
        bets.setup(responseCallback)
        return bets;
    }

    beforeEach(() => {
        response = null;
        responseError = null;

        logger = mock<ILogger>();

        configuration = mock<IConfiguration>();
        configuration.getNickname.mockReturnValue(alice);

        context = mock<IContext>();
        context.getConfiguration.mockReturnValue(configuration);
    });

    test('construction', () => {
        expect(() => createBets()).not.toThrow();
    });

    test('trigger', () => {
        let bets = createBets();

        expect(bets.getTrigger()).toBe("bet");
    });

    test('invalid bet', () => {
        let bets = createBets();

        const stupid = { channel: testChannel, from: bob, text: "!bet hi" };
        bets.act(stupid);

        expect(responseError).toBe(null);
        expect(response).toBe(null);
    });

    function executeCommand(bets:Bets, c: string, from: string) {
        const message = { channel: testChannel, from: from, text: c };
        bets.act(message);
    }

    function executeCmdAndExpectResponse(bets: Bets, command: string, from: string, expectedResponse: string) {
        executeCommand(bets, command, from);
        
        let responseText = response?.message.text;
        expect(responseText).toContain(expectedResponse);
        expect(responseError).toBe(null);
    }

    test('state machine', () => {
        let bets = createBets();

        executeCmdAndExpectResponse(bets, "!bet open", alice, "Place your bet");
        executeCmdAndExpectResponse(bets, "!bet close", alice, "closed");
        executeCmdAndExpectResponse(bets, "!bet result", alice, "Winners");
    });

    test('winners', () => {
        let bets = createBets();

        executeCmdAndExpectResponse(bets, "!bet open", alice, "Place your bet");
        executeCommand(bets, "!bet 1", bob);
        executeCmdAndExpectResponse(bets, "!bet close", alice, "closed");
        executeCmdAndExpectResponse(bets, "!bet result 1", alice, bob);
    });

    test('loosers', () => {
        let bets = createBets();

        executeCmdAndExpectResponse(bets, "!bet open", alice, "Place your bet");
        executeCommand(bets, "!bet 2", bob);
        executeCmdAndExpectResponse(bets, "!bet close", alice, "closed");
        executeCmdAndExpectResponse(bets, "!bet result 1", alice, "Winners");

        expect(response?.message.text).not.toContain(bob);
    });

});