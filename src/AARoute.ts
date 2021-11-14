/* eslint-disable import/no-cycle */

import { AAContext } from './AAContext';

export class AARoute {
	ixPostRoute:Record<string, (ctx:AAContext) => void> = {};

	ixGetRoute:Record<string, (ctx:AAContext) => void> = {};

	ixWsRoute:Record<string, (ctx:AAContext) => void> = {};

	/** POST запрос */
	post(sRoute:string, fn: (ctx:AAContext) => void) {
		this.ixPostRoute[sRoute] = fn;
	}

	/** GET запрос */
	get(sRoute:string, fn: (ctx:AAContext) => void) {
		this.ixGetRoute[sRoute] = fn;
	}

	/** WebSocket запрос */
	ws(sRoute:string, fn: (ctx:AAContext) => void) {
		this.ixWsRoute[sRoute] = fn;
	}
}
