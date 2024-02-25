import ReportParses from '/js/parser.js'
import Renderer from '/js/render.js'
import Member from '/js/member.js'
import { Settings } from '/js/utils.js'
import { getTranslator } from "/js/translator.js";
import Spinner from '/js/spinner.js';
import * as coral from '/js/coralserver.js';


let root = undefined;
let selectedNode = undefined;
let renderer = new Renderer();
const T = await getTranslator();

await (async function main() {
    await initTranslation();
    translate();
    populateDates();

    assignEventHandlers();

    if (window.location.search == "?sample") {
        sampleData();
    }
    
})();

function sampleData() {
    fetch("/sample-en.xlsx").then(r=>r.blob()).then(blob => parseUploaded(blob));
}

function assignEventHandlers() {
    window.addEventListener("hashchange", async (e) => await branchChange(e));

    document.getElementById("excelFile").addEventListener('change', async (e) => { await fileChanged(); });
    document.getElementById("btnNoFilter").addEventListener('click', async (e) => {resetFilter(); await render();});
    document.getElementById("loginButton").addEventListener('click', async (e) => { await fetchReport(); });
    document.getElementById("btnUnfoldDirectors").addEventListener('click', (e) => { unfoldDirectors(); });


    let controls = document.querySelectorAll(".filter input, .filter select");
    for (let ctrl of controls){
        ctrl.addEventListener("change", async (e) =>  render());
    }
    
    let mapIcon = document.getElementById("mapIcon");
    let iconOverlay = document.getElementById("iconOverlay");
    let mapDialog = document.getElementById("mapDialog");
    let mapSvg = document.getElementById("mm");
    let breadcrumbsPanel = document.getElementById("breadcrumbsPanel");
    let breadcrumbs = document.getElementById("breadcrumbs");
    let mapCloseButton = document.getElementById("mapCloseButton");

    mapIcon.addEventListener('click', function() {
        mapDialog.appendChild(breadcrumbs);
        mapDialog.appendChild(mapSvg);
        iconOverlay.style.display = 'none'; // Hide overlay in modal
        mapDialog.showModal();
    });

    function mapDialogClose(event) {
        if(event.target === this) {
            mapDialog.close();
            mapIcon.appendChild(mapSvg);
            breadcrumbsPanel.appendChild(breadcrumbs);
            iconOverlay.style.display = 'block'; // Show overlay in icon
        }
    }
    mapDialog.addEventListener('click', mapDialogClose);
    mapDialog.addEventListener('cancel', mapDialogClose);
    mapCloseButton.addEventListener('click', mapDialogClose);
}

function unfoldDirectors() {
    let flattenTree = Member.flattenTree(root);
    flattenTree.forEach(m=>{m._expanded = m.isDirector()});
    renderer.orgchart.render(root, selectedNode);
}

function translate() {
    T.translatePage();

    for (let opt of document.getElementById("selectFilterPointsType").options) {
        opt.text = T[opt.value];
    }
    for (let opt of document.getElementById("reporttype").options) {
        opt.text = T["reportType"+opt.value];
    }
    populateDates();
}

async function initTranslation() {
    let selectLang = document.getElementById("selectLang");
    if (Settings.language) {
        await T.use(Settings.language);
    } else {
        Settings.language = T.currentLanguage;
    }
    T.languages.forEach(l => {
        selectLang.add(new Option(l.name, l.code, l.code == T.currentLanguage, l.code == T.currentLanguage));
    });
    
    selectLang.addEventListener("change", async (e) => {
        Settings.language = e.target.value;
        await T.use(e.target.value);
        translate();
    });
}

async function render() {
    let filteredNodes = filter();
    await Spinner.show(T.spinnerDrawing);
    await renderer.renderData(root, filteredNodes, selectedNode);
    Spinner.close();
}

async function branchChange(event) {
    if (!root) return;

    event.preventDefault(); // Prevent the default action
    if (event.newURL.indexOf("#")) {
        let hash = event.newURL.substring(event.newURL.indexOf("#")+1); // Get the hash and remove the '#'
        if (hash !== "") {
            selectedNode = root.findChild(hash);
        }
    }
    else {
        selectedNode = root;
    }
    render();
}

