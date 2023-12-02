export default class Breadcrumbs {
    constructor(targetElement) {
        this.targetElement = targetElement;
    }
    render(root, currentNode) {
        let n = root.findChild(currentNode.id);
        let breadcrumbs = [];
        while (n) {
            let icon = "";
            if (n.titleObject?.icon) {
                icon = `<i class="${n.titleObject.icon}"></i> `;
            }
            breadcrumbs.push(`<a class="breadcrumb" href="#${n.id}">${icon}${n.name}</a>`);
            n = n.parent;
        }
        let result = breadcrumbs.reverse().join(" -- ");
        this.targetElement.innerHTML = result;
    }
}