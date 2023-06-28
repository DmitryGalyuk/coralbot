import Member from "./member.js";

export default class Renderer {
    constructor() {
        this.linkMaxWidth = 50;

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
    }

    renderMermaidFlow(templateNode, node) {
        function renderMermaidCard(m, cardNum, linkWidth) {
            let parentLink = (m.parentId && m.id) ? `${m.parentId} --> ` : "";
            let nameLink = `<a href="#${m.id}">${m.name}</a>`;
            let title = m.title ? m.title + "<br>" : "";
    
            let card = `${parentLink}${m.id}["${title}<b>${nameLink}</b><br>${m.overallstructuretotal.toFixed(0)} / ${m.grouptotal.toFixed(0)} / ${m.personalvolume}"]\n`;
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
        mermaid.render('flow', mermaidStr).then(this._getMermaidRenderCallback(templateNode));

        return mermaidStr;
    }



    renderBreadcrumbs(targetElement, currentNode) {
        let n = currentNode;
        let breadcrumbs = [];
        while (n) {
            breadcrumbs.push(`<a class="breadcrumb" href="#${n.id}">${n.name}</a>`);
            n = n.parent;
        }
        let result = breadcrumbs.reverse().join(" -- ");
        targetElement.innerHTML = result;
    }

    renderMermaidMindmap(targetElement, root) {
        let result = ["mindmap\n"];
        let styleSheet;
        function traverse(node, callback, level=1) {
            callback(node, level);
            for (let child of node.children) {
                traverse(child, callback, level+1);
            }
        }
        function renderNode(n, level) {
            result.push(`${'\t'.repeat(level)}${level==1?"root":""}(${n.title}\n`);
            result.push(`${'\t'.repeat(level)}${n.name}\n`);
            result.push(`${'\t'.repeat(level)}${n.overallstructuretotal.toFixed(0)} / ${n.grouptotal.toFixed(0)} / ${n.personalvolume})\n`);
            result.push(`${'\t'.repeat(level)}:::n${n.id}\n`);
        }
        function renderStyles(n, level) {
            styleSheet.insertRule(`.n${n.id} {fill: hsl(${n.hue}, ${n.saturation}%, ${n.light}%);}`);
            styleSheet.insertRule(`.n${n.id} tspan {fill: yellow;}`)
        }
        function mapValue(value, fromRange, toRange) {
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

        function assignColors(node, odd=true) {
            if(!node.parent) {
                node.hueRange = [0, 360];
            } 
            // assign hueRangeSpan to each child having structure 
            for (let c of node.children) {
                if (c.children && c.children.length>0) {
                    c.hueSpan = mapValue(c.overallstructuretotal, [0, node.overallstructuretotal], node.hueRange);
                }
                else {
                    c.hueSpan = 0;
                }
            }

            let hueRangeEnd = 0;
            for (let i=node.children?.length % 2; i<node.children?.length; i+=2) {
                node.children[i].hueRange = [hueRangeEnd, hueRangeEnd+node.children[i].hueSpan];
                hueRangeEnd += node.children[i].hueSpan;
            }
            for (let i = node.children?.length-1; i>=0; i-=2) {
                node.children[i].hueRange = [hueRangeEnd, hueRangeEnd+node.children[i].hueSpan];
                hueRangeEnd += node.children[i].hueSpan;
            }

            if (!node.parent) {
                node.hue = 0;
                node.saturation = 0;
                node.light = 0;
            }
            else if(node.titleObject?.order >= Member.directorOrder) {
                node.hue = Math.ceil( (node.hueRange[1] - node.hueRange[0])/2 );
                node.saturation = mapValue(
                    node.titleObject.order, 
                    [Member.directorOrder, Math.max(...Member.order.map(o=>o.order))],
                    [50, 100]);
                node.light = 50;
            }
            else {
                node.hue = node.parent.hue;
                node.saturation = 20;
                node.light = 50;
            }

            for (let c of node.children) {
                assignColors(c);
            }


        }

        function assignHashLinks(target, root) {
            let nodes = document.querySelectorAll(".mindmap-node");
            for (let node of nodes) {
                let classes = node.classList;
                for (let cssClass of classes) {
                    if( cssClass.startsWith("n")) {
                        let id = cssClass.substring(1);
                        let textNode = node.querySelector("text");
                        let textContents = textNode.innerHTML;
                        let foreign = document.createElement("foreignObject");
                        foreign.innerHTML = `<a href="#${id}">${textContents}</a>`;
                        textNode.innerHTML = "";
                        textNode.appendChild(foreign);
                    }
                }
            }
        }
        
        traverse(root, renderNode);
        assignColors(root, [0, 360]);
        mermaid.render('mindmap', result.join('')).then(this._getMermaidRenderCallback(targetElement)).then(()=>{
        styleSheet = targetElement.querySelector("style").sheet;
            for(let i=0;i<styleSheet.cssRules.length;i++) {if(styleSheet.cssRules[i].selectorText.includes(".edge")) {styleSheet.deleteRule(i)}}
            for(let i=0;i<styleSheet.cssRules.length;i++) {if(styleSheet.cssRules[i].selectorText.includes(".section")) {styleSheet.deleteRule(i)}}

            traverse(root, renderStyles);
        })//.then(() => assignHashLinks(targetElement, root));

        
    }

    _getMermaidRenderCallback(templateNode) {
        return function(svgCode, bindFunctions) {
            templateNode.innerHTML = svgCode.svg;
            bindFunctions?.(element);
        }
    }
}