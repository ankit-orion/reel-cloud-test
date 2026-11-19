// Where the game server lives. Set EXPO_PUBLIC_SERVER_URL when starting or building the app;
// a phone cannot reach "localhost" on your computer, so use your computer's LAN address
// (for example http://192.168.1.20:8787) or the URL of a deployed server.
const configured = process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://localhost:8787';

export const SERVER_URL = configured.replace(/\/+$/, '');
export const SOCKET_URL = `${SERVER_URL.replace(/^http/, 'ws')}/ws`;
