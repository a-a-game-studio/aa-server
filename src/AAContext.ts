/* eslint-disable import/no-cycle */
import http, { IncomingMessage } from 'http';
import { WebSocketServer, WebSocket, ClientOptions } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { AAServer } from './AAServer';
import { ErrorSys } from '@a-a-game-studio/aa-components';

interface RequestWsI {
	action?:string; // Действие
	wskey?:string; // Ключ для доступа к учетным данным
	data?:any;
}

export interface GetRouteParamI {
	origin:string;
	action:(ctx:AAContext) => void;
	param:string[];
}

export class AAContext {
	/** Состояние контекста */
	ok = true;

	/** wskey - ключ для поддержания WS соединения */
	wskey = '';

	/** apikey - ключ для авторизации */
	apikey = '';

	/** Система ошибок */
	err:ErrorSys = null;

	/** Сервер */
	app:AAServer = null;

	/** Параметры запроса */
	req:http.IncomingMessage = null;

	/** соединение HTTP */
	res:http.ServerResponse = null;

	/** соединение WebSocket */
	ws:WebSocket = null;

	/** Словарь cookies */
	cookies:Record<string, string> = {};

	/** Объект url */
	url:URL = null; // Объект url

	/** Параметры GET запроса */
	query:Record<string, string> = {};

	/** Встроенные параметры GET - mydoment.ru/path/:param1 */
	param:Record<string, string> = {};

	/** Тело/данные запроса */
	body:Record<string, any> = {};

	/** Позиция контекста */
	protected pos = 0;

	/** POST запрос */
	next():void {
		this.pos++;
		if (this.pos < this.app.afMiddleware.length) {
			this.app.afMiddleware[this.pos](this);
		} else if (this.pos === this.app.afMiddleware.length) {
			let bFindRoute = false;

			// POST запросы
			if (this.ok && this.res && this.req.method === 'POST') {
				if (this.app.ixPostRoute[this.url.pathname]) {
					bFindRoute = true;
					this.app.ixPostRoute[this.url.pathname](this);
				}
			}

			// GET запросы
			if (this.ok && this.res && this.req.method === 'GET') {
				if (this.app.ixGetRoute[this.url.pathname]) {
					bFindRoute = true;
					this.app.ixGetRoute[this.url.pathname](this);
				} else {
					const vFindRoute = this.fFindGetRouteWithParam();
					if (vFindRoute) {
						bFindRoute = true;
						const vGetRouteParam = this.app.ixGetRouteParam[vFindRoute.action];
						for (let i = 0; i < vFindRoute.param.length; i++) {
							this.param[vGetRouteParam.param[i]] = vFindRoute.param[i];
						}
						vGetRouteParam.action(this);
					}
				}
			}

			// WS запросы
			if (this.ok && this.ws) {
				bFindRoute = true;
				this.wskey = uuidv4();

				this.ws.on('message', async (msg:string) => {
					let vMsg:RequestWsI = null;

					try {
						vMsg = JSON.parse(String(msg));
					} catch (e) {
						console.log('Неверные входные данные', e);
						vMsg = {};
					}

					// console.log('MESSAGE:', vMsg.action, vMsg, bOk);
					// Проверка на ключ
					if (this.wskey !== vMsg?.wskey) {
						this.ok = false;
					}

					if (this.ok && vMsg && this.app.ixWsRoute[vMsg.action]) {
						const vCtxMsg = new AAContext();
						vCtxMsg.req = this.req;
						vCtxMsg.ws = this.ws;
						vCtxMsg.body = vMsg.data;

						this.app.ixWsRoute[vMsg.action](vCtxMsg);
					}

					if (!bFindRoute) {
						this.ok = false;
						console.error('Путь не найден');
					}
				});
				this.ws.on('close', (msg:any) => {
					console.log('CLOSE');
				});

				let out = null;
				if (this.ok) {
					console.log('CONNECTION');
					out = {
						ok: true,
						e: false,
						data: {
							msg: this.wskey
						}
					};
				} else {
					console.log('CLOSE');
					out = {
						ok: false,
						e: true,
						data: {
							msg: 'Не удалось создать соединение'
						}
					};
				}

				this.ws.send(JSON.stringify(out));
			}

			if (!bFindRoute) {
				this.status(404);
				this.error();
			}
		} else {
			this.status(404);
			this.error();
		}
	}

	/** Отправка ответа */
	send(data:string): void {
		console.log('SEND>>>', this.url.pathname);
		this.res.end(data);
	}

	/** остановить выполнение */
	stop(iStatus = 400) {
		this.error(iStatus);
	}

	/** Выбросить ошибку */
	error(iStatus = 500) {
		this.status(iStatus);
		if (this.app.fError) {
			this.app.fError(this);
		} else {
			this.status(500);
			console.error('Не указан обработчик ошибок');
			this.res.end('Ошибка сервера');
		}
	}

	/** Установить код ошибки */
	status(iError:number) {
		this.res.statusCode = iError;
	}

	/** Найти GET маршрут с параметрами */
	private fFindGetRouteWithParam(): {
		action:string; // Найденный роутер
		param:string[]; // Найденные параметры
	} {
		let bFindRoute = false;
		const asRouteParam = Object.keys(this.app.ixGetRouteParam);
		const asPathNameChunk = this.url.pathname.split('/');

		let aFindParam:string[] = [];
		let sFindRoute = '';

		for (let i = 0; i < asRouteParam.length; i++) {
			const sRouteParam = asRouteParam[i];
			const asRouteParamChunk = sRouteParam.split('/');

			aFindParam = [];

			console.log('');
			console.log('asRouteParam>>>', asRouteParamChunk);
			console.log('asPathNameChunk>>>', asPathNameChunk);
			console.log('');

			for (let j = 0; j < asPathNameChunk.length; j++) {
				const sRouteParamChunk = asRouteParamChunk[j];
				const sPathNameChunk = asPathNameChunk[j];

				console.log('==============Chunk>', sRouteParamChunk, ' == ', sPathNameChunk);

				if (bFindRoute) {
					break;
				} else if (sRouteParamChunk === ':' && j + 1 < asPathNameChunk.length) {
					aFindParam.push(sPathNameChunk);
					continue;
				} else if (sRouteParamChunk === ':' && j + 1 === asPathNameChunk.length
				) {
					bFindRoute = true;
					sFindRoute = sRouteParam;
					aFindParam.push(sPathNameChunk);
					break;
				} else if (sRouteParamChunk === sPathNameChunk && j + 1 < asPathNameChunk.length) {
					continue;
				} else if (sRouteParamChunk === sPathNameChunk && j + 1 === asPathNameChunk.length
				) {
					bFindRoute = true;
					sFindRoute = sRouteParam;
					break;
				} else {
					break;
				}
			}
		}

		let out: {
			action:string; // Найденный роутер
			param:string[]; // Найденные параметры
		} = null;
		if (bFindRoute) {
			out = {
				action: sFindRoute,
				param: aFindParam
			};
		}

		return out;
	}
}
