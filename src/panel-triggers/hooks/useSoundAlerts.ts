import { useEffect, useRef } from 'react';
import { ProblemDTO } from 'datasource/types';
import { ProblemsPanelOptions } from '../types';
import { isNewProblem } from '../utils';

function playTone(type: 'beep' | 'alarm', volume: number): void {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    console.warn('Zabbix panel: Web Audio API not supported in this browser');
    return;
  }

  const ctx = new AudioContextClass();
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

  // Clean up AudioContext after playback ends
  oscillator.onended = () => ctx.close();
}

function playCustomUrl(url: string, volume: number): void {
  const audio = new Audio(url);
  audio.volume = Math.max(0, Math.min(1, volume / 100));
  audio.play().catch((err) => {
    console.warn('Zabbix panel: failed to play audio URL', err);
  });
}

export function useSoundAlerts(problems: ProblemDTO[], options: ProblemsPanelOptions): void {
  const prevIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<Audio | null>(null);

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
      return;
    }

    const prevIds = prevIdsRef.current;

    const matchingProblems = problems.filter((p) => {
      const severity = Number(p.severity ?? p.priority ?? 0);
      return severity >= soundMinSeverity;
    });

    const newProblems = matchingProblems.filter((p) => {
      const id = String(p.eventid ?? p.triggerid ?? '');
      if (!id) {
        return false;
      }
      return !prevIds.has(id) && isNewProblem(p, highlightNewerThan);
    });

    const shouldPlay = newProblems.length > 0 || (soundRepeat && matchingProblems.length > 0);

    if (shouldPlay) {
      if (soundTone === 'custom' && soundCustomUrl) {
        playCustomUrl(soundCustomUrl, soundVolume);
      } else {
        playTone(soundTone as 'beep' | 'alarm', soundVolume);
      }
    }

    // Update the set of known problem IDs
    prevIdsRef.current = new Set(
      problems
        .map((p) => String(p.eventid ?? p.triggerid ?? ''))
        .filter(Boolean)
    );
  }, [problems, soundAlerts, soundMinSeverity, soundTone, soundCustomUrl, soundVolume, soundRepeat, highlightNewerThan]);
}
