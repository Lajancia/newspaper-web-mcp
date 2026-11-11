"use client";

/**
 * Serverless newspaper store — no backend, no persistence by default.
 * Tools (WebMCP) mutate this store; React subscribes via useSyncExternalStore.
 */

export type Headline = {
  title: string;
  url?: string;
  summary?: string;
  source?: string;
};

export type Story = {
  title: string;
  body: string;
  url?: string;
  source?: string;
};

export type Task = {
  text: string;
  done?: boolean;
  due?: string;
};

export type PaperState = {
  date: string; // e.g. "2026-11-11" — set by agent at fill time
  headlines: Headline[];
  stories: Story[];
  tasks: Task[];
};

const initialState: PaperState = {
  date: "",
  headlines: [],
  stories: [],
  tasks: [],
};

let state: PaperState = initialState;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getPaper(): PaperState {
  return state;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setPaperDate(date: string) {
  state = { ...state, date };
  emit();
  return { ok: true, date };
}

export function addHeadline(h: Headline) {
  state = { ...state, headlines: [...state.headlines, h] };
  emit();
  return { ok: true, count: state.headlines.length };
}

export function addStory(s: Story) {
  state = { ...state, stories: [...state.stories, s] };
  emit();
  return { ok: true, count: state.stories.length };
}

export function addTask(t: Task) {
  state = { ...state, tasks: [...state.tasks, t] };
  emit();
  return { ok: true, count: state.tasks.length };
}

export function clearPaper() {
  state = initialState;
  emit();
  return { ok: true };
}
