import Member from "./member.js";
import * as utils from './utils.js'

export default class Mindmap {
    constructor (targetElement) {
        this.targetElement = targetElement;
    }

    getClickHandler() {
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
                        event.preventDefault();
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


        Mindmap.calcHueSpans(root);
        Mindmap.calcHueRanges(root);
        Mindmap.assignColors(root);
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

    static calcHueSpans(node, level=0) {
        let parentWithSpan = node;
        if (level==0) {
            node.hueSpan = 360;
            parentWithSpan = node;
        }

        while (!parentWithSpan.hueSpan) parentWithSpan = parentWithSpan.parent

        for (let child of node.children) {
            if (child.isDirector()) {
                child.hueSpan = Math.ceil( 0.8 * utils.mapValue(
                    child.overallstructuretotal,
                    [0, parentWithSpan.overallstructuretotal],
                    [0, parentWithSpan.hueSpan]
                ));
            }
        }
        
        for (let child of node.children){
            Mindmap.calcHueSpans(child, level+1);
        }
    }

    static calcHueRanges(node, level=0) {
        let parentWithRange = node;
        if (level==0) {
            node.hueRange = [0, node.hueSpan];
            parentWithRange = node;
        }

        while (!parentWithRange.hueRange) parentWithRange = parentWithRange.parent

        let directorChildren = [];
        function findChildDirectors(n) {
            for (let c of n.children) {
                if (c.isDirector()) {
                    directorChildren.push(c);
                    continue;
                }
                findChildDirectors(c);
            }
        }
        findChildDirectors(node);

        let even = false;
        let range = parentWithRange.hueRange.slice();
        for (let child of directorChildren) {
            if (even) {
                child.hueRange = [range[0], range[0]+child.hueSpan];
                range[0] += child.hueSpan;
            } else {
                child.hueRange = [range[1]-child.hueSpan, range[1]];
                range[1] -= child.hueSpan;
            }
            even = !even;
        }

        for (let director of directorChildren) {
            Mindmap.calcHueRanges(director, level+1);
        }
    }

    static assignColors(node, level=0) {
        if (!node.parent || level==0) {
            node.hue = 0;
            node.saturation = 0;
            node.light = 0;
        }
        else if(node.isDirector()) {
            node.hue = Math.ceil( node.hueRange[0] + (node.hueRange[1] - node.hueRange[0])/2 );
            node.saturation = utils.mapValue(
                node.titleObject.order, 
                [Member.directorOrder, Math.max(...Member.order.map(o=>o.order))],
                [50, 100]);
            node.light = 50;
        }
        else {
            node.hue = node.parent.hue;
            node.saturation = node.parent.saturation / 2;
            node.light = 60;
        }

        for (let c of node.children) {
            Mindmap.assignColors(c, level+1);
        }
    }
}