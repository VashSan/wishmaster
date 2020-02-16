import { Playlist } from "./Playlist";
import { mock, MockProxy } from "jest-mock-extended";
import { IApiWrapper } from "../SongRequest";

let api: MockProxy<IApiWrapper> & IApiWrapper;

beforeEach(() => {
    api = mock<IApiWrapper>();
});

test('construction', () => {
    expect(() => { new Playlist(api) }).not.toThrow();
});