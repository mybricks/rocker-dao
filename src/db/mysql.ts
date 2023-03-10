import * as path from 'path';
// @ts-ignore
import { Logger } from '@mybricks/rocker-commons';
import { OkPacket, Pool } from 'mysql2';
// import * as Types from "../types";
import { SqlMapper, DBConfigType, TNodeType, DataBase, SqlResult } from '../types';
import { parse } from '../sqlTpt';
import { Env } from '../ds';

export default class DSMysql implements DataBase {
	private mysqlPool: Pool;
	private sqlMapper: SqlMapper;
	private config: DBConfigType;
	constructor(_name: string, _cfg: DBConfigType) {
		var mysql = require('mysql2');
		try {
			this.config = _cfg;
			this.mysqlPool = mysql.createPool({
				// 避免 Handshake inactivity timeout 超时
				acquireTimeout: 100 * 1000,
				host: _cfg.host,
				user: _cfg.user,
				password: _cfg.password,
				port: _cfg.port,
				database: _cfg.database
				// multipleStatements: true
			});
			if (_cfg.sqlPath) {
				if(_cfg.bootstrapPath) {
					this.sqlMapper = parse(path.join(_cfg.bootstrapPath, _cfg.sqlPath));
				} else {
					this.sqlMapper = parse(path.join(path.dirname(Env.bootstrapPath), _cfg.sqlPath));
				}
			}
			Logger.info('Database[' + _name + '][host: ' + _cfg.host + '] start finished.');
		} catch (err) {
			throw err;
		}
	}
	getConfig(): DBConfigType {
		return this.config;
	}
	getPool() {
		return this.mysqlPool;
	}
	getSqlTpt(path: string): TNodeType {
		return this.sqlMapper ? this.sqlMapper.get(path) : undefined;
	}
	// Select操作适配器
	queryAdapter(rtn: OkPacket, sqlResult?: SqlResult) {
		return sqlResult ? sqlResult.map(rtn) : rtn;
	}
	// Insert操作适配器
	insertAdapter(rtn: OkPacket) {
		return rtn;
	}
	// Update操作适配器
	updateAdapter(rtn: OkPacket) {
		return rtn;
	}
	// Delete操作适配器
	deleteAdapter(rtn: OkPacket) {
		return rtn;
	}
}
