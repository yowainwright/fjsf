import { describe, it, expect } from 'bun:test';
import { updateQuery } from '../src/search.ts';
import { createInitialState } from '../src/state.ts';
import type { PackageScript } from '../src/types.ts';

describe('updateQuery', () => {
  const mockScripts: PackageScript[] = [
    { name: 'test', command: 'bun test', workspace: 'root', packagePath: 'package.json' },
    { name: 'build', command: 'bun build', workspace: 'root', packagePath: 'package.json' },
    { name: 'test', command: 'vitest', workspace: 'ui-package', packagePath: 'packages/ui/package.json' },
    { name: 'dev', command: 'bun dev', workspace: 'api-service', packagePath: 'apps/api/package.json' },
  ];

  it('updates query and resets selection', () => {
    const state = { ...createInitialState(mockScripts), selectedIndex: 2 };
    const newState = updateQuery(state, 'test');

    expect(newState.query).toBe('test');
    expect(newState.selectedIndex).toBe(0);
  });

  it('filters matches based on query', () => {
    const state = createInitialState(mockScripts);
    const newState = updateQuery(state, 'test');

    expect(newState.matches).toHaveLength(2);
    expect(newState.matches.every((m) => m.item.name.includes('test'))).toBe(true);
  });

  it('searches both script name and workspace', () => {
    const state = createInitialState(mockScripts);
    const newState = updateQuery(state, 'ui-package');

    expect(newState.matches).toHaveLength(1);
    expect(newState.matches[0]?.item.workspace).toBe('ui-package');
  });

  it('returns all scripts when query is empty', () => {
    const state = createInitialState(mockScripts);
    const newState = updateQuery(state, '');

    expect(newState.matches).toHaveLength(4);
  });

  it('preserves original scripts array', () => {
    const state = createInitialState(mockScripts);
    const newState = updateQuery(state, 'test');

    expect(newState.scripts).toEqual(mockScripts);
    expect(newState.scripts).toBe(state.scripts);
  });

  it('handles queries with no matches', () => {
    const state = createInitialState(mockScripts);
    const newState = updateQuery(state, 'nonexistent');

    expect(newState.matches).toHaveLength(0);
  });
});
