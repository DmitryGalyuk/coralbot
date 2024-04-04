export default class Treeview {
    constructor(targetElement) {
        this.targetElement = targetElement;
    }

    render(dataRoot) {
        let htmlContainer = document.createElement("UL");
        this.renderNode(htmlContainer, dataRoot);
        this.targetElement.innerHTML = htmlContainer.outerHTML;

        let lis = this.targetElement.querySelectorAll("LI");
        lis.forEach(
            li => {
                li.addEventListener("click", (e) => {
                    li.classList.toggle("wrapped");
                    e.stopPropagation();
                });
                li.addEventListener('mouseover', () => {
                    // Select all the parent elements of the hovered li
                    let parentLi = li.parentElement.closest('li');

                    // Apply styles to each parent li element
                    while (parentLi !== null) {
                        parentLi.classList.add('hoveredParent');
                        parentLi = parentLi.parentElement.closest('li');
                    }
                });

                li.addEventListener('mouseout', () => {
                    // Remove styles from all li elements
                    document.querySelectorAll('.hoveredParent').forEach(el => {
                        el.classList.remove('hoveredParent');
                    });
                });
            }
        );

    }

    renderNode(htmlRoot, dataNode) {
        let li = document.createElement("LI");
        li.textContent = dataNode.name;

        htmlRoot.appendChild(li);
        if (dataNode.children && dataNode.children.length > 0) {
            let nestedUl = document.createElement("UL");
            li.appendChild(nestedUl);

            for (let child of dataNode.children) {
                this.renderNode(nestedUl, child)
            }
        }

    }
}