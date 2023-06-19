export default class Member {
    constructor() {
        this.parent = "";
        this.children = [];
    }

    parse(row) {
        this.rownum = row['rownum'];
        this.level = row['level'].trim();
        this.id = row['id'];
        this.key = this.id;
        this.text = this.name = row['name'];
        this.title = row['title'];
        this.titleNoPrefix = this._removePrefixes(this.title, ['н', 'о', '1']);
        this.isNew = this._titleHasPrefix(['н']);
        this.isOpen = this._titleHasPrefix(['о']);
        this.isHighest = this._titleHasPrefix(['1']);
        this.personalvolume = parseFloat(row['personalvolume']?.trim() || 0);
        this.nso = row['nso'];
        this.maxzr = row['maxzr'];
        this.monthNoVolume = parseFloat(row['monthNoVolume']?.trim() || 0);
        this.status = row['status'];

        if (this.maxzr?.length > 2) {
            [this.maxtitle, this.titlenotclosedmonths] = this.maxzr.split('/');
        } else {
            this.maxtitle = '';
            this.titlenotclosedmonths = '';
        }
    }

    _titleHasPrefix(prefixes) {
        if (!this.title) {
            return false;
        }

        for (let prefix of prefixes) {
            if (this.title.trim().toLowerCase().startsWith(prefix)) {
                return true;
            }
        }

        return false;
    }

    _removePrefixes(str, prefixes) {
        for (const prefix of prefixes) {
            if( str.startsWith(prefix)) {
                return str.replace(prefix, '');
            }
        }
        return str;
    }

    calculate_group_total() {
        this.grouptotal = this.personalvolume;

        for (let child of this.children) {
            this.grouptotal += child.calculate_group_total();
        }

        return this.grouptotal;
    }

    // rest of the methods here...

    static removeZeroMembers(root) {
        if (!root) return null;

        // Filter out children with personalvolume of 0
        root.children = root.children.filter(member => member.grouptotal !== 0);

        // Recursively remove zero-volume members from each child
        for (let child of root.children) {
            this.removeZeroMembers(child);
        }

        return root;
    }

    static fromRawData(rawData) {
        let flatList = this._createMembersFromRawData(rawData);
        let root = this._buildChildParentRelationships(flatList);
        root.calculate_group_total();
        return root;
    }

    static flattenTree(root) {
        let flatList = [];

        function traverse(node) {
            // Create a copy of the node
            let nodeCopy = Object.assign({}, node);
            // Remove the children property from the node copy
            nodeCopy.children = undefined;
            // Add the node copy to the flat list
            flatList.push(nodeCopy);

            if (node.children) {
                for (let child of node.children) {
                    traverse(child);
                }
            }
        }

        traverse(root);
        return flatList;
    }

    static _buildChildParentRelationships(members) {
        let idToMemberMap = new Map();

        for (let member of members) {
            idToMemberMap.set(member.id, member);
        }

        for (let member of members) {
            if (member.parent) {
                idToMemberMap.get(member.parent).children.push(member);
            }
        }

        return members[0];
    }

    static _createMembersFromRawData(rawData) {
        let levelToLastMemberMap = new Map();
        let flatList = [];

        for (let row of rawData) {
            let member = new Member();
            member.parse(row);
            if (!member.id) continue;

            let level = parseInt(member.level.split('.')[1]);

            if (level !== 0) {
                let parentMember = levelToLastMemberMap.get(level - 1);
                member.parent = member.parentId = parentMember.id;
            }

            levelToLastMemberMap.set(level, member);
            flatList.push(member);
        }

        return flatList;
    }
}
