import Member from "./member.js";
import * as utils from './utils.js'
import Spinner from "./spinner.js";
import Breadcrumbs from "./breadcrumbs.js";
import FlowDiagram from "./flowDiagram.js";
import Mindmap from "./mindmap.js";

import { getTranslator } from "./translator.js";
const T = await getTranslator();

export default class Renderer {
    constructor(flowchartId, mindmapId, breadcrumbsId, orgchartId) {
        this.linkMaxWidth = 50;
        this.orgchartId = orgchartId;

        this.breadcrumbs = new Breadcrumbs(document.getElementById(breadcrumbsId));
        this.flowDiagram = new FlowDiagram(document.getElementById(flowchartId), mermaid);
        this.mindmap = new Mindmap(document.getElementById(mindmapId));

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

        // Add a click event listener to the document
        document.addEventListener('click', this.mindmap.getClickHandler());
    }

    async renderData(root, activeBranch) {
        if (!activeBranch) return;
        
        await Spinner.show(T.spinnerDrawing);
        await Promise.all([
            this.flowDiagram.render(activeBranch),
            this.breadcrumbs.render(root, activeBranch),
            this.mindmap.render(activeBranch),
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