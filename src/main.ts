/*!
 * Rocker-Dao
 *
 * An database dao framework for mysql
 *
 * Copyright(c) 2017
 * Author: CheMingjun <chemingjun@126.com>
 */
import 'zone.js';
import { Logger } from '@mybricks/rocker-commons';
import * as Types from './types';
import { startDS, shutdown, getConnection, doTransaction } from './ds'

export function DataSource(ds: (string | { name: string, format?: string } | any)): Function {
    return function(target, className, props) {
        target.prototype.dataSource = ds;
    }
}

export function Column(...args: (string | { name: string, format?: string } | any)[]): void | any {
    let fn = function(clz: Function, column: string, name: string) {
        let map: Map<string, string> = clz['_columns_'];
        if (!map) {
            map = new Map();
            clz['_columns_'] = map;
            clz['_map_'] = function(rtn) {
                return mapTo(clz, rtn, map);
            };
        }

        map.set(column, name);
    }
    if (args.length <= 1) {//@Column(any)
        return function(target: Function, methodName: string) {
            fn(target, args[0], methodName);
        }
    } else if (args.length === 3) {//@Column
        fn(args[0], args[1], args[1]);
    }
}

export function Mapping(mapping: Function): Function {
    return function(target: Function, methodName: string, desc: { value }) {
        let oriFun = desc.value;
        desc.value = async function() {
            let rtn = await oriFun.apply(this, arguments);
            if (mapping) {
                return mapping.prototype['_map_'](rtn);
            } else {
                return rtn;
            }
        }
        return desc;
    }
}

export function Transaction(...args: (string | { name: string, format?: string } | any)[]): void | any {
    let fn = (target, methodName, desc) => {
        let oriFun = desc.value;
        desc.value = async function() {
            let th = this;
            let nth = function() {
            };
            nth.prototype = th;
            nth = new nth();
            nth['_connection_'] = await getConnection(Types.DatabaseDefault);

            let rtn;
            // try {
            //     let args = arguments;
            //     rtn = await doTransaction(nth['_connection_'], h => oriFun.apply(nth, args));
            // }finally {
            //     nth['_connection_'].release();
            //     nth['_connection_'] = undefined;
            // }

            try {
                let args = arguments;
                let zone = Zone.current.fork({
                    name: 'tx-' + nth['_connection_'].threadId,
                    properties: {
                        connection: nth['_connection_']
                    }
                });
                rtn = await new Promise((resolve, reject) => {
                    zone.run(async () => {
                        try {
                            let rtn = await doTransaction(nth['_connection_'], h => oriFun.apply(nth, args));
                            resolve(rtn);
                        } catch (e) {
                            Logger.error(`执行事务出错，threadId=${nth['_connection_'].threadId}`, e);
                            reject(e);
                        } finally {
                            nth['_connection_'].release();
                            nth['_connection_'] = undefined;
                        }
                    });
                });
            } catch (e) {
                Logger.error(`Transaction 注解出错`, e);
                throw e;
            }
            return rtn;
        }
        return desc;
    }
    if (args.length <= 1) {//@Transaction(any)
        return function(target: Function, methodName: string, desc: any) {
            return fn(target, methodName, desc);
        }
    } else if (args.length === 3) {//@Transaction
        return fn(args[0], args[1], args[2]);
    }
}


/**
 * Bootstrap Database
 * @param {{name?: string;  //Name,support multi database
 *                  dbType:string; //Database's type mysql(default) | sqllite | ....
 *                  host: string;  //Host
 *                  port: string;  //Port
 *                  user: string;  //User
 *                  password: string;  //Password
 *                  database: string; //Database name
 *                  }} configs
 */
export function start(configs: (Types.DBConfigType | { (): Types.DBConfigType })[]) {
    if (configs.length == 0) {
        throw new Error('No configuration found.');
    }

    configs.forEach(cfg => {
        let dsCfg: Types.DBConfigType;
        if (typeof (cfg) === 'function') {
            dsCfg = cfg();
        } else {
            dsCfg = cfg;
        }
        startDS(dsCfg);
    })
}

export { shutdown }

//----------------------------------------------------------------

function mapTo(ormClz, _rows, _mp: Map<string, string>) {
    if (_rows) {
        let fn = function(row) {
            let rtn = new ormClz.constructor(), tv, pro;
            _mp.forEach((pName, rName) => {
                tv = row[rName];
                pro = rtn[pName];
                if (typeof (pro) == 'function') {
                    rtn[pName] = pro.call(rtn, tv);//Overide the method
                    return;
                } else {
                    let descr = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(rtn), pName);
                    pro = descr && descr['set']
                    if (pro) {
                        pro.call(rtn, tv)
                        return;
                    }
                }
                rtn[pName] = tv;
            })
            return rtn;
        };
        if (Array.isArray(_rows)) {
            let rtn = [];
            _rows.forEach(row => {
                return rtn.push(fn(row))
            })
            return rtn;
        } else {
            return fn(_rows);
        }
    }
    return _rows;
}
