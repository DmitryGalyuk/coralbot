import Member from "./member.js";

export default class Renderer {
    constructor() {
        this.linkMaxWidth = 50;

        mermaid.initialize({
            startOnLoad: true,
            htmlLabels: true,
            // securityLevel: "loose",
            maxTextSize: 9000000,
            flowchart: {
                useMaxWidth: 0,
                padding: 10,
                htmlLabels: true,
                // defaultRenderer: 'dagre-d3'
            }
        });
    }

    renderMermaid(templateNode, node) {
        var insertSvg = function (svgCode, bindFunctions) {
            templateNode.innerHTML = svgCode.svg;
            bindFunctions?.(element);
        }

        let data = Member.flattenTree(node);
        data[0].parent = data[0].parentId = undefined;

        let mermaidStr = 'graph TD;\n';

        for (let i = 0; i < data.length; i++) {
            let width = Math.ceil(data[i].overallstructuretotal * this.linkMaxWidth / data[0].overallstructuretotal);
            mermaidStr += this.renderMermaidCard(data[i], i, width);
        }
        mermaid.render('some', mermaidStr).then(insertSvg)

        return mermaidStr;
    }

    renderMermaidCard(m, cardNum, linkWidth) {
        let parentLink = (m.parentId && m.id) ? `${m.parentId} --> ` : "";
        let nameLink = `<a href="#${m.id}">${m.name}</a>`;
        let title = m.title ? m.title + "<br>" : "";

        let card = `${parentLink}${m.id}["${title}<b>${nameLink}</b><br>${m.overallstructuretotal.toFixed(0)} / ${m.grouptotal.toFixed(0)} / ${m.personalvolume}"]\n`;
        if (cardNum > 0) {
            card += `linkStyle ${cardNum - 1} stroke-width:${linkWidth > 0 ? linkWidth : 1}px;\n`;
        }

        return card;
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
}