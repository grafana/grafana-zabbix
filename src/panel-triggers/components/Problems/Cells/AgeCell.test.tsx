import React from 'react';
import { render, screen } from '@testing-library/react';
import { AgeCell, formatAge } from './AgeCell';

describe('formatAge', () => {
  it.each([
    [30, '<1m'],
    [14 * 60, '14m'],
    [63 * 60, '1h 03m'],
    [2 * 3600 + 41 * 60, '2h 41m'],
    [26 * 3600, '1d 2h'],
    [6 * 86400 + 5 * 3600, '6d 5h'],
    [45 * 86400 + 3600, '45d'],
  ])('formats %s seconds as %s', (seconds, expected) => {
    expect(formatAge(seconds)).toBe(expected);
  });

  it('never goes negative for timestamps slightly in the future', () => {
    expect(formatAge(-5)).toBe('<1m');
  });
});

describe('AgeCell', () => {
  it('renders the compact age and keeps the full timestamp as a title', () => {
    const timestamp = 1609459200; // 2021-01-01 00:00:00 UTC
    render(<AgeCell timestamp={timestamp} now={timestamp + 2 * 3600 + 41 * 60} />);

    const cell = screen.getByText('2h 41m');
    expect(cell).toHaveAttribute('title', '01 Jan 2021 00:00:00');
  });
});
