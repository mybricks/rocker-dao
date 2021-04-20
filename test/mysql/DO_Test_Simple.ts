import { start, Column, DOBase, Mapping, Transaction } from '..';

const TABLENAME = 'users';
// const TABLENAME = 't_test';

class M0 {
	@Column id;

	@Column name;
}

class TDO extends DOBase {
	constructor() {
		super();
	}

	@Mapping(M0)
	async queryAll() {
		let sql = `select id,name from ${TABLENAME}`;
		return await this.exe(sql, []);
	}

	@Mapping(M0)
	async testDistinct() {
		let sql = `select distinct id,name from ${TABLENAME}`;
		return await this.exe(sql, []);
	}

	async testInsert() {
		let sql = `insert into ${TABLENAME} (id, name) values (1, 'Jason'), (2, 'Peter'), (3, 'Jack')`;
		return await this.exe(sql, []);
	}

	async testUpdate1() {
		let sql = `update ${TABLENAME} set name = 'John' where id = 2`;
		return await this.exe(sql, []);
	}

	async testUpdate2() {
		let sql = `update ${TABLENAME} set name = 'Marry' where id = 3`;
		return await this.exe(sql, []);
	}

	async testDelete() {
		let sql = `delete from ${TABLENAME} where id = 2`;
		return await this.exe(sql, []);
	}

	@Transaction
	async bakTest() {
			for (let i = 0; i < 3; i++) {
					if (i === 0) {
						await this.testInsert();
					} else if (i === 1) {
						await this.testUpdate1();
					} else if (i === 2) {
						await this.testUpdate2();
					}
			}

			let t = await this.queryAll();
			return t;
	}
}

//----------------------------------------------------------------------------
//----------------------------------------------------------------------------

start([
	// {
	// 	dbType: 'MYSQL',
	// 	// name: 'mysql',
	// 	host: 'rm-bp1fe3p1afniocplxdo.mysql.rds.aliyuncs.com',
	// 	user: 'jason',
	// 	password: 'Tjc36335149',
	// 	port: 3306,
	// 	database: 'test',
	// 	sqlPath: './sql/localhost'
	// }
	{
		dbType: 'POSTGRE',
		// name: 'postgresql',
		host: 'dev-c-pg.ttbike.com.cn',
		user: 'hpower',
		password: 'hpower',
		port: 3937,
		database: 'hpower',
		sqlPath: './sql/localhost'
	}
]);

let T: TDO = new TDO();
(async function() {
	let rtn;
	//rtn = await T.queryAll();
	//rtn = await T.queryAllBySqlTpt();
	try {
		rtn = await T.bakTest();
		// rtn = await T.testInsert();
		// rtn = await T.testUpdate();
		// rtn = await T.testDelete();
		console.log(rtn);
	} catch (ex) {
		console.log(ex);
	}

	//await T.updateBook();
	console.log(rtn);
})();
