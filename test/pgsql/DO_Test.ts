import {start, Column, DOBase, Mapping, Transaction} from "../../index";

const TABLENAME = 't_user';
var sql = 'select * from ' + TABLENAME;

class M0 {
  @Column
  id;

  @Column('email')
  email(v) {
    return v + '::::';
  }
}


class TDO extends DOBase {
  @Mapping(M0)
  async queryAll() {
    var ary = await this.exe(sql);
    return ary;
  }

  async queryAllBySqlTpt() {
    let insertKey = await this.exe('user:testInsert');
    return insertKey;
  }

  async queryWithValueHasQuote() {
    let rtn = await this.exe('user:queryAll', {name: `'zhan"gsan'`});
    return rtn;
  }

  async insertUser(crachF: boolean = false) {
    let id: number = await this.exe<number>(`insert into user(${crachF ? 'name1' : 'name'},u_desc) values('new','new_desc')`);
    return id;
  }

  async insertBook() {
    let id: number = await this.exe<number>(`insert into book(name) values('new')`);
    return id;
  }

  async updateBook() {
    let id: number = await this.exe<number>(`update book set name =  'aaaa' where id=?`, [1]);
    return id;
  }

  @Transaction
  async bakTest() {
    for (let i = 0; i < 3; i++) {
      if (i == 2)
        await this.insertUser(true);
      else
        await this.insertBook();
    }

    let t = await this.queryAll();
    return t;
  }
}

//----------------------------------------------------------------------------
//----------------------------------------------------------------------------

//start([{host: '127.0.0.1', user: 'root', password: '123456', port: 3306, database: 'test', sqlPath: './sql/localhost'}]);
start([{
  dbType: 'POSTGRE',
  host: 'dev-c-pg.ttbike.com.cn',
  user: 'hpower',
  password: 'hpower',
  port: 3937,
  database: 'hpower',
  sqlPath: './'
}]);

let T: TDO = new TDO();
(async function () {
  let rtn;
  //rtn = await T.queryAll();
  //rtn = await T.queryAllBySqlTpt();
  try {
    rtn = await T.queryAll();
  } catch (ex) {
    console.log(ex);
  }

  //await T.updateBook();
  console.log(rtn);
})();