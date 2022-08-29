/*!
 * Rocker-Dao
 *
 * An database dao framework for mysql
 *
 * Copyright(c) 2017
 * Author: CheMingjun <chemingjun@126.com>
 */

export const DatabaseDefault: string = 'default';

export interface SqlMapper {
	reg(namespace: string, tnode: TNodeType);

	/**
     * Query a mapper by full path,like 'main:selectAll'
     *
     * @param {string} path
     * @returns {TNodeType}
     */
	get(path: string): TNodeType;
}

export type DBConfigType = {
	dbType?: string;
	name?: string;
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
	sqlPath?: string; //Mybatis xml file path
};

export class SqlResult {
	private emptyF: boolean;
	private sql: string;
	private mapper: Function;

	constructor(_sql: string, _resultType?: string) {
		this.sql = _sql;
		if (_resultType) {
			if (/^number|string|date$/.test(_resultType)) {
				this.mapper = class {
					_map_(data) {
						let fn = function(_v?) {
							if (_v === undefined || _v === null) {
								return _v;
							}
							switch (_resultType) {
								case 'string': {
									return String(_v);
								}
								case 'number': {
									return Number(_v);
								}
								case 'date': {
									return new Date(_v);
								}
							}
							throw new Error(`Unknow resultType[${_resultType}] for sql:${_sql}`);
						};

						if (data && Array.isArray(data)) {
							if (data.length == 0) {
								return fn();
							}
							if (data.length > 1) {
								throw new Error(`Invalid resultType ${_resultType} for multiple results.`);
							}
							let [ rst ] = data;
							if (rst) {
								let ks = Object.keys(rst);
								if (ks.length == 0) {
									return fn();
								}
								if (ks.length > 1) {
									throw new Error(`Invalid resultType ${_resultType} for multiple results.`);
								}
								return fn(rst[ks[0]]);
							} else {
								return fn();
							}
						} else {
							throw new Error(`Invalid resultType ${_resultType} for sql:${_sql}`);
						}
					}
				};
			} else {
				this.mapper = require(_resultType).default;
			}
		}
		this.emptyF = false;
	}

	static empty() {
		return new SqlResult(undefined);
	}

	toSql() {
		return this.sql;
	}

	map(data) {
		return this.mapper && this.mapper.prototype ? this.mapper.prototype['_map_'](data) : data;
	}

	isEmpty() {
		return this.emptyF;
	}
}

export interface TNodeType {
	id: string;

	compile(data: object): SqlResult;
}

export interface DataBase {
	getPool();
	getSqlTpt(path: string): TNodeType;
	getConfig(): DBConfigType;
	// 适配器
	// adapter(rtn, sql: string, sqlResult?: SqlResult);
	// quertAdapter(rtn, sqlResult?: SqlResult);
	insertAdapter(rtn);
	updateAdapter(rtn);
	deleteAdapter(rtn);
}
