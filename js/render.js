import Member from "./member.js";
import * as utils from './utils.js'
import { getTranslator } from "./translator.js";
import Spinner from "./spinner.js";

const T = await getTranslator();

export default class Renderer {
    constructor(flowchartId, mindmapId, breadcrumbsId) {
        this.linkMaxWidth = 50;
        this.flowchartId = flowchartId;
        this.mindmapId = mindmapId;
        this.breadcrumbsId = breadcrumbsId;


        this.dataRoot;

        let dark = false;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            dark = true;
        }

        mermaid.initialize({
            startOnLoad: true,
            htmlLabels: true,
            // securityLevel: "loose",
            maxTextSize: 9000000,
            darkMode: dark,
            flowchart: {
                useMaxWidth: 0,
                padding: 10,
                htmlLabels: true,
                // defaultRenderer: 'dagre-d3'
            },
            mindmap: {
                useMaxWidth: true
                // padding: 20
            }
        });

        let that = this;
        // Add a click event listener to the document
        document.addEventListener('click', function (event) {
            if( event.target.tagName === "tspan") {
                let mindmapdiv = document.getElementById(that.mindmapId);
                if (!mindmapdiv.contains(event.target) ){
                    return;
                }
                let elem = event.target;
                while (elem && mindmapdiv.contains(elem)) {
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

        });
    }

    async renderData(node) {
        if (!node) return;
        
        await Spinner.show(T.spinnerDrawing);
        await Promise.all([
            this.renderMermaidFlow(document.getElementById(this.flowchartId), node),
            this.renderBreadcrumbs(document.getElementById(this.breadcrumbsId), this.dataRoot, node),
            this.renderMermaidMindmap(document.getElementById(this.mindmapId), node)
        ])
        Spinner.close();

    };

    async renderMermaidFlow(templateNode, node) {
        function renderMermaidCard(m, cardNum, linkWidth) {
            let parentLink = (m.parentId && m.id) ? `${m.parentId} --> ` : "";
            let nameLink = `<a href="#${m.id}">${m.name}</a>`;
            let title = m.title ? m.title + "<br>" : "";
    
            let card = `${parentLink}${m.id}["<i class="${m.titleObject?.icon}"></i>${title}<b>${nameLink}</b><br>`;
            card += `${m.overallstructuretotal.toFixed(0)} / ${m.grouptotal.toFixed(0)} / ${m.personalvolume}`;
            if (m.monthNoVolume > 0) {
                card += `<br>${T.cardMonthNoOrder(m.monthNoVolume)}`;
            }
            card += `"]\n`;
            if (cardNum > 0) {
                card += `linkStyle ${cardNum - 1} stroke-width:${linkWidth > 0 ? linkWidth : 1}px;\n`;
            }
    
            return card;
        }


        let data = Member.flattenTree(node);
        data[0].parent = data[0].parentId = undefined;

        let mermaidStr = 'graph TD;\n';

        for (let i = 0; i < data.length; i++) {
            let width = Math.ceil(data[i].overallstructuretotal * this.linkMaxWidth / data[0].overallstructuretotal);
            mermaidStr += renderMermaidCard(data[i], i, width);
        }
        let svgCode = await mermaid.render('flow', mermaidStr);
        templateNode.innerHTML = svgCode.svg;

        return mermaidStr;
    }



    renderBreadcrumbs(targetElement, root, currentNode) {
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
        targetElement.innerHTML = result;
    }


    async renderMermaidMindmap(targetElement, root) {
        let result = ["mindmap\n"];

        function renderNode(n, level) {
            result.push(`${'\t'.repeat(level)}${level==1?"root":""}(${n.title}\n`);
            result.push(`${'\t'.repeat(level)}${n.name}\n`);
            result.push(`${'\t'.repeat(level)}${n.overallstructuretotal.toFixed(0)} / ${n.grouptotal.toFixed(0)} / ${n.personalvolume})\n`);
            if(n.titleObject?.icon) {
                result.push(`${'\t'.repeat(level)}::icon(${n.titleObject.icon})\n`);
            }
            result.push(`${'\t'.repeat(level)}:::n${n.id} ${n.titleObject?.name ?? ""}\n`);
        }
        function renderStyles(n, level) {
            document.styleSheets[0].insertRule(`.n${n.id} {fill: hsl(${n.hue}, ${n.saturation}%, ${n.light}%);}`);
        }

        function calcHueSpans(node, level=0) {
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
                calcHueSpans(child, level+1);
            }
        }

        function calcHueRanges(node, level=0) {
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
                calcHueRanges(director, level+1);
            }
        }

        function assignColors(node, level=0) {
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
                assignColors(c, level+1);
            }
        }
        calcHueSpans(root);
        calcHueRanges(root);
        assignColors(root);
        utils.traverse(root, renderNode, 1);

        let svgCode = await mermaid.render('mindmap', result.join(''))
        targetElement.innerHTML = svgCode.svg;
        
        targetElement.querySelector("style").remove();
        utils.traverse(root, renderStyles, 1);
    }

    renderNoOrders(targetElement, root) {
        let result = ["<ul>"];
        utils.traverse(root, function rendercard(node, level) {
            if(level > 0){
                result.push("<li>");
                result.push(`<i class="${node.parent.titleObject?.icon}"></i> <a href="#${node.parent.id}">${node.parent.name}</a> - `);
                result.push(`<i class="${node.titleObject?.icon}"></i> <a href="#${node.id}">${node.name}</a>: `);
                result.push(`${node.monthNoVolume} m`);
                result.push("</li>");
            }
            for (let c of node.children) {
                rendercard(c, level+1);
            }
        });
        result.push("</ul>");
        targetElement.innerHTML = result.join("");
    }

}