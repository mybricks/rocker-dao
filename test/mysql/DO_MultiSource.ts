import {start, Column, DOBase, Mapping, Transaction, DataSource} from "..";

const TABLENAME = 'workspace_reg';
var sql = 'select * from ' + TABLENAME + ' where id=1';

class AppInfo {
    @Column
    id;

    @Column
    name;

}

class Minicode {
    @Column
    id;

    @Column
    name;

    @Column
    git;
}


@DataSource('vbuilder')
class NDO extends DOBase {
    @Mapping(AppInfo)
    async queryAll() {
        var ary = await this.exe(sql);
        return ary;
    }
}

@DataSource('vstudio')
class VDO extends DOBase {
    @Mapping(Minicode)
    async queryAll() {
        var ary = await this.exe(`select * from pub_components where v_id=834`);
        return ary;
    }
}

//----------------------------------------------------------------------------
//----------------------------------------------------------------------------

start([
    {name: 'vbuilder',host: '10.1.101.218', user: 'VBUILDER_APP_user', password: 'root', port: 3308, database: 'VBUILDER_APP'},
    {name: 'vstudio',host: '10.37.16.133', user: 'fe_vstudio', password: 'fe_vstudio', port: 3412, database: 'fe_vstudio'}
]);

let nDO: NDO = new NDO();
let vDO: VDO = new VDO();
(async function () {
    let rtn;
    try {
        rtn = await nDO.queryAll();
        console.log('NDO',rtn);

        rtn = await vDO.queryAll()
        console.log('VDO',rtn);
    } catch (ex) {
        console.log(ex);
    }

    // console.log(rtn);
})();