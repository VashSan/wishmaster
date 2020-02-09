
import { mocked } from 'ts-jest/utils'
import { MediaPlayer, IConfiguration, Sound } from "..";

import { execFile } from "child_process";
import { mock, MockProxy } from 'jest-mock-extended';
import * as os from 'os';
jest.mock('child_process');

const execFileMock = mocked(execFile, true);
let config: MockProxy<IConfiguration> & IConfiguration;

beforeEach(() => {
    execFileMock.mockReset();

    config = mock<IConfiguration>();
    config.getMediaPlayer.mockReturnValue("m.exe");
    config.getMediaPlayerArgs.mockReturnValue(['{0}']);
    config.getRootPath.mockReturnValue(os.homedir());
});

test('construction', () => {
    expect(() => new MediaPlayer(config)).not.toThrow();
});

test('playAudio', () => {
    const mp = new MediaPlayer(config);
    mp.playAudio("file");
    expect(execFileMock).toBeCalledTimes(1);
    expect(execFileMock).toBeCalledWith(expect.any(String), ["file"]);
});

test('play', () => {
    const mp = new MediaPlayer(config);
    mp.play(Sound.Bell);
    expect(execFileMock).toBeCalledTimes(1);
});