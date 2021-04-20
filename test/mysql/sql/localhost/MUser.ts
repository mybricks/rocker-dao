import {Column} from "../../..";

export default class {
    @Column
    id;

    @Column('u_desc')
    desc(v) {
        return v + '::::';
    }
}