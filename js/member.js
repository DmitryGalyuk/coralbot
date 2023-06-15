export default class Member {
    constructor(row) {
        this.parent = "";
        this.children = [];
        this.grouptotal = 0;

        this.rownum = row["rownum"];
        this.level = row["level"].trim();
        this.id = row["id"];
        this.key = this.id;
        this.name = row["name"];
        this.title = row["title"];
        this.personalvolume = parseFloat(row["personalvolume"]?.trim() || 0);
        this.nso = row["nso"];
        this.maxzr = row["maxzr"];
        this.monthNoVolume = parseFloat(row["monthNoVolume"]?.trim() || 0);
        this.status = row["status"];

        if(this.maxzr?.length > 2) {
            [this.maxtitle, this.titlenotclosedmonths] = this.maxzr.split('/');
        } else {
            this.maxtitle = "";
            this.titlenotclosedmonths = "";
        }
    }

    calculate_group_total() {
        this.grouptotal = this.personalvolume;
        
        for(let child of this.children) {
            child.calculate_group_total();
            this.grouptotal += child.grouptotal;
        }
    }

    to_dict() {
        // JavaScript does not have built-in __dict__ attribute like Python.
        // But we can convert the object to a dictionary like structure using Object.assign() method.
        let data = Object.assign({}, this);
        
        // Remove 'children' from the copied object
        delete data.children;
        
        return data;
    }
}
