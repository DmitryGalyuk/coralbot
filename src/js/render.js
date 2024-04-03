import Member from "./member.js";
import * as utils from './utils.js'
import Spinner from "./spinner.js";
import Breadcrumbs from "./breadcrumbs.js";
import Mindmap from "./mindmap.js";
import Treeview from "./treeview.js";

import { getTranslator } from "./translator.js";
const T = await getTranslator();

export default class Renderer {
    constructor(mindmapId = "mm", breadcrumbsId = "breadcrumbs", orgchartId = "orgchart", treeviewId = "navTree") {
        this.linkMaxWidth = 50;

        this.breadcrumbs = new Breadcrumbs(document.getElementById(breadcrumbsId));
        this.mindmap = new Mindmap(document.getElementById(mindmapId));
        this.treeview = new Treeview(document.getElementById(treeviewId));

        let dark = false;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            dark = true;
        }

        mermaid.initialize({
            startOnLoad: true,
            htmlLabels: true,
            maxTextSize: 9000000,
            darkMode: dark,
            mindmap: {
                useMaxWidth: true
            }
        });

    }

    colorize(root) {
        Renderer.calcHueSpans(root);
        Renderer.calcHueRanges(root);
        Renderer.assignColors(root);
        this.colored = true;
    }

    async renderData(root, filteredNodes, selectedNode) {
        await Spinner.show(T.spinnerDrawing);
        if (!root || !filteredNodes) return;

        if (!this.colored) {
            this.colorize(root)
        }
        
        utils.traverse(root, (n)=>{
            n.children.sort((a,b)=>b.overallstructuretotal - a.overallstructuretotal)
        });

        this.breadcrumbs.render(root, selectedNode);
        this.mindmap.render(root, filteredNodes, selectedNode);
        this.treeview.render(root);
        Spinner.close();
    };

    static calcHueSpans(node, level=0) {
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
            Renderer.calcHueSpans(child, level+1);
        }
    }

    static calcHueRanges(node, level=0) {
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
            Renderer.calcHueRanges(director, level+1);
        }
    }

    static assignColors(node, level=0) {
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
            Renderer.assignColors(c, level+1);
        }
    }
}