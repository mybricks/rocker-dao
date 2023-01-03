/*!
 * Rocker-Dao
 *
 * An database dao framework for mysql
 *
 * Copyright(c) 2017
 * Author: CheMingjun <chemingjun@126.com>
 */
import 'zone.js';
// @ts-ignore
import { Logger } from '@mybricks/rocker-commons';
// import * as Types from './types'
// import { parse } from "./sqlTpt";
import { DatabaseDefault, SqlResult, DBConfigType, TNodeType, DataBase } from './types';
// import * as path from 'path';
// import { DataSource } from './main';
import { DSMysql } from './db';

// vdds proxy切换ds时导致烂连接
const VDDSChangeError = `conn pool is closed`;
// vdds proxy主动关闭异常链接
const ConnClosedError = `Connection is closed`;

export let Env = {
  bootstrapPath: null
};
export function startDS(dsCfg: DBConfigType) {
  let name = dsCfg.name ? dsCfg.name : DatabaseDefault;
  // if (!dsCfg.dbType || dsCfg.dbType.toUpperCase() !== 'MYSQL') {
  //     dsReg[name] = new DSMysql(name, dsCfg);
  //     return;
  // }

  switch (dsCfg.dbType) {
    // mysql
    case 'MYSQL':
      dsReg[name] = new DSMysql(name, dsCfg);
      if(dsCfg['isGlobal']) {
        // @ts-ignore
        global.__ROCKERDAO_DATASOURCE_INSTANCE__ = dsReg
    }
      break;
    // postgregsql
    case 'POSTGRE':
      // dsReg[name] = new DSMysql(name, dsCfg);
      // dsReg[name] = new DSMysql(name, dsCfg);
      break;
    default:
      throw new Error('Only Mysql & PostgreSql database supported.');
  }
}
export async function shutdown() {
  if (dsReg) {
    for (var name in dsReg) {
      let ds = dsReg[name];
      let pool = ds.getPool();
      if (pool) {
        await new Promise<void>((resole, reject) => {
          pool.end(function(err) {
            if (err) {
              Logger.error('Error occured when the database[' + name + '] shutdown.');
              reject(err);
              return;
            }
            Logger.warn('Database[' + name + '] had been shutdown.');
            resole();
          });
        });
      }
    }
  }
}
// export getConnection1 = () => {
// 	dbTYpe
// 	getConnection()
// }
export async function getConnection(_name: string = DatabaseDefault) {
  let ds = dsReg[_name];
  return _getConnection(_name, ds.getConfig().dbType);
}

export async function _getConnection(_name: string = DatabaseDefault, _dbType: string = 'MYSQL') {
  let ds = dsReg[_name];
  if (!ds) {
    throw new Error('The datasource[' + _name + '] not found.');
  }
  // return new Promise((resolve, reject) => {
  //     ds.getPool().getConnection(function (_err, con) {
  //         if (_err) {
  //             reject(_err);
  //         } else {
  //             resolve(con)
  //         }
  //     });
  // })
  let connnectFunc = {
    MYSQL: mysqlConnection,
    POSTGRE: pgsqlConnection
  };

  return connnectFunc[_dbType](ds);
}
/**
 * MySql Connection
 * @param ds 
 */
async function mysqlConnection(ds) {
  return new Promise((resolve, reject) => {
    ds.getPool().getConnection(function(_err, con) {
      if (_err) {
        reject(_err);
      } else {
        resolve(con);
      }
    });
  });
}
/**
 * PostgreSql Connection
 * @param ds 
 */
async function pgsqlConnection(ds) {
  return await ds.getPool().connect();
}
/**
 * Do transaction
 * @param con connection
 * @param fn transaction function
 * @returns {Promise<any>}
 */
