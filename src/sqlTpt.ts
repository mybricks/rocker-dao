/*!
 * Rocker-Dao
 *
 * An database dao framework for mysql
 *
 * Copyright(c) 2017
 * Author: CheMingjun <chemingjun@126.com>
 */
import * as xmldom from 'xmldom';

import * as Fs from 'fs';
import * as Path from 'path';
import {TNodeType, SqlMapper, SqlResult} from "./types";

abstract class TNode implements TNodeType {
    protected ele;
    protected children: { forEach: Function, some: Function };
    id: string;
    filePath: string;

    static getNode(_node, _filePath: string): TNode {
        let ps = eval(`T${_node.nodeName.replace(/\#/g, '')}`);
        return new ps(_node, _filePath);
    }

    constructor(ele, _filePath: string) {
        this.ele = ele;
        this.id = this.attr('id');
        this.filePath = _filePath;

        var nodes = this.ele.childNodes;
        this.children = Object.assign(nodes || {}, {
            forEach: function (_fn) {
                if (nodes) {
                    for (let i = 0; i < nodes.length; i++) {
                        if (_fn(nodes[i], i, this.ele) === false) {
                        //    return;
                        }
                    }
                }
            },
            some: function (_fn) {
                if (nodes) {
                    for (let i = 0; i < nodes.length; i++) {
                        if (_fn(nodes[i], i, this.ele) === true) {
                            return true
                        }
                    }
                    return false;
                }
            }
        })
    }

    attr(_name: string) {
        return this.ele.getAttribute ? this.ele.getAttribute(_name) : undefined;
    }

    eval(_exp, _envData) {
        // console.log('_exp', _exp);
        return new Function('', `with(this){return ${_exp}}`).call(_envData);
    }

    setProps(...names) {
        names.forEach(nm => {
            if (/\?$/.test(nm)) {
                nm = nm.replace('?', '');
            } else if (!this.attr(nm)) {
                throw new Error(`Invalid ${this.ele.nodeName},attribute '${nm}' expected.`)
            }
            this[nm] = this.attr(nm);
        })
    }

    abstract compile(data: object): SqlResult
}

class EvalData {
    _data_;

    constructor(data) {
        let mixin = (ori, no) => {
            for (let k in ori) {
                Object.defineProperty(no, k, {
                    get: function () {
                        let dt = ori[k];
                        if (typeof(dt) == 'object' && !Array.isArray(dt)) {
                            if(dt){
                                let nd = {};
                                Object.setPrototypeOf(nd, {});
                                mixin(dt, nd);
                                return nd;
                            }else{
                                // 针对 null
                                return dt;
                            }
                            
                        } if(dt == undefined) {
                            return null;
                        }else {
                            return dt;
                            // return typeof(dt) == 'string' ? `'${dt.replace(/('|")/g, '\\$1')}'` : dt;
                        }
                    }
                })
            }
        }
        this._data_ = data;
        mixin(data, this);
    }

    _eval_(_varName, _jdbcType) {
        let fn = (cur, to) => {
            let tmp = cur && cur.match(/\[.+?\]/i);
            if(tmp){
                let ret = new Function('exp','with(this){return eval(exp)}').call(to,cur);
                // mysql
                ret = typeof(ret) == 'string' ? `'${ret.replace(/('|")/g, '\\$1')}'` : ret;

                if (typeof(ret) == 'string') {
                    ret = ret.replace(/\\n/g, '\\\\n')
                }
                // 转义\n及\r
                // ret = typeof(ret) == 'string' ? ret.replace(/\n/g, '\\\\n') : ret;
                // ret = typeof(ret) == 'string' ? ret.replace(/\r/g, '\\\\r') : ret;
                // pg
                // ret = typeof(ret) == 'string' ? `'${ret.replace(/(')/g, '\'$1')}'` : ret;
                // ret = typeof(ret) == 'string' ? `'${ret}'` : ret;
                return ret;
            }else{
                let ary = cur.split('.'), t = to[ary[0]];
                // mysql
                t = typeof(t) == 'string' ? `'${t.replace(/('|")/g, '\\$1')}'` : t;

                if (typeof(t) == 'string') {
                    t = t.replace(/\\n/g, '\\\\n')
                }
                // 转义\n及\r
                // t = typeof(t) == 'string' ? t.replace(/\n/g, '\\\\n') : t;
                // t = typeof(t) == 'string' ? t.replace(/\r/g, '\\\\r') : t;
                // pg
                // t = typeof(t) == 'string' ? `'${t.replace(/(')/g, '\'$1')}'` : t;
                // ret = typeof(ret) == 'string' ? `'${ret.replace(/'/g, '\'\'')}'` : ret;
                // t = typeof(t) == 'string' ? `'${t}'` : t;
                return ary.length == 1 ? t : fn((ary.shift() && 0 || ary).join('.'), t);
            }
        }

        if (_jdbcType) {
            let ov = fn(_varName, this._data_);
            if (/CHAR|VARCHAR|LONGVARCHAR|DATE|TIME|TIMESTAMP/i.test(_jdbcType)) {
                return ov === undefined || ov === null ? null : `'${ov}'`;
            } else {
                return ov;
            }
        } else {
            // console.log('_eval_ result:', fn(_varName, this));
            return fn(_varName, this);
        }
    }

