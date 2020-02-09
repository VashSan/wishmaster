import { ISpotifyConfig } from "../../shared";
import { mock } from "jest-mock-extended";
import { SpotifyAuth } from "./SpotifyAuth";

test('construction', () => {
    let config = mock<ISpotifyConfig>();
    expect(() => new SpotifyAuth(config)).not.toThrow();
});