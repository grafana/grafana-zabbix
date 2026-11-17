import { renderHook, RenderHookResult } from '@testing-library/react';
import { ProblemDTO } from 'datasource/types';
import { ProblemsPanelOptions } from '../types';
import { resetSharedAudioContext, useSoundAlerts } from './useSoundAlerts';

const mockOscillator = {
  connect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  disconnect: jest.fn(),
  frequency: { value: 0, setValueAtTime: jest.fn() },
  type: '',
  onended: null as null | (() => void),
};

const mockGainNode = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  gain: { value: 0 },
};

const mockAudioContext = {
  state: 'running' as AudioContextState,
  resume: jest.fn().mockResolvedValue(undefined),
  createGain: jest.fn(() => mockGainNode),
  createOscillator: jest.fn(() => mockOscillator),
  destination: {},
  currentTime: 0,
  close: jest.fn(),
};

const audioContextConstructor = jest.fn(() => mockAudioContext);

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
    value: '1',
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

type HookProps = { problems: ProblemDTO[]; options: ProblemsPanelOptions; ready?: boolean };

function renderSoundAlerts(initialProps: HookProps): RenderHookResult<void, HookProps> {
  return renderHook(({ problems, options, ready }) => useSoundAlerts(problems, options, ready), { initialProps });
}

// Renders the hook with `problems` present and the seeding run already done,
// so the next rerender exercises the "new problems arrived" path.
function renderSeeded(problems: ProblemDTO[], options: ProblemsPanelOptions): RenderHookResult<void, HookProps> {
  const view = renderSoundAlerts({ problems, options });
  expect(mockOscillator.start).not.toHaveBeenCalled();
  return view;
}