export async function doTransaction(
  con: { threadId: string; release: Function; beginTransaction: Function; commit: Function; rollback: Function },
  fn: Function
) {
    let bt = new Date().getTime();
    let tdId = con.threadId;
    await new Promise<void>((resolve, reject) => {

        // con.beginTransaction(function(_e) {
        //     if (_e) {
        //     return reject(_e);
        //     }
        //     log(tdId, 'Transaction start...', null, bt);
        //     resolve();
        // });

        if (con.beginTransaction) {
			// mysql
			con.beginTransaction(function(_e) {
				if (_e) {
					return reject(_e);
				}
				log(tdId, 'Transaction start...', null, bt);
				resolve();
			});
		} else {
			// pgsql
			(con as any).query('BEGIN', function(_e) {
				if (_e) {
					return reject(_e);
				}
				log(tdId, 'Transaction start...', null, bt);
				resolve();
			});
		}
    });
    let rst;
    try {
        rst = await fn();
    } catch (ex) {
        logErr(tdId, `Transaction failed => ${ex.message}`);
        await new Promise<void>((resolve, reject) => {
            // con.rollback(function() {
            //     Logger.warn(`[${tdId}] Transaction rollback => ${ex.message}`);
            //     resolve();
            // });

            if (con.rollback) {
                // mysql
                con.rollback(function() {
                    Logger.warn(`[${tdId}] Transaction rollback => ${ex.message}`);
                    resolve();
                });
            } else {
                // pgsql
                (con as any).query('ROLLBACK', function(_e) {
                    reject(_e);
                });
            }
            
        });
        throw ex;
    }
    await new Promise<void>((resolve, reject) => {
        // con.commit(function(_e) {
        // if (_e) {
        //     return con.rollback(function() {
        //     Logger.warn(`[${tdId}]Transaction rollback => ${_e.message}`);
        //     reject(_e);
        //     });
        // }
        // log(tdId, 'Transaction finished.', null, bt);
        // resolve();
        // });

        if (con.commit) {
            // mysql
            con.commit(function(_e) {
                if (_e) {
                    return con.rollback(function() {
                    Logger.warn(`[${tdId}]Transaction rollback => ${_e.message}`);
                    reject(_e);
                    });
                }
                log(tdId, 'Transaction finished.', null, bt);
                resolve();
            });
        } else {
            // pgsql
            (con as any).query('COMMIT', function(_e) {
                if (_e) {
                    return (con as any).query('ROLLBACK', function(_e) {
                        reject(_e);
                    });
                }
                log(tdId, 'Transaction finished.', null, bt);
                resolve();
            })
        }
    });
    return rst;
}
export class DOBase {
  private __proto__: { dataSource: string };
  /**
     * Execute sql
     * @param {string} _sql
     * @param {any[]} _paramStatements
     * @returns {Promise<any>}
     */
  protected async exe<T>(_sql: string | Array<string>, _paramStatements?: any): Promise<T> {
    let dsName = this.__proto__.dataSource;
    let ds = null;
    // 是否为mybatis语法，当为true时，生成的sql中有可能带有”?“，使用带有占位符的query方法时出错
    let isXml = false;
    if (!dsName) {
      dsName = DatabaseDefault;
    }
    // @ts-ignore
    if(!dsReg[dsName] && global.__ROCKERDAO_DATASOURCE_INSTANCE__?.[dsName]) {
      // @ts-ignore
      dsReg[dsName] = global.__ROCKERDAO_DATASOURCE_INSTANCE__?.[dsName]
    }
    ds = dsReg[dsName]

    if (!ds) {
      throw new Error('The datasource[' + DatabaseDefault + '] not found.');
    }
    let sqlResult: SqlResult;

    if (typeof _sql == 'string' && /^[\w-.]+:/.test(_sql)) {
      //For sql template
      let tnode: TNodeType = ds.getSqlTpt(_sql);
      if (!tnode) {
        throw new Error('The sql template[' + _sql + '] not found.');
      }
      try {
        sqlResult = tnode.compile(_paramStatements);
        // console.log('sqlResult====>', sqlResult);
        _sql = sqlResult.toSql();
        isXml = true;
      } catch (ex) {
        throw ex;
      }
    }

    let bt = new Date().getTime();
    type Con = { threadId: string; query: Function; release: Function };
    let tcon: Con = Zone.current.get('connection'); //this['_connection_'];
    let con: any = tcon;
    let count = 5;
    let i = 0;
    let dsCfg = ds.getConfig();
    let reGetConn = async function(con) {
      if (!con) {
        try {
          con = await _getConnection(dsName, dsCfg.dbType);
          return con;
        } catch (e) {
          if (e.code === 'PROTOCOL_CONNECTION_LOST') {
            if (i < count) {
              Logger.error('错误发生PROTOCOL_CONNECTION_LOST', e);
              i++;
              return await reGetConn(con);
            } else {
              Logger.error('错误发生PROTOCOL_CONNECTION_LOST,超过重连次数');
              return null;
            }
          }
        }
      }
      return con;
    };

    con = await reGetConn(con);
    if (!con) {
      if (!dsCfg) throw new Error('错误发生PROTOCOL_CONNECTION_LOST,超过重连次数,并且无法获取连接池配置文件');
      startDS(dsCfg);
      await sleep(100);
      con = await _getConnection(dsName, dsCfg.dbType);
      if (!dsCfg) throw new Error('错误发生PROTOCOL_CONNECTION_LOST,重连仍然无效');
    }
    let tdId = con.threadId;

    // 统一处理con.query执行结果
    let handleResult = function(err, _rtn, fields) {
      return <Promise<T>>new Promise((resolve, reject) => {
        if (err) {
          reject(err);
          // return;
        } else {
          _sql = (<string>_sql).trim();

          // 通过DS实例的适配器返回处理后的数据

          if (/^select\s+/i.test(_sql)) {
            resolve(ds.queryAdapter(_rtn, sqlResult));
          } else if (/^insert\s+/i.test(_sql)) {
            resolve(ds.insertAdapter(_rtn));
          } else if (/^update\s+/i.test(_sql)) {
            resolve(ds.updateAdapter(_rtn));
          } else if (/^delete\s+/i.test(_sql)) {
            resolve(ds.deleteAdapter(_rtn));
          } else {
            resolve(ds.queryAdapter(_rtn, sqlResult));
          }

          // if (/^select\s+/i.test(_sql)) {
          // 	// resolve(sqlResult ? sqlResult.map(_rtn) : _rtn);
          // 	resolve(sqlResult ? sqlResult.map(rtn) : rtn);
          // } else if (/^insert\s+/i.test(_sql)) {
          // 	resolve(_rtn.insertId);
          // } else if (/^update\s+/i.test(_sql)) {
          // 	resolve(_rtn.changedRows);
          // } else if (/^delete\s+/i.test(_sql)) {
          // 	resolve(_rtn.affectedRows);
          // } else {
          // 	resolve(_rtn);
          // }
        }
      });
    };

    let genResult = function() {
      return <Promise<T>>new Promise((resolve, reject) => {
        if (isXml) {
          console.log('sql', _sql)
          con.query(_sql, function(err, _rtn, fields) {
            !tcon ? con.release() : null;

            handleResult(err, _rtn, fields)
              .then((res) => {
                resolve(res);
              })
              .catch((_err) => {
                reject(_err);
              });
            // if (err) {
            //     reject(err);
            //     return;
            // } else {
            //     _sql = (<string>_sql).trim();

            //     console.log('before adapted rtn with xml====>', _rtn);

            //     // 通过DS实例的适配器返回处理后的数据
            //     let rtn = ds.adapter(_rtn);

            //     console.log('after adapted rtn with xml====>', rtn);

            //     if (/^select\s+/i.test(_sql)) {
            //         // resolve(sqlResult ? sqlResult.map(_rtn) : _rtn);
            //         resolve(sqlResult ? sqlResult.map(rtn) : rtn);
            //     } else if (/^insert\s+/i.test(_sql)) {
            //         resolve(_rtn.insertId);
            //     } else if (/^update\s+/i.test(_sql)) {
            //         resolve(_rtn.changedRows);
            //     } else if (/^delete\s+/i.test(_sql)) {
            //         resolve(_rtn.affectedRows);
            //     } else {
            //         resolve(_rtn);
            //     }
            // }
          });
        } else {
          con.query(_sql, _paramStatements, function(err, _rtn, fields) {
            !tcon ? con.release() : null;

            handleResult(err, _rtn, fields)
              .then((res) => {
                resolve(res);
              })
              .catch((_err) => {
                reject(_err);
              });

            // if (err) {
            // 	reject(err);
            // 	return;
            // } else {
            // 	_sql = (<string>_sql).trim();

            // 	console.log('before adapted rtn with xml====>', _rtn);

            // 	// 通过DS实例的适配器返回处理后的数据
            // 	let rtn = ds.adapter(_rtn);

            // 	console.log('after adapted rtn with xml====>', rtn);

            // 	if (/^select\s+/i.test(_sql)) {
            // 		// resolve(sqlResult ? sqlResult.map(_rtn) : _rtn);
            // 		resolve(sqlResult ? sqlResult.map(rtn) : rtn);
            // 	} else if (/^insert\s+/i.test(_sql)) {
            // 		resolve(_rtn.insertId);
            // 	} else if (/^update\s+/i.test(_sql)) {
            // 		resolve(_rtn.changedRows);
            // 	} else if (/^delete\s+/i.test(_sql)) {
            // 		resolve(_rtn.affectedRows);
            // 	} else {
            // 		resolve(_rtn);
            // 	}
            // }
          });
        }
      })
        .then((_rtn) => {
          log(tdId, _sql, _paramStatements, bt);
          return _rtn;
        })
        .catch((_err) => {
          logErr(tdId, _sql);
          if (_err.code === 'PROTOCOL_CONNECTION_LOST') {
            Logger.error('query error, PROTOCOL_CONNECTION_LOST', _err);
          } else if (
            _err.message.indexOf(VDDSChangeError) != -1 ||
            _err.stack.indexOf(VDDSChangeError) != -1
          ) {
            Logger.error(`业务层代码执行时出错，原因为${VDDSChangeError}`, _err);
            ds.getPool().end(() => {
              Logger.error(`业务层代码执行出错:${VDDSChangeError}，已关闭所有连接正在重启`);
            });
            startDS(ds.getConfig());
          } else if (
            _err.message.indexOf(ConnClosedError) != -1 ||
            _err.stack.indexOf(ConnClosedError) != -1
          ) {
            Logger.error(`业务层代码执行时出错，原因:${ConnClosedError}.`, _err);
            ds.getPool().end(() => {
              Logger.error(`业务层代码执行出错:${ConnClosedError}，已关闭所有连接正在重启.`);
            });
            startDS(ds.getConfig());
          } else {
            Logger.error(`业务层代码执行时出错.`, _err);
          }
          throw _err;
        });
    };
    return genResult();
  }
}
//--------------------------------------------------------------------------------------------
let dsReg: { [index: string]: DataBase } = {};

function logErr(_conId, _sql, err?: Error) {
  Logger.error(`[${_conId}] Error: ${_sql ? _sql : ''}`, err);
}
function log(_conId, _msg, _paramAry, _bt) {
  Logger.info(
    '[' +
      _conId +
      '](' +
      (new Date().getTime() - _bt) +
      'ms) ' +
      _msg +
      (_paramAry && Array.isArray(_paramAry) ? '  [' + _paramAry + ']' : '')
  );
}
async function sleep(timeout) {
  await new Promise<void>((resolve, rej) => {
    setTimeout(() => {
      resolve();
    }, timeout);
  });
}
