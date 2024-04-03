export default class Treeview {
    constructor(targetElement) {
        this.targetElement = targetElement;
    }

    render(dataRoot) {
        let htmlContainer = document.createElement("DIV");
        this.renderNode(htmlContainer, dataRoot);
        this.targetElement.innerHTML = htmlContainer.innerHTML;
        
        let lis = this.targetElement.querySelectorAll("LI");
        lis.forEach(
            li => li.addEventListener("click", (e) => {
                li.classList.toggle("wrapped");
                e.stopPropagation();
            })
        );
        
    }

    renderNode(htmlRoot, dataNode) {
        let ul = document.createElement("UL");
        htmlRoot.appendChild(ul);
        let li = document.createElement("LI");
        li.textContent = dataNode.name;
        
        ul.appendChild(li);
        if (dataNode.children) {
            let nestedUl = document.createElement("UL");
            li.appendChild(nestedUl);
        }

        for (let child of dataNode.children) {
            this.renderNode(li, child)
        }
    }
}