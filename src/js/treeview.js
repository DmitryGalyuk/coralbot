export default class Treeview {
    constructor(targetElement) {
        this.targetElement = targetElement;
    }
    
    static toggleChildrenVisibility(node, visible) {
        if (node.dataset.hasChildren) {
            let children = document.querySelectorAll(`[data-parent-id='${node.dataset.id}']`);
            for (let child of children) {
                child.style.display = visible ? "block" : "none";
                if (child.dataset.hasChildren) {
                    Treeview.toggleChildrenVisibility(child, visible);
                }
            }
        }

    }
    render(dataRoot) {
        this.renderNode(this.targetElement, dataRoot);

        let lis = this.targetElement.querySelectorAll("DIV");
        lis.forEach(
            li => {
                li.addEventListener("click", (e) => {
                    let wrapped = li.classList.toggle("wrapped");
                    Treeview.toggleChildrenVisibility(li, !wrapped);
                });
                
                li.addEventListener('mouseover', () => {
                    let parentId = li.dataset.parentId;
                    if (!parentId) return;

                    // Select all the parent elements of the hovered li
                    let parentLi = document.querySelector(`[data-id='${parentId}']`);

                    // Apply styles to each parent li element
                    while (parentLi !== null) {
                        parentLi.classList.add('hoveredParent');
                        let parentParentId = parentLi.dataset.parentId;
                        parentLi = document.querySelector(`[data-id='${parentParentId}']`);
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
        let htmlRow = document.createElement("DIV");
        htmlRow.textContent = dataNode.name;
        htmlRow.style.setProperty("--_depth", dataNode.depth);
        htmlRow.dataset.id = dataNode.id;
        htmlRow.dataset.parentId = dataNode.parentId;
        htmlRow.dataset.hasChildren = dataNode.children.length>0;

        htmlRoot.appendChild(htmlRow);

        if (dataNode.children && dataNode.children.length > 0) {
            for (let child of dataNode.children) {
                this.renderNode(htmlRoot, child)
            }
        }

    }
}