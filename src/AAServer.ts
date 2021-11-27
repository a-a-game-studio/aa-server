/* eslint-disable import/no-cycle */
import http, { IncomingMessage } from 'http';
import { WebSocketServer, WebSocket, ClientOptions } from 'ws';

import { AAContext, GetRouteParamI } from './AAContext';
import { AARoute } from './AARoute';

import cookie from 'cookie';

export class AAServer {
	/** Словарь Post запросов */
	ixPostRoute:Record<string, (ctx:AAContext) => void> = {};

	/** Словарь Get запросов */
	ixGetRoute:Record<string, (ctx:AAContext) => void> = {};

	/** Словарь Get запросов с параметрами */
	ixGetRouteParam:Record<string, GetRouteParamI> = {};

	/** Словаро Get запросов */
	ixWsRoute:Record<string, (ctx:AAContext) => void> = {};

	/** Промежуточные действия - до обработки запроса */
	afMiddleware:((ctx:AAContext) => void)[] = [];

	/** HttpServer */
	vHttpServer:http.Server = null;

	/** WebSocketServer */
	vWsServer:WebSocketServer = null;

	/** Функция для обработки ошибок */
	fError: (ctx:AAContext) => void = null;

	/** цепочка загрузки */
	use(fn: (ctx:AAContext) => void) {
		this.afMiddleware.push(fn);
	}

	/** Добавить маршруты */
	route(route:AARoute) {
		const aPostRoute = Object.entries(route.ixPostRoute);
		for (let i = 0; i < aPostRoute.length; i++) {
			const [sRoute, fRoute] = aPostRoute[i];

			if (this.ixPostRoute[sRoute]) {
				console.log(`Маршрут POST [${sRoute}] уже существует`);
			} else {
				this.ixPostRoute[sRoute] = fRoute;
			}
		}

		const aGetRoute = Object.entries(route.ixGetRoute);
		for (let i = 0; i < aGetRoute.length; i++) {
			const [sRoute, fRoute] = aGetRoute[i];

			if (sRoute.indexOf(':') >= 0) {
				const aRouteParamValue:string[] = [];
				const aRouteParam = sRoute.split('/').map(el => {
					let sTpl = el;
					console.log('>>>', sTpl);
					if (el.indexOf(':') >= 0) {
						sTpl = ':';
						aRouteParamValue.push(el.replace(':', ''));
					}
					return sTpl;
				});

				console.log('aRouteParam>>>>', aRouteParam);
				const sRouteParam = aRouteParam.join('/');

				if (this.ixGetRouteParam[sRouteParam]) {
					console.log(`Маршрут GET PARAM [${sRouteParam}] уже существует`);
				} else {
					this.ixGetRouteParam[sRouteParam] = {
						origin: sRoute,
						action: fRoute,
						param: aRouteParamValue
					};
				}
			} else if (this.ixGetRoute[sRoute]) {
				console.log(`Маршрут GET [${sRoute}] уже существует`);
			} else {
				this.ixGetRoute[sRoute] = fRoute;
			}
		}

		const aWsRoute = Object.entries(route.ixWsRoute);
		for (let i = 0; i < aWsRoute.length; i++) {
			const [sRoute, fRoute] = aWsRoute[i];

			if (this.ixWsRoute[sRoute]) {
				console.log(`Маршрут WS [${sRoute}] уже существует`);
			} else {
				this.ixWsRoute[sRoute] = fRoute;
			}
		}
	}

	/** Route */
	error(fn: (ctx:AAContext) => void) {
		this.fError = fn;
	}

	/** прослушивание HTTP */
	listen(port:number, host = '127.0.0.1', fn?: () => void) {
		console.log('listen');
		this.vHttpServer = http.createServer(async (req:http.IncomingMessage, res:http.ServerResponse) => {
			res.setHeader('Content-Type', 'application/json; charset=utf-8;');

			console.log('req', req.url);

			const vCtx = new AAContext();
			vCtx.app = this;
			vCtx.req = req;
			vCtx.res = res;
			vCtx.cookies = cookie.parse(req.headers.cookie || '');

			const baseURL = `${<string>(<any>req).protocol}://${req.headers.host}/`;
			vCtx.url = new URL(req.url, baseURL);
			if (vCtx.url.search) { // Разбор параметров поиска
				// eslint-disable-next-line no-restricted-syntax
				for (const [name, value] of vCtx.url.searchParams) {
					vCtx.query[name] = value;
				}
			}

			if (this.afMiddleware[0]) {
				this.afMiddleware[0](vCtx);
			}

			// res.end('Hello world!');
		}).listen(port, host);

		if (fn) {
			fn();
		}
	}

	/** прослушивание HTTP */
	listenWs(port:number, host = '127.0.0.1', fn?: () => boolean) {
		this.vWsServer = new WebSocketServer({ host, port });

		this.vWsServer.on('connection', async (ws:WebSocket, req:http.IncomingMessage, client:ClientOptions) => {
			const vCtx = new AAContext();
			vCtx.app = this;
			vCtx.req = req;
			vCtx.ws = ws;
			vCtx.cookies = cookie.parse(req.headers.cookie || '');
			const baseURL = `${<string>(<any>req).protocol}://${req.headers.host}/`;
			vCtx.url = new URL(req.url, baseURL);

			if (this.afMiddleware[0]) {
				this.afMiddleware[0](vCtx);
			}
		});

		if (fn) {
			fn();
		}
	}
}

// const gApp = new AAServer();
// const vRoute = new AARoute();

// let iCnt = 0;

// vRoute.post('/post', (ctx:AAContext) => {
// 	iCnt++;
// 	if (iCnt % 1000 === 0) {
// 		console.log('/post', iCnt);
// 	}
// 	ctx.send(JSON.stringify({
// 		ok: true,
// 		e: false,
// 		data: {}
// 	}));
// });

// vRoute.ws('/ws', (ctx:AAContext) => {
// 	iCnt++;
// 	console.log('/ws', ctx.body, iCnt);
// 	if (iCnt % 1000 === 0) {
// 		console.log('/ws', iCnt);
// 	}
// 	ctx.ws.send(JSON.stringify({
// 		ok: true,
// 		e: false,
// 		data: ctx.body
// 	}));
// 	return false;
// });

// gApp.route(vRoute);

// gApp.listenWs(3010);
