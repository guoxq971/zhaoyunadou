export const CONTROLLER_API_VERSION = '1.0.0';

export function assertControllerContract(controller) {
  if (!controller || typeof controller !== 'object') throw new TypeError('[controller] controller is required');
  if (controller.controllerApiVersion !== CONTROLLER_API_VERSION) {
    throw new TypeError('[controller] unsupported controllerApiVersion');
  }
  for (const field of ['actorId', 'side']) {
    if (typeof controller[field] !== 'string' || controller[field].length === 0) {
      throw new TypeError(`[controller] ${field} is required`);
    }
  }
  for (const method of ['start', 'destroy', 'submit']) {
    if (typeof controller[method] !== 'function') throw new TypeError(`[controller] ${method}() is required`);
  }
  return controller;
}
