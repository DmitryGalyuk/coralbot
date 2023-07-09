import titleModifiersJson from './titlemodifiers.js';
import titlesJson from './titles.js';
import * as utils from './utils.js';
import { getTranslator } from "./translator.js";

export default class Member {
    constructor() {
        this.parent = null;
        this.children = [];
        this.grouptotal = undefined;

    }

    static loadedLanguages = [];

    static order = titlesJson;
    static languageModifiers = titleModifiersJson;

    static directorOrder = (Member.order.find(o => o.name == "Director") || {}).order;
    static masterOrder = (Member.order.find(o => o.name == "Master") || {}).order;

    static async loadLanguage(lang) {
        const T = await getTranslator();
        for (let o of Member.order) {
            if (!o.short) o.short = {};
            o.short[lang] = T["short"+o.name];
            if (!o.long) o.long = {};
            o.long[lang] = T["long"+o.name];
        }
        for (let m in Member.languageModifiers) {
            if (!Member.languageModifiers.hasOwnProperty(m)) continue;
            Member.languageModifiers[m]={short: T["short"+m], long: T["long"+m]};
        }
        Member.loadedLanguages.push(lang);
    }
    
    async parse(row, language) {
        if (!Member.loadedLanguages.includes(language)) {
            await Member.loadLanguage(language);
        }

        this.language = language;
        this.rownum = row['rownum'];
        this.level = row['level'].trim();
        this.id = row['id'];
        this.key = this.id;
        this.text = this.name = row['name'];
        this.rawTitle = row['rawtitle'];
        this.personalvolume = typeof row['personalvolume'] === "number" ? row['personalvolume'] : 0;
        this.nso = row['nso'];
        this.maxzr = row['maxzr'];
        this.monthNoVolume = typeof row['monthNoVolume'] === "number" ? row['monthNoVolume'] : 0;
        this.status = row['status'];

        this.parseRawTitle("ru");
        this.title = this.fullTitle();

        if (this.maxzr?.length > 2) {
            [this.maxtitle, this.titlenotclosedmonths] = this.maxzr.split('/');
        } else {
            this.maxtitle = '';
            this.titlenotclosedmonths = '';
        }
    }



    fullTitle() {
        let titleParts = [];

        for (let modifierKey in Member.languageModifiers) {
            if (this[modifierKey]) {
                titleParts.push(Member.languageModifiers[modifierKey].long[this.language]);
            }
        }

        titleParts.push(this.title);

        return titleParts.join(' ');
    }

    parseRawTitle() {
        if (this.rawTitle.trim() == "") return "";

        // Sort the order array based on the length of the short title (longest first),
        // and then alphabetically if they have the same length
        const sortedOrder = Member.order.sort((a, b) => {
            const diff = b.short[this.language].length - a.short[this.language].length;
            if (diff === 0) return b.short[this.language] < a.short[this.language] ? -1 : 1;
            return diff;
        });

        // Identify the title
        for (let titleObj of sortedOrder) {
            if (this.rawTitle.endsWith(titleObj.short[this.language])) {
                this.titleObject = titleObj;
                this.title = this.titleObject.long[this.language];
                break;
            }
        }

        // Extract the modifiers
        let modifierStr = this.rawTitle.replace(this.titleObject.short[this.language], '');

        // Check for any modifiers
        for (let modifierKey in Member.languageModifiers) {
            const modifier = Member.languageModifiers[modifierKey];
            if (modifierStr.includes(modifier.short[this.language])) {
                this[modifierKey] = true;
            }
        }
    }





    _titleHasPrefix(prefixes) {
        if (!this.rawTitle) {
            return false;
        }

        for (let prefix of prefixes) {
            if (this.rawTitle.trim().toLowerCase().startsWith(prefix)) {
                return true;
            }
        }

        return false;
    }

    _removePrefixes(str, prefixes) {
        for (const prefix of prefixes) {
            if (str.startsWith(prefix)) {
                return str.replace(prefix, '');
            }
        }
        return str;
    }

    calculate_overallstructure_total() {
        this.overallstructuretotal = this.personalvolume;

        for (let child of this.children) {
            this.overallstructuretotal += child.calculate_overallstructure_total();
        }

        return this.overallstructuretotal;
    }


