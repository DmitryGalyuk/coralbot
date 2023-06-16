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

    render(templateNode) {
        let mermaidStr = 'graph LR;\n';

        this.data.forEach(item => {
            mermaidStr += this.renderCard(item, templateNode);
        });

        return mermaidStr;
    }

    renderCard(m) {

        let icons = "";
        let modifierIcon = undefined;
        if(m.isNew) {
            modifierIcon = "new.svg";
        }
        else if(m.isOpen) {
            modifierIcon = "open.svg";
        }
        else if(m.isHighest) {
            modifierIcon = "highest.svg";
        }
        if (modifierIcon != undefined) {
            icons += `<img src='icons/${modifierIcon}'/>`
        }

        if(m.title && this.iconMap[m.titleNoPrefix]) {
            icons += `<img src='icons/${this.iconMap[m.titleNoPrefix]}'/>`;
        }
  
        let parentLink = (m.parent && m.id) ? `${m.parent} --> ` : "";

        let card = `${parentLink}${m.id}["${m.name}<br>${m.grouptotal} / ${m.personalvolume}"]\n`

        return card;
    }
}