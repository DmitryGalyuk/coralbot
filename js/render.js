import Member from "./member.js";

export default class Renderer {
    constructor(data) {
        this.data = data;
        this.data[0].parent = this.data[0].parentId = undefined;

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

    renderMermaid(templateNode) {
        var insertSvg = function (svgCode, bindFunctions) {
            templateNode.innerHTML = svgCode.svg;
            bindFunctions?.(element);
        }



        let mermaidStr = 'graph TD;\n';

        // this.data.forEach(item => {
        //     mermaidStr += this.renderMermaidCard(item);
        // });

        for (let i = 0; i < this.data.length; i++) {
            let width = Math.ceil(this.data[i].overallstructuretotal * 100 / this.data[0].overallstructuretotal);
            mermaidStr += this.renderMermaidCard(this.data[i], i, width);
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

    renderSankeyData() {
        let nodes = [];
        let links = [];

        // create a dictionary with 'id' as key and node object as value
        let nodeLookup = {};

        // recursive function to handle arbitrary tree depth
        function traverse(node, parentNode = null) {
            let currentNode = { node: parseInt(node.id), name: node.name };
            nodes.push(currentNode);
            nodeLookup[node.id] = currentNode;

            // if it has parent, add links from parent to child
            if (parentNode !== null) {
                links.push({ source: parentNode.node, target: currentNode.node, value: node.grouptotal || 2 });
            }

            // if it has children, recursively add each child
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => traverse(child, currentNode));
            }
        }

        // traverse the first node in the data array
        traverse(this.data);

        return { nodes, links };
    }

}