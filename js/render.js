import Member from "./member.js";

export default class Renderer {
    constructor(data) {
        this.data = data;

        this.iconMap = {
            "А": "junior.svg",
            "БД": "gem.svg",
            "Д": "director.svg",
            "ИД": "gem.svg",
            "мА": "junior.svg",
            "ЗД": "ingot.svg",
            "п": "consumer.svg",
            "пп": "premiumconsumer.svg",
            "СД": "ingot.svg",
        }
    }

    renderMermaid(templateNode) {
        let mermaidStr = 'graph TD;\n';

        this.data.forEach(item => {
            mermaidStr += this.renderMermaidCard(item, templateNode);
        });

        return mermaidStr;
    }

    renderMermaidCard(m) {

        let icons = "";
        let modifierIcon = undefined;
        if (m.isNew) {
            modifierIcon = "new.svg";
        }
        else if (m.isOpen) {
            modifierIcon = "open.svg";
        }
        else if (m.isHighest) {
            modifierIcon = "highest.svg";
        }
        if (modifierIcon != undefined) {
            icons += `<img src='icons/${modifierIcon}'/>`
        }

        if (m.title && this.iconMap[m.titleNoPrefix]) {
            icons += `<img src='icons/${this.iconMap[m.titleNoPrefix]}'/>`;
        }

        let parentLink = (m.parent && m.id) ? `${m.parent} --> ` : "";

        let card = `${parentLink}${m.id}["${m.name}<br>${m.grouptotal} / ${m.personalvolume}"]\n`

        return card;
    }

    renderSankeyData() {
        let nodes = [];
        let links = [];
    
        // create a dictionary with 'id' as key and node object as value
        let nodeLookup = {};
    
        // recursive function to handle arbitrary tree depth
        function traverse(node, parentNode = null) {
            let currentNode = {node: parseInt(node.id), name: node.name};
            nodes.push(currentNode);
            nodeLookup[node.id] = currentNode;
    
            // if it has parent, add links from parent to child
            if (parentNode !== null) {
                links.push({source: parentNode.node, target: currentNode.node, value: node.grouptotal || 2});
            }
    
            // if it has children, recursively add each child
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => traverse(child, currentNode));
            }
        }
    
        // traverse the first node in the data array
        traverse(this.data);
      
        return {nodes, links};
    }

}