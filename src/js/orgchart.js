import * as utils from "./utils.js"
import { getTranslator } from "./translator.js";
import Member from "./member.js";
const T = await getTranslator();


export default class OrgChart {
  constructor(templateNode) {
    this.templateNode = templateNode;
    let chart = new d3.OrgChart();
    this.chart = chart;
    
    this.chart
    .nodeHeight((d)=>140)
    // .nodeWidth((d)=>270)
    .childrenMargin((d) => 50)
    .compactMarginBetween((d) => 30)
    .compactMarginPair((d) => 50)
    .neighbourMargin((a, b) => 25)
    .siblingsMargin((d) => 25)
    .buttonContent(({ node, state }) => {
      return `<div style="px;color:#716E7B;border-radius:5px;padding:4px;font-size:10px;margin:auto auto;background-color:white;border: 1px solid #E4E2E9">
        <span style="font-size:9px">${node.children
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
          d.data._upToTheRootHighlighted ? 3 : 1
        );

      if (d.data._upToTheRootHighlighted) {
        d3.select(this).raise();
      }
      //   chart.fit()
    })
    .nodeContent(function (d, i, arr, state) {
      if (i==0) {
        d._expanded = true;
        chart.expandSomeNodes(d);
      }
     return OrgChart.renderCard(d);
    })
    .onNodeClick(function(d) {
      location.hash = d.data.id;
    });
    this.chart.layoutBindings().top.linkY = (n) => n.y - 24;

  }

  render(root, activeBranch) {
    let flat = Member.flattenTree(root);
    this.chart.container(this.templateNode).data(flat);
    if (activeBranch !== root) {
      this.chart.clearHighlighting();
      this.chart.setUpToTheRootHighlighted(activeBranch.id).setCentered(activeBranch.id);
    }

    this.chart.render();
  }
    
    
    static renderCard(d) {
      return `
          <div class="orgchartCard ${d.data.parent?"":"rootNode"}"
            style="border-color:hsl(${d.data.hue}, ${d.data.saturation}%, ${d.data.light}%);
              background-color:hsl(${d.data.hue}, ${d.data.saturation/5 }%, ${d.data.light}%); width:${d.width}px; height:${d.height}px;">
              
            <div class="header">
              <div class="orgchartCardIconContainer" style="background-color:#FFFFFF;">
                <i class="orgchartCardIcon ${d.data.titleObject?.icon}"></i>
              </div>
              <div class="name">
                <div class="orgchartCardName">${d.data.name}</div>
                <div class="orgchartCardTitle">${d.data.fullTitle()}</div>
              </div>
            </div>
            <div class="body">
              <div>${d.data.unpayedOrders ? T.cardUnpayedOrders +": "+d.data.unpayedOrders:""}</div>
              <div>${d.data.personalvolume ? T.cardPersonalVolume +": "+d.data.personalvolume:""}</div>
              <div>${d.data.grouptotal ? T.cardGrouptotal +": "+d.data.grouptotal.toFixed(0):""}</div>
              <div>${d.data.overallstructuretotal ? T.cardOverallstructuretotal +": "+d.data.overallstructuretotal.toFixed(0):""}</div>
              <div>${d.data.monthNoVolume > 0 ? T.cardMonthNoOrder(d.data.monthNoVolume):""}</div>
            </div>
          </div>`;
   }
}
