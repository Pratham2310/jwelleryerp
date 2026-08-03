/**
 * Build identity, injected by Vite's `define` (Milestone 51).
 *
 * Deliberately not a hand-maintained constant: the System Health panel's whole claim is that
 * nothing on it is a placeholder, and a version string someone has to remember to bump is exactly
 * that. The fallbacks cover the test environment, where Vite's define does not run.
 */

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';

export const BUILD_TIME: string =
  typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : new Date().toISOString();