    _evalWithoutQuote_(_varName, _jdbcType) {
        let fn = (cur, to) => {
            let tmp = cur && cur.match(/\[.+?\]/i);
            if(tmp){
                let ret = new Function('exp','with(this){return eval(exp)}').call(to,cur);
                return ret;
            }else{
                let ary = cur.split('.'), t = to[ary[0]];
                return ary.length == 1 ? t : fn((ary.shift() && 0 || ary).join('.'), t);
            }
        }

        if (_jdbcType) {
            let ov = fn(_varName, this._data_);
            if (/CHAR|VARCHAR|LONGVARCHAR|DATE|TIME|TIMESTAMP/i.test(_jdbcType)) {
                return ov === undefined || ov === null ? null : `'${ov}'`;
            } else {
                return ov;
            }
        } else {
            return fn(_varName, this);
        }
    }
}

class EvalArray extends Array {
    push(...items): number {
        if (items[0] !== undefined) {
            return super.push.apply(this, arguments);
        }
    }
}

class Ttext extends TNode {
    compile(data: object): SqlResult {
        if (/^\n?\s+$/.test(this.ele.data)) {
            return SqlResult.empty();
        }

        let txt = this.ele.data.replace(/#{([^}]*)(,jdbcType=([^}]*))?}/g, function (all, varName, jt, jdbcType) {
            return `\${_eval_('${varName}',${jdbcType ? '\'' + jdbcType + '\'' : jdbcType})}`;
        }).replace(/#{([^}]*)(,jdbcType=([^}]*))?}/g, function (all, varName, jt, jdbcType) {
            // 针对字符串，不加''包围
            return `\${_evalWithoutQuote_('${varName}',${jdbcType ? '\'' + jdbcType + '\'' : jdbcType})}`;
        }).replace(/`/g, '\\`')

        return new SqlResult(this.eval('`' + txt + '`', new EvalData(data)));
    }
}

class Tselect extends TNode {
    parameterType: string;
    resultType: string;

    constructor(ele, _filePath: string) {
        super(ele, _filePath);
        this.setProps('id', 'parameterType?', 'resultType?');
    }

    compile(data: object): SqlResult {
        let ary: EvalArray = new EvalArray();
        this.children.forEach(nd => {
            let node = TNode.getNode(nd, this.filePath);
            ary.push(node.compile(data).toSql());
        })
        return new SqlResult(ary.join(' '),
            this.resultType && /^.{1,2}\//.test(this.resultType) ? Path.join(Path.dirname(this.filePath), this.resultType) : this.resultType
        );
    }
}

class Tinsert extends TNode {
    parameterType: string;
    statementType: string;

    constructor(ele, _filePath: string) {
        super(ele, _filePath);
        this.setProps('id', 'parameterType?', 'statementType?');
    }

    compile(data: object): SqlResult {
        let ary: EvalArray = new EvalArray();
        this.children.forEach(nd => {
            let node = TNode.getNode(nd, this.filePath);
            ary.push(node.compile(data).toSql());
        })
        return new SqlResult(ary.join(' '));
    }
}

