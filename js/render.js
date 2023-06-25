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
            },
            mindmap: {
                useMaxWidth: true
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
        function traverse(node, level) {
            if (!level) level = 1;
            renderNode(node, level);
            for (let child of node.children) {
                traverse(child, level+1);
            }
        }
        function renderNode(n, level) {
            result.push(`${'\t'.repeat(level)}${level==1?"root":""}(${n.title}\n`);
            result.push(`${'\t'.repeat(level)}${n.name}\n`);
            result.push(`${'\t'.repeat(level)}${n.overallstructuretotal.toFixed(0)} / ${n.grouptotal.toFixed(0)} / ${n.personalvolume})\n`);
        }
        
        traverse(root);
        mermaid.render('mindmap', result.join('')).then(this._getMermaidRenderCallback(targetElement));
    }

    _getMermaidRenderCallback(templateNode) {
        return function(svgCode, bindFunctions) {
            templateNode.innerHTML = svgCode.svg;
            bindFunctions?.(element);
        }
    }
}