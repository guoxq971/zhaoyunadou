import {
  FIXED_ROUTE_CAMPAIGN_MODE_ID,
  MATCH_MODE_API_VERSION,
} from './fixed-route-campaign.js';

export { FIXED_ROUTE_MATCH_COMMAND_TYPES, createFixedRouteCampaignCommandHandlers } from './command-handlers.js';
export {
  FIXED_ROUTE_AUTHORIZED_COMMAND_TYPES,
  FIXED_ROUTE_CAMPAIGN_MODE_ID,
  LOCAL_PLAYER_ACTOR,
  MATCH_MODE_API_VERSION,
  authorizeFixedRouteCampaignCommand,
  consumeFixedRouteCampaignDomainEvents,
  createFixedRouteCampaignDomainEventHandlers,
  createFixedRouteCampaignMode,
} from './fixed-route-campaign.js';

export function assertMatchModeContract(matchMode) {
  if (!matchMode || typeof matchMode !== 'object') throw new TypeError('[match-mode] matchMode is required');
  if (matchMode.matchModeApiVersion !== MATCH_MODE_API_VERSION) {
    throw new TypeError('[match-mode] unsupported matchModeApiVersion');
  }
  if (matchMode.modeId !== FIXED_ROUTE_CAMPAIGN_MODE_ID) {
    throw new TypeError('[match-mode] unsupported modeId');
  }
  if (!matchMode.actor || typeof matchMode.actor !== 'object') {
    throw new TypeError('[match-mode] actor is required');
  }
  for (const field of ['actorId', 'side']) {
    if (typeof matchMode.actor[field] !== 'string' || matchMode.actor[field].length === 0) {
      throw new TypeError(`[match-mode] actor.${field} is required`);
    }
  }
  for (const method of [
    'authorize',
    'advance',
    'consumeDomainEvents',
    'startStage',
    'selectStage',
    'cancelProgressReset',
    'requestProgressReset',
    'startCurrentStage',
    'restart',
    'abandon',
    'quitToTitle',
    'resolveResult',
  ]) {
    if (typeof matchMode[method] !== 'function') {
      throw new TypeError(`[match-mode] ${method}() is required`);
    }
  }
  if (!matchMode.state || typeof matchMode.state !== 'object') {
    throw new TypeError('[match-mode] state is required');
  }
  return matchMode;
}
