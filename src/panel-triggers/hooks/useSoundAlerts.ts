import { useEffect, useRef } from 'react';
import { ProblemDTO } from 'datasource/types';
import { ProblemsPanelOptions } from '../types';
import { isNewProblem } from '../utils';

// A single shared AudioContext: browsers cap the number of live contexts per
// page, and a context created before any user gesture stays suspended until
// one happens, so it must be kept around rather than recreated per alert.
let sharedAudioContext: AudioContext | null = null;

// Test-only: drops the cached context so each test starts from a clean slate.
export function resetSharedAudioContext(): void {
  sharedAudioContext = null;
}

function getAudioContext(): AudioContext | null {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    console.warn('Zabbix panel: Web Audio API not supported in this browser');
    return null;
  }
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextClass();
  }
  return sharedAudioContext;
}

function playTone(type: 'beep' | 'alarm', volume: number): void {
  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  if (ctx.state === 'suspended') {
    // Autoplay policy: the context resumes only once the user has interacted
    // with the page. Kicking resume() off here makes later alerts audible.
    ctx.resume().catch(() => {});
  }
  if (ctx.state !== 'running') {
    console.warn('Zabbix panel: sound alert skipped, audio is blocked until you interact with the page');
    return;
  }

  const gainNode = ctx.createGain();
  gainNode.gain.value = Math.max(0, Math.min(1, volume / 100));
  gainNode.connect(ctx.destination);

  const oscillator = ctx.createOscillator();
  oscillator.connect(gainNode);

  if (type === 'beep') {
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
  } else {
    // alarm: two-tone sweep
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(660, ctx.currentTime);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.25);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.5);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.8);
  }

  oscillator.onended = () => {
    oscillator.disconnect();
    gainNode.disconnect();
  };
}

function playCustomUrl(url: string, volume: number): HTMLAudioElement {
  const audio = new Audio(url);
  audio.volume = Math.max(0, Math.min(1, volume / 100));
  audio.play().catch((err) => {
    console.warn('Zabbix panel: failed to play audio URL', err);
  });
  return audio;
}

const problemId = (p: ProblemDTO) => String(p.eventid ?? p.triggerid ?? '');

/**
 * Plays a sound when new problems appear.
 *
 * `ready` must be true only for a completed refresh: loading and error states
 * are ignored so that an empty result from a failed query does not make every
 * problem look new on the next successful one.
 */
export function useSoundAlerts(problems: ProblemDTO[], options: ProblemsPanelOptions, ready = true): void {
  // null until the first completed refresh seeds it: problems already present
  // at mount (or when the feature is re-enabled) are known, not new.
  const prevIdsRef = useRef<Set<string> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    soundAlerts,
    soundMinSeverity = 4,
    soundTone = 'beep',
    soundCustomUrl = '',
    soundVolume = 80,
    soundRepeat = false,
    highlightNewerThan = '1h',
  } = options;

  useEffect(() => {
    if (!soundAlerts) {
      // Stop any repeating audio if feature is disabled
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Re-enabling must reseed silently instead of replaying the current list
      prevIdsRef.current = null;
      return;
    }

    if (!ready) {
      return;
    }

    if (prevIdsRef.current === null) {
      // First completed refresh: seed the known ids without playing
      prevIdsRef.current = new Set(problems.map(problemId).filter(Boolean));
      return;
    }
    const prevIds = prevIdsRef.current;

    // Resolved problems (OK state) can still be listed by the panel; they must
    // not sound, and must not keep a repeating alert going.
    const activeProblems = problems.filter((p) => p.value !== '0');

    const matchingProblems = activeProblems.filter((p) => {
      const severity = Number(p.severity ?? p.priority ?? 0);
      return severity >= soundMinSeverity;
    });

    const newProblems = matchingProblems.filter((p) => {
      const id = problemId(p);
      if (!id) {
        return false;
      }
      return !prevIds.has(id) && isNewProblem(p, highlightNewerThan);
    });

    const shouldPlay = newProblems.length > 0 || (soundRepeat && matchingProblems.length > 0);

    if (shouldPlay) {
      if (soundTone === 'custom' && soundCustomUrl) {
        // Stop the previous playback before starting a new one
        audioRef.current?.pause();
        audioRef.current = playCustomUrl(soundCustomUrl, soundVolume);
      } else {
        playTone(soundTone as 'beep' | 'alarm', soundVolume);
      }
    }

    // Add to the known set instead of replacing it, so ids seen before an
    // empty or filtered-down result are still known afterwards.
    for (const p of problems) {
      const id = problemId(p);
      if (id) {
        prevIds.add(id);
      }
    }
  }, [
    problems,
    ready,
    soundAlerts,
    soundMinSeverity,
    soundTone,
    soundCustomUrl,
    soundVolume,
    soundRepeat,
    highlightNewerThan,
  ]);

  // Stop any playing audio when the panel unmounts
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);
}
