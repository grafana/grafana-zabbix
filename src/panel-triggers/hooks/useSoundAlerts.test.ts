import { renderHook } from '@testing-library/react';
import { ProblemDTO } from 'datasource/types';
import { ProblemsPanelOptions } from '../types';
import { useSoundAlerts } from './useSoundAlerts';

const mockOscillator = {
  connect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  frequency: { value: 0, setValueAtTime: jest.fn() },
  type: '',
  onended: null as null | (() => void),
};

const mockGainNode = {
  connect: jest.fn(),
  gain: { value: 0 },
};

const mockAudioContext = {
  createGain: jest.fn(() => mockGainNode),
  createOscillator: jest.fn(() => mockOscillator),
  destination: {},
  currentTime: 0,
  close: jest.fn(),
};

const audioInstances: MockAudio[] = [];

class MockAudio {
  url: string;
  volume = 1;
  play = jest.fn().mockResolvedValue(undefined);
  pause = jest.fn();

  constructor(url: string) {
    this.url = url;
    audioInstances.push(this);
  }
}

function makeProblem(problem: Partial<ProblemDTO>): ProblemDTO {
  return {
    eventid: '100',
    severity: '4',
    timestamp: Math.floor(Date.now() / 1000),
    ...problem,
  };
}

function makeOptions(options: Partial<ProblemsPanelOptions>): ProblemsPanelOptions {
  return {
    soundAlerts: true,
    soundMinSeverity: 4,
    soundTone: 'beep',
    soundVolume: 80,
    soundRepeat: false,
    highlightNewerThan: '1h',
    ...options,
  } as ProblemsPanelOptions;
}

describe('useSoundAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    audioInstances.length = 0;
    (window as any).AudioContext = jest.fn(() => mockAudioContext);
    (window as any).Audio = MockAudio;
  });

  it('plays a tone when a new problem at or above the severity threshold appears', () => {
    const { rerender } = renderHook(({ problems, options }) => useSoundAlerts(problems, options), {
      initialProps: { problems: [] as ProblemDTO[], options: makeOptions({}) },
    });
    expect(mockOscillator.start).not.toHaveBeenCalled();

    rerender({ problems: [makeProblem({ eventid: '1', severity: '5' })], options: makeOptions({}) });
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);
  });

  it('does not play when sound alerts are disabled', () => {
    renderHook(() => useSoundAlerts([makeProblem({})], makeOptions({ soundAlerts: false })));
    expect(mockOscillator.start).not.toHaveBeenCalled();
  });

  it('does not play for problems below the severity threshold', () => {
    renderHook(() => useSoundAlerts([makeProblem({ severity: '2' })], makeOptions({ soundMinSeverity: 4 })));
    expect(mockOscillator.start).not.toHaveBeenCalled();
  });

  it('does not play again for problems it has already seen', () => {
    const problem = makeProblem({});
    const { rerender } = renderHook(({ problems, options }) => useSoundAlerts(problems, options), {
      initialProps: { problems: [problem], options: makeOptions({}) },
    });
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);

    rerender({ problems: [problem], options: makeOptions({}) });
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);
  });

  it('does not play for problems older than the highlightNewerThan window', () => {
    const oldProblem = makeProblem({ timestamp: Math.floor(Date.now() / 1000) - 7200 });
    renderHook(() => useSoundAlerts([oldProblem], makeOptions({ highlightNewerThan: '1h' })));
    expect(mockOscillator.start).not.toHaveBeenCalled();
  });

  it('plays a custom URL with the configured volume', () => {
    renderHook(() =>
      useSoundAlerts(
        [makeProblem({})],
        makeOptions({ soundTone: 'custom', soundCustomUrl: 'https://example.com/alert.mp3', soundVolume: 50 })
      )
    );
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].url).toBe('https://example.com/alert.mp3');
    expect(audioInstances[0].volume).toBe(0.5);
    expect(audioInstances[0].play).toHaveBeenCalled();
  });

  it('pauses playing custom audio when sound alerts are turned off', () => {
    const options = makeOptions({ soundTone: 'custom', soundCustomUrl: 'https://example.com/alert.mp3' });
    const { rerender } = renderHook(({ problems, options }) => useSoundAlerts(problems, options), {
      initialProps: { problems: [makeProblem({})], options },
    });
    expect(audioInstances).toHaveLength(1);

    rerender({ problems: [makeProblem({})], options: makeOptions({ ...options, soundAlerts: false }) });
    expect(audioInstances[0].pause).toHaveBeenCalled();
  });

  it('pauses playing custom audio on unmount', () => {
    const options = makeOptions({ soundTone: 'custom', soundCustomUrl: 'https://example.com/alert.mp3' });
    const { unmount } = renderHook(() => useSoundAlerts([makeProblem({})], options));
    expect(audioInstances).toHaveLength(1);

    unmount();
    expect(audioInstances[0].pause).toHaveBeenCalled();
  });

  it('repeats the sound on refresh while problems persist when soundRepeat is set', () => {
    const problem = makeProblem({});
    const options = makeOptions({ soundRepeat: true });
    const { rerender } = renderHook(({ problems, options }) => useSoundAlerts(problems, options), {
      initialProps: { problems: [problem], options },
    });
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);

    rerender({ problems: [problem], options });
    expect(mockOscillator.start).toHaveBeenCalledTimes(2);
  });
});