class Tupdate extends Tinsert {

}

class Tdelete extends Tinsert {

}

class Tif extends TNode {
    test: string;

    constructor(ele, _filePath: string) {
        super(ele, _filePath);
        let test = this.attr('test');
        if (!test) {
            throw new Error('Invalid if,attribute test expected.');
        }
        this.test = test.replace(/\sand\s/g, ' && ').replace(/\sor\s/g, ' || ');
    }

    compile(data: object): SqlResult {
        let isTrue = false;
        try {
            isTrue = this.eval(this.test, data);
        } catch (e) {
            //console.log(e)
        }
        if (isTrue) {
            let ary: EvalArray = new EvalArray();
            this.children.forEach(nd => {
                let node = TNode.getNode(nd, this.filePath);
                ary.push(node.compile(data).toSql());
            })
            return new SqlResult(ary.join(' '));
        }
        return SqlResult.empty();
    }
}

class Ttrim extends TNode {
    prefix: string;
    prefixOverrides: string;
    suffix: string;
    suffixOverrides: string;

    constructor(ele, _filePath: string) {
        super(ele, _filePath);
        this.setProps('prefix?', 'prefixOverrides?', 'suffix?', 'suffixOverrides?');
    }

    compile(data: object): SqlResult {
        let ary: EvalArray = new EvalArray();
        this.children.forEach(nd => {
            ary.push(TNode.getNode(nd, this.filePath).compile(data).toSql());
        })
        if (ary.length > 0) {
            let sql = ary.join('');
            return new SqlResult((this.prefix ? this.prefix + ' ' : '')
                + (this.prefixOverrides ? sql.replace(new RegExp('^(\\s*)' + this.prefixOverrides.replace(/\\s/g, ''), 'i'), '$1') : '')
                + (this.suffixOverrides ? sql.replace(new RegExp(this.suffixOverrides + '(\\s*)$', 'i'), '$1') : '')
                + (this.suffix ? this.suffix + ' ' : ''));
        }
        return SqlResult.empty();
    }
}

class Twhere extends TNode {
    compile(data: object): SqlResult {
        let ary: EvalArray = new EvalArray();
        this.children.forEach(nd => {
            ary.push(TNode.getNode(nd, this.filePath).compile(data).toSql());
        })
        if (ary.length > 0) {
            let sql = ary.join('');
            return new SqlResult('where ' + sql.replace(/^(\s*)(\bAND\b|\bOR\b)/i, '$1'));
        }
        return SqlResult.empty();
    }
}

class Tset extends Twhere {
    compile(data: object): SqlResult {
        let ary: EvalArray = new EvalArray();
        this.children.forEach(nd => {
            ary.push(TNode.getNode(nd, this.filePath).compile(data).toSql());
        })
        if (ary.length > 0) {
            let sql = ary.join('');
            return new SqlResult('set ' + sql.replace(/^(\s*),/i, '$1').replace(/,(\s*)$/i, '$1'));
        }
        return SqlResult.empty();
    }
}

class Tchoose extends TNode {
    compile(data: object): SqlResult {
        let ary: EvalArray = new EvalArray();
        this.children.some(nd => {
            let node = TNode.getNode(nd, this.filePath);
            let sqlRst = node.compile(data);
            if (!sqlRst.isEmpty()) {
                let sql = sqlRst.toSql()
                ary.push(sql);
                if (nd.nodeName === 'when' && sql !== undefined) {
                    return true;
                }
                return false;
            } else {
                return false;
            }
        })
        if (ary.length > 0) {
            return new SqlResult(ary.join(' '));
        }
        return SqlResult.empty();
    }
}

class Twhen extends Tif {
}

class Totherwise extends TNode {
    compile(data: object): SqlResult {
        let ary: EvalArray = new EvalArray();
        this.children.forEach(nd => {
            let node = TNode.getNode(nd, this.filePath);
            ary.push(node.compile(data).toSql());
        })
        if (ary.length > 0) {
            return new SqlResult(ary.join(' '));
        }
        return SqlResult.empty();
    }
}

class Tforeach extends TNode {
    item: string;
    index: string;
    collection: string;
    open: string;
    separator: string;
    close: string;

