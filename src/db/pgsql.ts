// import * as path from 'path';
// import { Logger } from '@mybricks/rocker-commons';
// import { Pool } from 'pg';
// // import * as Types from "../types";
// import { SqlMapper, DBConfigType, TNodeType, DataBase, SqlResult } from '../types';
// import { parse } from '../sqlTpt';
// import { Env } from '../ds';
//
// export default class DSPgsql implements DataBase {
// 	private pgsqlPool: Pool;
// 	private sqlMapper: SqlMapper;
// 	private config: DBConfigType;
// 	constructor(_name: string, _cfg: DBConfigType) {
// 		var pgsql = require('pg');
// 		try {
// 			this.config = _cfg;
// 			this.pgsqlPool = new pgsql.Pool({
// 				// 避免 Handshake inactivity timeout 超时
// 				// acquireTimeout: 100 * 1000,
// 				host: _cfg.host,
// 				user: _cfg.user,
// 				password: _cfg.password,
// 				port: _cfg.port,
// 				database: _cfg.database,
// 				idleTimeoutMillis: 100 * 1000
// 				// multipleStatements: true
// 			});
// 			if (_cfg.sqlPath) {
// 				this.sqlMapper = parse(path.join(path.dirname(Env.bootstrapPath), _cfg.sqlPath));
// 			}
// 			Logger.info('Database[' + _name + '][host: ' + _cfg.host + '] start finished.');
// 		} catch (err) {
// 			throw err;
// 		}
// 	}
// 	getConfig(): DBConfigType {
// 		return this.config;
// 	}
// 	getPool() {
// 		return this.pgsqlPool;
// 	}
// 	getSqlTpt(path: string): TNodeType {
// 		return this.sqlMapper ? this.sqlMapper.get(path) : undefined;
// 	}
// 	// Select操作适配器
// 	queryAdapter(rtn, sqlResult?: SqlResult) {
// 		return sqlResult ? sqlResult.map(rtn.rows) : rtn.rows;
// 	}
// 	// Insert操作适配器
// 	insertAdapter(rtn) {
// 		return rtn.rows && rtn.rows.length > 0 ? rtn.rows : rtn.rowCount;
// 	}
// 	// Update操作适配器
// 	updateAdapter(rtn) {
// 		return rtn.rows && rtn.rows.length > 0 ? rtn.rows : rtn.rowCount;
// 	}
// 	// Delete操作适配器
// 	deleteAdapter(rtn) {
// 		return rtn.rows && rtn.rows.length > 0 ? rtn.rows : rtn.rowCount;
// 	}
// }