function filter() {
    let filterMonths = document.getElementById("filterMonths").checked;
    let filterPoints = document.getElementById("filterPoints").checked;
    let filterDirectorsOnly = document.getElementById("filterDirectorsOnly").checked;
    let filterParentDirectors = document.getElementById("filterParentDirectors").checked;
    let filterUnpayedOrders = document.getElementById("filterUnpayedOrders").checked;
    
    let parentPredicate = ()=>true;

    if (!filterMonths && !filterPoints && !filterDirectorsOnly && !filterParentDirectors && !filterUnpayedOrders) {
        return selectedNode;
    }

    let filteredTree = Member.query(root);

    if (filterParentDirectors) {
        parentPredicate = p=>p.isDirector();
        filteredTree = Member.query(filteredTree, n=>true, p=>p.isDirector());
    }

    if (filterDirectorsOnly) {
        // filteredTree = Member.query(filteredTree, n=>n.isDirector(), p=>p.isDirector());
        filteredTree = Member.query(filteredTree, n=>n.isDirector(), p=>true);
    }

    if (filterUnpayedOrders) {
        filteredTree = Member.query(filteredTree, n=>n.unpayedOrders>0);
    }


    if (filterMonths) {
        let monthsFrom = document.getElementById("filterMonthsFrom").value || 0;
        let monthsTo = document.getElementById("filterMonthsTo").value || Infinity;
    
        filteredTree = Member.query(filteredTree, 
            n => monthsFrom <= n.monthNoVolume && n.monthNoVolume <= monthsTo,
            parentPredicate)
    }

    if (filterPoints) {
        let pointsFrom = document.getElementById("filterPointsFrom").value || 0;
        let pointsTo = document.getElementById("filterPointsTo").value || Infinity;
        let pointsFilterType = document.getElementById("selectFilterPointsType").value;
        let property = pointsFilterType == "pointsPersonal" ? "personalvolume"
            : pointsFilterType == "pointsGroup" ? "grouptotal"
            : pointsFilterType == "pointsOverall" ? "overallstructuretotal" : undefined;

        filteredTree =  Member.query(filteredTree, n => {
                return pointsFrom <= n[property] && n[property] <= pointsTo;
            },
            parentPredicate);
    }
    return filteredTree;
}

function resetFilter() {
    let checkboxes = document.querySelectorAll("form input[type=checkbox]");
    checkboxes.forEach(c=>c.checked=false);
}

async function fileChanged() {
    renderer = new Renderer();
    await parseUploaded(document.querySelector('#excelFile').files[0]);
}

async function fetchReport() {
    renderer = new Renderer();
    let login = document.getElementById("login").value;
    let password = document.getElementById("password").value;
    let reporttype = document.getElementById("reporttype").value;
    let period = document.getElementById("period").value;

    Spinner.show(T.spinnerFetchingFile)
    let report;
    let apiUrl;
    if (window.location.host == "coralometer.galyuk.com") {
        apiUrl = "https://coralreportfetch.azurewebsites.net/api/coralReportFetch";
    } else {
        apiUrl = "http://localhost:7071/api/coralReportFetch";
    }
    
    report = await fetch(apiUrl, {
            method: "POST",
            body: JSON.stringify({
                login: login,
                password: password,
                lang: coral.lang2coralDomain[Settings.language],
                reporttype: coral.reportTypePrefix(period) + reporttype,
                period: coral.coralPeriod(period)
            })
        }
    );
    Spinner.close();
    await parseUploaded(report.blob());
}


async function parseUploaded(file) {
    await Spinner.show(T.spinnerReadingFile);
    location.hash = "";
    document.getElementById("spanParseFailed").textContent = "";

    let parser;
    const langQueue = [Settings.language,  ...T.languages.filter(l=>l.code!=Settings.language).map(l=>l.code)];
    for (let lang of langQueue) {
        try {
            await T.use(lang);
            parser = new ReportParses(file, lang);
            root = selectedNode = await parser.parseExcel();

            renderer.colorize(root);
            await render();
            // renderer.orgchart.unfoldDirectors();
            return;
        }
        catch (e) {
            console.error(e);
        }
    }
    T.use(Settings.language);
    document.querySelector('#excelFile').value = null;
    document.getElementById("spanParseFailed").textContent = T.parseFailedMessage("dmitry@galyuk.com");
}

function populateDates() {
    let periodSelect = document.getElementById("period");
    while(periodSelect.options.length > 0) {
        periodSelect.remove(0);
    }
    periodSelect
    const now = new Date();
    for(let i=0; i<5; i++) {
        periodSelect.add(new Option(
            now.toLocaleDateString(Settings.language, { month: "long" }) + " " + now.getFullYear(), 
            now.toUTCString()
            )
        );
        now.setMonth(now.getMonth()-1);
    }
}