describe('useSoundAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSharedAudioContext();
    mockAudioContext.state = 'running';
    audioInstances.length = 0;
    (window as any).AudioContext = audioContextConstructor;
    (window as any).Audio = MockAudio;
  });

  it('seeds silently on the first run instead of playing for the problems already listed', () => {
    const { rerender } = renderSeeded([makeProblem({ eventid: '1' })], makeOptions({}));

    // The same problem again stays silent; it was seeded, not new.
    rerender({ problems: [makeProblem({ eventid: '1' })], options: makeOptions({}) });
    expect(mockOscillator.start).not.toHaveBeenCalled();
  });

  it('plays a tone when a new problem at or above the severity threshold appears', () => {
    const { rerender } = renderSeeded([makeProblem({ eventid: '1' })], makeOptions({}));

    rerender({ problems: [makeProblem({ eventid: '1' }), makeProblem({ eventid: '2' })], options: makeOptions({}) });
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);
  });

  it('does not play when sound alerts are disabled', () => {
    const { rerender } = renderSoundAlerts({ problems: [], options: makeOptions({ soundAlerts: false }) });
    rerender({ problems: [makeProblem({})], options: makeOptions({ soundAlerts: false }) });
    expect(mockOscillator.start).not.toHaveBeenCalled();
  });

  it('reseeds silently when the feature is re-enabled', () => {
    const { rerender } = renderSeeded([makeProblem({ eventid: '1' })], makeOptions({}));

    rerender({ problems: [makeProblem({ eventid: '1' })], options: makeOptions({ soundAlerts: false }) });
    // Re-enable with an extra problem on board: seeded, not played.
    const reEnabled = [makeProblem({ eventid: '1' }), makeProblem({ eventid: '2' })];
    rerender({ problems: reEnabled, options: makeOptions({}) });
    expect(mockOscillator.start).not.toHaveBeenCalled();

    // A problem arriving after the reseed does play.
    rerender({ problems: [...reEnabled, makeProblem({ eventid: '3' })], options: makeOptions({}) });
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);
  });

  it('does not play for problems below the severity threshold', () => {
    const { rerender } = renderSeeded([], makeOptions({ soundMinSeverity: 4 }));
    rerender({ problems: [makeProblem({ severity: '2' })], options: makeOptions({ soundMinSeverity: 4 }) });
    expect(mockOscillator.start).not.toHaveBeenCalled();
  });

  it('does not play for resolved problems', () => {
    const { rerender } = renderSeeded([], makeOptions({}));
    rerender({ problems: [makeProblem({ eventid: '2', value: '0' })], options: makeOptions({}) });
    expect(mockOscillator.start).not.toHaveBeenCalled();
  });

  it('does not keep repeating for problems that have been resolved', () => {
    const options = makeOptions({ soundRepeat: true });
    const { rerender } = renderSeeded([makeProblem({ eventid: '1' })], options);

    rerender({ problems: [makeProblem({ eventid: '1' })], options });
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);

    rerender({ problems: [makeProblem({ eventid: '1', value: '0' })], options });
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);
  });

  it('does not play for problems older than the highlightNewerThan window', () => {
    const options = makeOptions({ highlightNewerThan: '1h' });
    const { rerender } = renderSeeded([], options);
    rerender({ problems: [makeProblem({ timestamp: Math.floor(Date.now() / 1000) - 7200 })], options });
    expect(mockOscillator.start).not.toHaveBeenCalled();
  });

  it('ignores refreshes that are not ready without forgetting or learning ids', () => {
    const options = makeOptions({});
    // A loading pass before the first data must not count as the seeding run.
    const { rerender } = renderSoundAlerts({ problems: [], options, ready: false });
    rerender({ problems: [makeProblem({ eventid: '1' })], options, ready: true });
    expect(mockOscillator.start).not.toHaveBeenCalled();

    // A failed refresh (empty, not ready) must not make known problems look new.
    rerender({ problems: [], options, ready: false });
    rerender({ problems: [makeProblem({ eventid: '1' })], options, ready: true });
    expect(mockOscillator.start).not.toHaveBeenCalled();

    // But genuinely new problems afterwards still play.
    rerender({ problems: [makeProblem({ eventid: '1' }), makeProblem({ eventid: '2' })], options, ready: true });
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);
  });

  it('repeats the sound on refresh while problems persist when soundRepeat is set', () => {
    const options = makeOptions({ soundRepeat: true });
    const { rerender } = renderSeeded([makeProblem({ eventid: '1' })], options);

    rerender({ problems: [makeProblem({ eventid: '1' })], options });
    expect(mockOscillator.start).toHaveBeenCalledTimes(1);
    rerender({ problems: [makeProblem({ eventid: '1' })], options });
    expect(mockOscillator.start).toHaveBeenCalledTimes(2);
  });

  it('reuses a single shared AudioContext across playbacks', () => {
    const options = makeOptions({ soundRepeat: true });
    const { rerender } = renderSeeded([makeProblem({ eventid: '1' })], options);

    rerender({ problems: [makeProblem({ eventid: '1' })], options });
    rerender({ problems: [makeProblem({ eventid: '1' })], options });
    expect(mockOscillator.start).toHaveBeenCalledTimes(2);
    expect(audioContextConstructor).toHaveBeenCalledTimes(1);
    expect(mockAudioContext.close).not.toHaveBeenCalled();
  });

  it('skips playback and requests a resume while the context is suspended by autoplay policy', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockAudioContext.state = 'suspended';

    const { rerender } = renderSeeded([], makeOptions({}));
    rerender({ problems: [makeProblem({ eventid: '2' })], options: makeOptions({}) });

    expect(mockOscillator.start).not.toHaveBeenCalled();
    expect(mockAudioContext.resume).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('blocked until you interact'));
    warn.mockRestore();
  });

  it('plays a custom URL with the configured volume', () => {
    const options = makeOptions({
      soundTone: 'custom',
      soundCustomUrl: 'https://example.com/alert.mp3',
      soundVolume: 50,
    });
    const { rerender } = renderSeeded([], options);
    rerender({ problems: [makeProblem({})], options });

    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].url).toBe('https://example.com/alert.mp3');
    expect(audioInstances[0].volume).toBe(0.5);
    expect(audioInstances[0].play).toHaveBeenCalled();
  });

  it('pauses playing custom audio when sound alerts are turned off', () => {
    const options = makeOptions({ soundTone: 'custom', soundCustomUrl: 'https://example.com/alert.mp3' });
    const { rerender } = renderSeeded([], options);
    rerender({ problems: [makeProblem({})], options });
    expect(audioInstances).toHaveLength(1);

    rerender({ problems: [makeProblem({})], options: makeOptions({ ...options, soundAlerts: false }) });
    expect(audioInstances[0].pause).toHaveBeenCalled();
  });

  it('pauses playing custom audio on unmount', () => {
    const options = makeOptions({ soundTone: 'custom', soundCustomUrl: 'https://example.com/alert.mp3' });
    const { rerender, unmount } = renderSeeded([], options);
    rerender({ problems: [makeProblem({})], options });
    expect(audioInstances).toHaveLength(1);

    unmount();
    expect(audioInstances[0].pause).toHaveBeenCalled();
  });
});