    calculate_group_totals() {
        // Initialize the grouptotal with the member's personalvolume
        this.grouptotal = this.personalvolume || 0;

        for (let child of (this.children || [])) {
            // If the child is not a director, add its grouptotal to the total
            if (!child.isDirector()) {
                this.grouptotal += child.calculate_group_totals();
            }
        }

        return this.grouptotal;
    }

    static update_grouptotals_tree(root) {
        let stack = [root];

        function traverse(node) {
            for (let child of node.children) {
                if (child.isDirector()) {
                    // director found, push to stack and traverse deeper. 
                    // Higher director in stack -- no directors under them
                    stack.push(child);
                }
                traverse(child);
            }
        }

        traverse(root);
        let director = stack.pop();
        while (director) {
            director.calculate_group_totals();
            director = stack.pop();
        }

    }

    isDirector() {
        if (!this.titleObject) return false;
        return this.titleObject.order >= Member.directorOrder;
    }

    isMaster() {
        if (!this.titleObject) return false;
        return this.titleObject.order >= Member.masterOrder;
    }

    findChild(id) {
        if (this.id == id) return this;

        for (let c of this.children) {
            let foundChild = c.findChild(id);
            if (foundChild) return foundChild;
        }
        return null;
    }

    static async fromRawData(rawData, language) {
        let flatList = await this._createMembersFromRawData(rawData, language);
        let root = this._buildChildParentRelationships(flatList);
        root.calculate_overallstructure_total();
        Member.update_grouptotals_tree(root);
        return root;
    }

    static flattenTree(root) {
        let nodeslist = []; 
        utils.traverse(root, n=>nodeslist.push(Object.assign(new Member(), n)));
        return nodeslist;
    }

    static _buildChildParentRelationships(members) {
        let idToMemberMap = new Map();

        for (let member of members) {
            idToMemberMap.set(member.id, member);
        }

        for (let member of members) {
            if (member.parentId) {
                let parent = idToMemberMap.get(member.parentId);
                member.parent = parent;
                parent.children.push(member);
            }
        }

        return members[0];
    }

    static async _createMembersFromRawData(rawData, language) {
        let levelToLastMemberMap = new Map();
        let flatList = [];

        for (let row of rawData) {
            let member = new Member();
            await member.parse(row, language);
            if (!member.id) continue;

            let level = parseInt(member.level.split('.')[1]);

            if (level !== 0) {
                let parentMember = levelToLastMemberMap.get(level - 1);
                member.parentId = parentMember.id;
            }

            levelToLastMemberMap.set(level, member);
            flatList.push(member);
        }

        return flatList;
    }

    static clone(root) {
        let nodeslist = Member.flattenTree(root);
        nodeslist[0].parent = nodeslist[0].parentId = undefined;
        nodeslist.forEach(n=>{n.children=[]; n.notFilterOut=undefined;});
        Member._buildChildParentRelationships(nodeslist);
        return nodeslist[0];
    }

    static query(root, nodePredicate = ()=>true, parentPredicate = ()=>true) {
        // if (!root || !nodePredicate || typeof nodePredicate !== "function") return null;
        if (!parentPredicate(root)) return null;

        let rootCopy = Member.clone(root);
        let nodeslist = []; 
        utils.traverse(rootCopy, n=>nodeslist.push(n));

        let node = nodeslist.pop();
        while (node) {
            if (!node.parent) break; //reached the root
            
            if (nodePredicate(node) || node.notFilterOut) {
                // keep, move to the parent matching the predicate
                let parent = node.parent;
                while (!parentPredicate(parent)) {
                    parent = parent.parent;
                }
                parent.notFilterOut = true;
                if (parent !== node.parent) {
                    parent.children.push(node);
                    let i = node.parent.children.findIndex(c=>c.id==node.id);
                    node.parent.children.splice(i, 1);
                    
                    node.parentId = parent.id;
                    node.parent = parent;
                }
            } else {
                let i = node.parent.children.findIndex(c=>c.id==node.id);
                node.parent.children.splice(i, 1);
            } 
            node = nodeslist.pop();
        }

        return rootCopy;
    }
}