    constructor(ele, _filePath: string) {
        super(ele, _filePath);
        this.setProps('item',
            'index',
            'collection',
            'open?',
            'separator?',
            'close?');
    }

    compile(data: object): SqlResult {
    if (data) {
            let self = this;
            let collection;
            // with(data){
            //     collection = eval(self.collection);
            // }
            // (function(){
            //     with(this){
            //         collection = eval(self.collection)
            //     }
            // }())
            collection = new Function('self', `with(this){return eval(self.collection)}`).call(data,self);
            // let conditions = data.conditions;
            // {
            //     collection = eval(self.collection);
            // }
            let set = collection;
            if (set) {
                let ary: EvalArray = new EvalArray();
                let th = this;
                if (Array.isArray(set)) {
                    set.forEach(function (_v, _i, _all) {
                        let childSql = '';
                        th.children.forEach(nd => {
                            data[th.item] = _v;
                            data[th.index] = _i;
                            let segSql = TNode.getNode(nd, th.filePath).compile(data).toSql();
                            if(segSql){
                                childSql += TNode.getNode(nd, th.filePath).compile(data).toSql();
                            }
                        });
                        ary.push(childSql);
                    })
                    if (ary.length > 0) {
                        return new SqlResult((this.open ? `${this.open} ` : '')
                            + ary.join(this.separator ? ` ${this.separator} ` : ' ')
                            + (this.close ? ` ${this.close}` : ''));
                    }
                } else {
                    throw new Error('Foreach invalid,collection must be an array.');
                }
            }
        }
        return SqlResult.empty();
    }
}

//---------------------------------------------------------------------------------

export function parse(_xmlFolderPath: string): SqlMapper {
    const mapperRepo: SqlMapper = new class implements SqlMapper {
        repertory: { [index: string]: { [index: string]: TNodeType } } = {}

        reg(namespace: string, tnode: TNodeType) {
            let nsMap = this.repertory[namespace];
            if (!nsMap) {
                this.repertory[namespace] = nsMap = {};
            }
            if (nsMap[tnode.id]) {
                throw new Error(`SqlMapper[namespace=${namespace},id=${tnode.id}] exist.`)
            }
            nsMap[tnode.id] = tnode;
        }

        get(path: string): TNodeType {
            if (typeof(path) != 'string' || path.trim() == '' || path.indexOf(':') == -1) {
                throw new Error('Path is empty or invalid when get SqlMapper.');
            }
            let ns: string = path.substring(0, path.indexOf(':'));
            let nsMap = this.repertory[ns];
            if (nsMap) {
                return nsMap[path.substring(path.indexOf(':') + 1)];
            }
        }
    }();
    let fn = function (_path) {
        let stat = Fs.statSync(_path);
        if (stat && stat.isDirectory() && _path.indexOf('.svn') == -1) {
            Fs.readdirSync(_path).forEach(fp => {
                fn(Path.join(_path, fp));
            })
        } else if (/.xml$/i.test(_path)) {//Mybatis xml file
            parseFile(_path, mapperRepo);
        }
    }
    fn(_xmlFolderPath);
    return mapperRepo;
}


function parseFile(_xmlFilePath: string, mapperReg: SqlMapper) {
    var xml = Fs.readFileSync(_xmlFilePath).toString();

    var xmlDoc = new xmldom.DOMParser().parseFromString(xml);

    if (xmlDoc.documentElement.nodeName != 'mapper') {
        throw new Error(`${_xmlFilePath} is not a mapper xml file`)
    }

    //Mapper's namespace
    let ns: string = xmlDoc.documentElement.getAttributeNode('namespace').value;

    var nodes = xmlDoc.documentElement.childNodes;
    if (nodes) {
        for (let i = 0; i < nodes.length; i++) {
            let nd = nodes[i];
            if (!/\#text|comment/.test(nd.nodeName)) {
                if (!nd.getAttribute('id')) {
                    throw new Error(`The attribute id expected for element[${nd.nodeName}] in file[${_xmlFilePath}].`);
                }
                mapperReg.reg(ns, TNode.getNode(nd, _xmlFilePath))
            }
        }
    }
}