import { ISpotifyConfig, IFileSystem } from "../../shared";
import { mock } from "jest-mock-extended";
import { SpotifyAuth } from "./SpotifyAuth";

test('construction', () => {
    let config = mock<ISpotifyConfig>();
    let fs = mock<IFileSystem>();
    expect(() => new SpotifyAuth(config, "", fs)).not.toThrow();
});