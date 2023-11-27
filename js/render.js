import Member from "./member.js";
import * as utils from './utils.js'
import { getTranslator } from "./translator.js";
import Spinner from "./spinner.js";

const T = await getTranslator();

export default class Renderer {
    constructor(flowchartId, mindmapId, breadcrumbsId, orgchartId) {
        this.linkMaxWidth = 50;
        this.flowchartId = flowchartId;
        this.mindmapId = mindmapId;
        this.breadcrumbsId = breadcrumbsId;
        this.orgchartId = orgchartId;

        let dark = false;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            dark = true;
        }

        mermaid.initialize({
            startOnLoad: true,
            htmlLabels: true,
            // securityLevel: "loose",
            maxTextSize: 9000000,
            darkMode: dark,
            flowchart: {
                useMaxWidth: 0,
                padding: 10,
                htmlLabels: true,
                // defaultRenderer: 'dagre-d3'
            },
            mindmap: {
                useMaxWidth: true
                // padding: 20
            }
        });

        let that = this;
        // Add a click event listener to the document
        document.addEventListener('click', function (event) {
            if( event.target.tagName === "tspan") {
                let mindmapdiv = document.getElementById(that.mindmapId);
                if (!mindmapdiv.contains(event.target) ){
                    return;
                }
                let elem = event.target;
                while (elem && mindmapdiv.contains(elem)) {
                    if (elem.classList.contains("mindmap-node")) {
                        let id;
                        for (let c of elem.classList) {
                            if( c.startsWith("n")) {
                                id = c.substring(1);
                                break;
                            }
                        }
                        event.preventDefault();
                        location.hash = "#"+id;
                        return;
                    }
                    elem = elem.parentElement;
                }
            }

        });
    }

    async renderData(root, activeBranch) {
        if (!activeBranch) return;
        
        await Spinner.show(T.spinnerDrawing);
        await Promise.all([
            this.renderMermaidFlow(document.getElementById(this.flowchartId), activeBranch),
            this.renderBreadcrumbs(document.getElementById(this.breadcrumbsId), root, activeBranch),
            this.renderMermaidMindmap(document.getElementById(this.mindmapId), activeBranch),
            // this.renderOrgchart(document.getElementById(this.orgchartId), root)
        ])
        .catch(e => { 
            console.error(e);
            throw e; }
        );
        Spinner.close();

    };

    async renderOrgchart(templateNode, node) {
        let flat = Member.flattenTree(node);
        let chart = new d3.OrgChart();

        chart.layoutBindings().top.linkY = (n) => n.y - 24;

        chart
        // .nodeHeight((d) => 85)
        // .nodeWidth((d) => {
        //   return 220;
        // })
        .childrenMargin((d) => 50)
        .compactMarginBetween((d) => 25)
        .compactMarginPair((d) => 50)
        .neighbourMargin((a, b) => 25)
        .siblingsMargin((d) => 25)
        .buttonContent(({ node, state }) => {
          return `<div style="px;color:#716E7B;border-radius:5px;padding:4px;font-size:10px;margin:auto auto;background-color:white;border: 1px solid #E4E2E9"> <span style="font-size:9px">${
            node.children
              ? `<i class="fas fa-angle-up"></i>`
              : `<i class="fas fa-angle-down"></i>`
          }</span> ${node.data._directSubordinates}  </div>`;
        })
        .linkUpdate(function (d, i, arr) {
            d3.select(this)
            .attr('stroke', (d) =>
            d.data._upToTheRootHighlighted ? '#152785' : '#E4E2E9'
            )
            .attr('stroke-width', (d) =>
            d.data._upToTheRootHighlighted ? 5 : 1
            );
            
            if (d.data._upToTheRootHighlighted) {
                d3.select(this).raise();
                window.location.hash = d.data.id;
          }
        //   chart.fit()
        })
        .nodeContent(function (d, i, arr, state) {
          const color = '#FFFFFF';
          if (d.data.id == node.id) {
            d._expanded = true;
            chart.expandSomeNodes(d);
        }

          return `
          <div style="font-family: 'Inter', sans-serif;background-color:${color}; position:absolute;margin-top:-1px; margin-left:-1px;width:${d.width}px;height:${d.height}px;border-radius:10px;border: 1px solid #E4E2E9">
             <div style="background-color:${color};position:absolute;margin-top:-25px;margin-left:${15}px;border-radius:100px;width:50px;height:50px;" >
                <i class="${d.data.titleObject?.icon}" style="position:absolute;margin-top:-20px;margin-left:${20}px;border-radius:100px;width:40px;height:40px;"></i></div>
             
            <div style="color:#08011E;position:absolute;right:20px;top:17px;font-size:10px;"><i class="fas fa-ellipsis-h"></i></div>

            <div style="font-size:15px;color:#08011E;margin-left:20px;margin-top:32px"> ${
              d.data.name
            } </div>
            <div style="color:#716E7B;margin-left:20px;margin-top:3px;font-size:10px;"> ${
              d.data.fullTitle()
            } </div>


         </div>
`;


        })

          chart.container(templateNode).data(flat).render()//.expandAll().fit();
    }

    async renderMermaidFlow(templateNode, node) {
        function renderMermaidCard(m, cardNum, linkWidth) {
            let parentLink = (m.parentId && m.id) ? `${m.parentId} --> ` : "";
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


        let data = Member.flattenTree(node);
        data[0].parent = data[0].parentId = undefined;

        let mermaidStr = 'graph TD;\n';

        for (let i = 0; i < data.length; i++) {
            let width = Math.ceil(data[i].overallstructuretotal * this.linkMaxWidth / data[0].overallstructuretotal);
            mermaidStr += renderMermaidCard(data[i], i, width);
        }
        let svgCode = await mermaid.render('flow', mermaidStr);
        templateNode.innerHTML = svgCode.svg;

        return mermaidStr;
    }



    renderBreadcrumbs(targetElement, root, currentNode) {
        let n = root.findChild(currentNode.id);
        let breadcrumbs = [];
        while (n) {
            let icon = "";
            if (n.titleObject?.icon) {
                icon = `<i class="${n.titleObject.icon}"></i> `;
            }
            breadcrumbs.push(`<a class="breadcrumb" href="#${n.id}">${icon}${n.name}</a>`);
            n = n.parent;
        }
        let result = breadcrumbs.reverse().join(" -- ");
        targetElement.innerHTML = result;
    }


    async renderMermaidMindmap(targetElement, root) {
        let result = ["mindmap\n"];

        function renderNode(n, level) {
            result.push(`${'\t'.repeat(level)}${level==1?"root":""}(${n.title}\n`);
            result.push(`${'\t'.repeat(level)}${n.name}\n`);
            result.push(`${'\t'.repeat(level)}${n.overallstructuretotal.toFixed(0)} / ${n.grouptotal.toFixed(0)} / ${n.personalvolume})\n`);
            if(n.titleObject?.icon) {
                result.push(`${'\t'.repeat(level)}::icon(${n.titleObject.icon})\n`);
            }
            result.push(`${'\t'.repeat(level)}:::n${n.id} ${n.titleObject?.name ?? ""}\n`);
        }
        function renderStyles(n, level) {
            document.styleSheets[0].insertRule(`.n${n.id} {fill: hsl(${n.hue}, ${n.saturation}%, ${n.light}%);}`);
        }

        function calcHueSpans(node, level=0) {
            let parentWithSpan = node;
            if (level==0) {
                node.hueSpan = 360;
                parentWithSpan = node;
            }

            while (!parentWithSpan.hueSpan) parentWithSpan = parentWithSpan.parent

            for (let child of node.children) {
                if (child.isDirector()) {
                    child.hueSpan = Math.ceil( 0.8 * utils.mapValue(
                        child.overallstructuretotal,
                        [0, parentWithSpan.overallstructuretotal],
                        [0, parentWithSpan.hueSpan]
                    ));
                }
            }
            
            for (let child of node.children){
                calcHueSpans(child, level+1);
            }
        }

        function calcHueRanges(node, level=0) {
            let parentWithRange = node;
            if (level==0) {
                node.hueRange = [0, node.hueSpan];
                parentWithRange = node;
            }

            while (!parentWithRange.hueRange) parentWithRange = parentWithRange.parent

            let directorChildren = [];
            function findChildDirectors(n) {
                for (let c of n.children) {
                    if (c.isDirector()) {
                        directorChildren.push(c);
                        continue;
                    }
                    findChildDirectors(c);
                }
            }
            findChildDirectors(node);

            let even = false;
            let range = parentWithRange.hueRange.slice();
            for (let child of directorChildren) {
                if (even) {
                    child.hueRange = [range[0], range[0]+child.hueSpan];
                    range[0] += child.hueSpan;
                } else {
                    child.hueRange = [range[1]-child.hueSpan, range[1]];
                    range[1] -= child.hueSpan;
                }
                even = !even;
            }

            for (let director of directorChildren) {
                calcHueRanges(director, level+1);
            }
        }

        function assignColors(node, level=0) {
            if (!node.parent || level==0) {
                node.hue = 0;
                node.saturation = 0;
                node.light = 0;
            }
            else if(node.isDirector()) {
                node.hue = Math.ceil( node.hueRange[0] + (node.hueRange[1] - node.hueRange[0])/2 );
                node.saturation = utils.mapValue(
                    node.titleObject.order, 
                    [Member.directorOrder, Math.max(...Member.order.map(o=>o.order))],
                    [50, 100]);
                node.light = 50;
            }
            else {
                node.hue = node.parent.hue;
                node.saturation = node.parent.saturation / 2;
                node.light = 60;
            }

            for (let c of node.children) {
                assignColors(c, level+1);
            }
        }
        calcHueSpans(root);
        calcHueRanges(root);
        assignColors(root);
        utils.traverse(root, renderNode, 1);

        let svgCode = await mermaid.render('mindmap', result.join(''))
        targetElement.innerHTML = svgCode.svg;
        
        targetElement.querySelector("style").remove();
        utils.traverse(root, renderStyles, 1);
    }

    renderNoOrders(targetElement, root) {
        let result = ["<ul>"];
        utils.traverse(root, function rendercard(node, level) {
            if(level > 0){
                result.push("<li>");
                result.push(`<i class="${node.parent.titleObject?.icon}"></i> <a href="#${node.parent.id}">${node.parent.name}</a> - `);
                result.push(`<i class="${node.titleObject?.icon}"></i> <a href="#${node.id}">${node.name}</a>: `);
                result.push(`${node.monthNoVolume} m`);
                result.push("</li>");
            }
            for (let c of node.children) {
                rendercard(c, level+1);
            }
        });
        result.push("</ul>");
        targetElement.innerHTML = result.join("");
    }

}