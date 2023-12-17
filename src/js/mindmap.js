import Member from "./member.js";
import * as utils from './utils.js'

export default class Mindmap {
    constructor (targetElement) {
        this.targetElement = targetElement;
        this.targetElement.addEventListener('click', this.onclick());
    }

    onclick() {
        const map = this.targetElement;
        return function(event) {
            if( event.target.tagName === "tspan") {
                if (!map.contains(event.target) ){
                    return;
                }
                let elem = event.target;
                while (elem && map.contains(elem)) {
                    if (elem.classList.contains("mindmap-node")) {
                        let id;
                        for (let c of elem.classList) {
                            if( c.startsWith("n")) {
                                id = c.substring(1);
                                break;
                            }
                        }
                        // event.preventDefault();
                        location.hash = "#"+id;
                        return;
                    }
                    elem = elem.parentElement;
                }
            }
        }
    }

    async render(root) {
        let result = ["mindmap\n"];

        utils.traverse(root, Mindmap.renderNode(result), 1);

        let svgCode = await mermaid.render('mindmap', result.join(''))
        this.targetElement.innerHTML = svgCode.svg;
        
        this.targetElement.querySelector("style").remove();
        utils.traverse(root, Mindmap.renderStyles, 1);
    }

    static renderNode(result) {
        return function(n, level) {
            result.push(`${'\t'.repeat(level)}${level==1?"root":""}(${n.title}\n`);
            result.push(`${'\t'.repeat(level)}${n.name}\n`);
            result.push(`${'\t'.repeat(level)}${n.overallstructuretotal.toFixed(0)} / ${n.grouptotal.toFixed(0)} / ${n.personalvolume})\n`);
            if(n.titleObject?.icon) {
                result.push(`${'\t'.repeat(level)}::icon(${n.titleObject.icon})\n`);
            }
            result.push(`${'\t'.repeat(level)}:::n${n.id} ${n.titleObject?.name ?? ""}\n`);
        }
    }
    static renderStyles(n, level) {
        document.styleSheets[0].insertRule(`.n${n.id} {fill: hsl(${n.hue}, ${n.saturation}%, ${n.light}%);}`);
    }
}