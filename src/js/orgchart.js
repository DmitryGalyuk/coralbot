import Member from "./member.js";
import * as utils from "./utils.js"

export default class OrgChart {
  constructor(templateNode) {
    this.templateNode = templateNode;
  }

  render(node) {
    let flat = utils.flattenTree(node);
    let chart = new d3.OrgChart();

    chart.layoutBindings().top.linkY = (n) => n.y - 24;

    chart
      // .nodeHeight((d) => 85)
      // .nodeWidth((d) => {
      //   return 220;
      // })
      // .svgHeight(d=>"100%")
      // .svgWidth(d=>"100%")
      // .compact(false)
      .childrenMargin((d) => 50)
      .compactMarginBetween((d) => 25)
      .compactMarginPair((d) => 50)
      .neighbourMargin((a, b) => 25)
      .siblingsMargin((d) => 25)
      .buttonContent(({ node, state }) => {
        return `<div style="px;color:#716E7B;border-radius:5px;padding:4px;font-size:10px;margin:auto auto;background-color:white;border: 1px solid #E4E2E9"> <span style="font-size:9px">${node.children
            ? `<i class="fas fa-angle-up"></i>`
            : `<i class="fas fa-angle-down"></i>`
          }</span> ${node.data._directSubordinates}  </div>`;
      })
      .linkUpdate(function (d, i, arr) {
        d3.select(this)
          .attr('stroke', (d) =>
            // d.data._upToTheRootHighlighted ? '#152785' : '#E4E2E9'
            d.data._upToTheRootHighlighted ? '#ff0000' : '#E4E2E9'
          )
          .attr('stroke-width', (d) =>
            d.data._upToTheRootHighlighted ? 15 : 1
          );

        if (d.data._upToTheRootHighlighted) {
          d3.select(this).raise();
          window.location.hash = d.data.id;
        }
        //   chart.fit()
      })
      .nodeContent(function (d, i, arr, state) {
        if (d.data.id == node.id) {
          d._expanded = true;
          chart.expandSomeNodes(d);
        }
       return OrgChart.renderCard(d);
      });
      chart.container(this.templateNode).data(flat).render();//.expandAll().fit();
    }
    
    
    static renderCard(d) {
      const color = '#FFFFFF';
      return `
          <div class="orgchartCard" style="background-color:${color}; width:${d.width}px; height:${d.height}px;">
              <div class="orgchartCardIconContainer" style="background-color:${color};"
              ><i class="orgchartCardIcon ${d.data.titleObject?.icon}"></i></div>
              
            <div style="color:#08011E;position:absolute;right:20px;top:17px;font-size:10px;"><i class="fas fa-ellipsis-h"></i></div>

            <div class="orgchartCardName">${d.data.name} </div>
            <div class="orgchartCardTitle">${d.data.fullTitle()} </div>
          </div>`;
   }
}