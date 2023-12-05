import Member from "./member.js";
import * as utils from './utils.js'
import Spinner from "./spinner.js";
import Breadcrumbs from "./breadcrumbs.js";
import FlowDiagram from "./flowDiagram.js";
import Mindmap from "./mindmap.js";
import OrgChart from "./orgchart.js";

import { getTranslator } from "./translator.js";
const T = await getTranslator();

export default class Renderer {
    constructor(flowchartId, mindmapId, breadcrumbsId, orgchartId) {
        this.linkMaxWidth = 50;

        this.breadcrumbs = new Breadcrumbs(document.getElementById(breadcrumbsId));
        this.flowDiagram = new FlowDiagram(document.getElementById(flowchartId), mermaid);
        this.mindmap = new Mindmap(document.getElementById(mindmapId));
        this.orgchart = new OrgChart(document.getElementById(orgchartId));

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
        
        utils.traverse(root, (n)=>{
            n.children.sort((a,b)=>b.overallstructuretotal - a.overallstructuretotal)
        });

        // await Spinner.show(T.spinnerDrawing);
        // await Promise.all([
            // this.flowDiagram.render(activeBranch),
            this.breadcrumbs.render(root, activeBranch),
            this.mindmap.render(activeBranch),
            this.orgchart.render(root)
        // ])
        // .catch(e => { 
        //     console.error(e);
        //     throw e; }
        // );
        // Spinner.close();

    };
}