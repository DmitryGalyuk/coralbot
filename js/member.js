export default class Member {
    constructor(row) {
        this.parent = "";
        this.children = [];
        this._grouptotal = undefined;

        this.rownum = row["rownum"];
        this.level = row["level"].trim();
        this.id = row["id"];
        this.key = this.id;
        this.text = this.name = row["name"];
        this.title = row["title"];
        this.titleNoPrefix = this._removePrefixes(this.title, ['н', 'о', '1']);
        this.isNew = this._titleHasPrefix(['н']);
        this.isOpen = this._titleHasPrefix(['о']);
        this.isHighest = this._titleHasPrefix(['1']);
        this.personalvolume = parseFloat(row["personalvolume"]?.trim() || 0);
        this.nso = row["nso"];
        this.maxzr = row["maxzr"];
        this.monthNoVolume = parseFloat(row["monthNoVolume"]?.trim() || 0);
        this.status = row["status"];

        if (this.maxzr?.length > 2) {
            [this.maxtitle, this.titlenotclosedmonths] = this.maxzr.split('/');
        } else {
            this.maxtitle = "";
            this.titlenotclosedmonths = "";
        }
    }

    _titleHasPrefix(prefixes) {
        // If title is not provided or empty, return false.
        if (!this.title) {
            return false;
        }
        
        // Check if this.title starts with any of the specified prefixes.
        for (let prefix of prefixes) {
            if (this.title.trim().toLowerCase().startsWith(prefix)) {
            return true;
            }
        }
      
        // If no matching prefix was found, return false.
        return false;
    }

    _removePrefixes(str, prefixes) {
        for (const p of prefixes) {
            if( str.startsWith(p)) {
                return str.replace(p, "");
            }
        }
        return str;
    }

    get grouptotal() {
        if (this._grouptotal != undefined) {
            return this._grouptotal;
        }
        this.calculate_group_total()
        return this._grouptotal;
    }

    calculate_group_total() {
        this._grouptotal = this.personalvolume;

        for (let child of this.children) {
            child.calculate_group_total();
            this._grouptotal += child._grouptotal;
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
