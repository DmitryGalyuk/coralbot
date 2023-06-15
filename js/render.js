import Member from "./member.js";

export default class Renderer {
    constructor(data) {
        this.data = data;
    }

    render() {
        let mermaidStr = this.directives()
            + 'graph LR;\n';

        this.data.forEach(item => {
            mermaidStr += this.renderCard(item);
        });

        return mermaidStr;
    }

    renderCard(m) {
        let card = ""

        if (m.parent && m.id) {
            card += `${m.parent} --> `;
        }

        card += `${m.id}["<span id='${m.id}'>${m.isNew ? 'New! ':''} ${m.name}</span><br>
                        ${m.grouptotal} / ${m.personalvolume}"]\n`;

        return card;
    }

    directives() {
        return `%%{
            init: { 
                "flowchart":{
                    "useMaxWidth": 0,
                    "padding": 10
                } 
            }
        }%%\n`
    }

    titleIcon(title) {
        let icon = ""
        // Assistant
        if( ["А"].find( e=>e == title.trim()) ) { icon = "" }
        // Diamond director
        if( ["БД"].find( e=>e == title.trim()) ) { icon = "" }
        // Director
        if( ["Д"].find( e=>e == title.trim()) ) { icon = "" }
        // Emerald director
        if( ["ИД"].find( e=>e == title.trim()) ) { icon = "" }
        // junior Assistant
        if( ["мА"].find( e=>e == title.trim()) ) { icon = "" }
        // new Director
        if( ["нД"].find( e=>e == title.trim()) ) { icon = "" }
        // ?? Open Gold Director
        if( ["оЗД"].find( e=>e == title.trim()) ) { icon = "" }
        // Consumer
        if( ["п"].find( e=>e == title.trim()) ) { icon = "" }
        // Premium Consumer
        if( ["пп"].find( e=>e == title.trim()) ) { icon = "" }
        // Silver Director
        if( ["СД"].find( e=>e == title.trim()) ) { icon = "" }

        return "icons/" + icon + ".svg";
    }
}