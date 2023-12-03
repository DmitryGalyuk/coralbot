export function traverse(node, callback, level = 0) {
    callback(node, level);
    for (let child of node.children) {
        traverse(child, callback, level + 1);
    }
}


export function mapValue(value, fromRange, toRange) {
    let fromMin = fromRange[0];
    let fromMax = fromRange[1];
    let toMin = toRange[0];
    let toMax = toRange[1];

    let fromSpan = fromMax - fromMin;
    if (fromSpan == 0) return 0;

    let toSpan = toMax - toMin;

    let valueScaled = (value - fromMin) / fromSpan;

    return toMin + (valueScaled * toSpan);
}

export class Settings {
    static _settings = (() => {
        const settings = localStorage.getItem('settings');
        return settings ? JSON.parse(settings) : {};
    })();

    static _save() {
        localStorage.setItem('settings', JSON.stringify(this._settings));
    }

    static get language() {
        return this._settings.language || "en";
    }

    static set language(lang) {
        this._settings.language = lang;
        this._save();
    }
}

export function flattenTree(root) {
    let nodeslist = []; 
    // utils.traverse(root, n=>nodeslist.push(Object.assign(new Member(), n)));
    traverse(root, n=>nodeslist.push(n));
    return nodeslist;
}