
import { mocked } from 'ts-jest/utils'
import { MediaPlayer } from "./";

import { execFile } from "child_process";
jest.mock('child_process');

const mplayer = "m.exe";
const mplayerArgs = ['{0}'];

//const mockExecFile = <jest.Mock<typeof execFile>> execFile;
const execFileMock = mocked(execFile, true);

test('construction', () => {
    expect(() => new MediaPlayer(mplayer, mplayerArgs)).not.toThrow();
});

test('playAudio invokes exe', () => {
    const mp =  new MediaPlayer(mplayer, mplayerArgs);
    mp.playAudio("file");
    expect(execFileMock).toBeCalledTimes(1);
    expect(execFileMock).toBeCalledWith(expect.any(String), ["file"]);
});