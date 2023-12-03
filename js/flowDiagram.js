import * as utils from "./utils.js"
import { getTranslator } from "./translator.js";
import Member from "./member.js";
const T = await getTranslator();


export default class FlowDiagram {
    constructor(templateNode, mermaid) {
        this.templateNode = templateNode;
        this.mermaid = mermaid;
        
    }

    async render(node) {
        let data = utils.flattenTree(node);

        let mermaidStr = 'graph TD;\n';

        for (let i = 0; i < data.length; i++) {
            let width = Math.ceil(data[i].overallstructuretotal * this.linkMaxWidth / data[0].overallstructuretotal);
            mermaidStr += FlowDiagram.renderMermaidCard(data[i], i, width);
        }
        let svgCode = await this.mermaid.render('flow', mermaidStr);
        this.templateNode.innerHTML = svgCode.svg;

        return mermaidStr;
    }

    static renderMermaidCard(m, cardNum, linkWidth) {
        let parentLink = (cardNum>0 && m.parentId && m.id) ? `${m.parentId} --> ` : "";
        let nameLink = `<a href="#${m.id}">${m.name}</a>`;
        let title = m.title ? m.title + "<br>" : "";

        let card = `${parentLink}${m.id}["<i class="${m.titleObject?.icon}"></i>${title}<b>${nameLink}</b><br>`;

        if (m.unpayedOrders) card += `${T.cardUnpayedOrders}: ${m.unpayedOrders}\n`;
        if (m.personalvolume) card += `${T.cardPersonalVolume}: ${m.personalvolume}\n`;
        if (m.grouptotal) card += `${T.cardGrouptotal}: ${m.grouptotal.toFixed(0)}\n`;
        if (m.overallstructuretotal) card += `${T.cardOverallstructuretotal}: ${m.overallstructuretotal.toFixed(0)}\n`;

        if (m.monthNoVolume > 0) card += `\n${T.cardMonthNoOrder(m.monthNoVolume)}\n`;

        card += `"]\n`;
        if (cardNum > 0) {
            card += `linkStyle ${cardNum - 1} stroke-width:${linkWidth > 0 ? linkWidth : 1}px;\n`;
        }

        return card;
    }
}