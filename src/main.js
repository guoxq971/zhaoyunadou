// Web 组合根：只选择 Game Pack、Host 与本地服务，不承载玩法。
import { createGameApp } from './app-shell/create-game-app.js';
import { DEFAULT_GAME_PACK } from './game-pack.js';
import { createLocalEventCollector } from './platform-services/local-event-collector.js';
import { createWebHost } from './platforms/web/web-host.js';

const gamePack = DEFAULT_GAME_PACK;
const host = createWebHost({ gamePack });
const eventCollector = createLocalEventCollector();
const onAdapterError = (error, source) => {
  console.error(`[game-app:${source}]`, error);
};

export const app = createGameApp({
  gamePack,
  host,
  services: { eventCollector, onAdapterError },
});

app.start();
