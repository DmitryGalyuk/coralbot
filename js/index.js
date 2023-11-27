import ReportParses from '/js/parser.js'
import Renderer from '/js/render.js'
import Member from '/js/member.js'
import { Settings } from '/js/utils.js'
import { getTranslator } from "/js/translator.js";
import Spinner from '/js/spinner.js';


let root = undefined;
let branch = undefined;
let renderer = new Renderer("diagram", "mm", "breadcrumbs", "orgchart");
const T = await getTranslator();

await (async function main() {
    await initTranslation();
    translate();

    assignEventHandlers();

    if (window.location.search == "?sample") {
        sampleData();
    }
})();

function sampleData() {
    fetch("/sample-en.xlsx").then(r=>r.blob()).then(blob => parseUploaded(blob));
}

function assignEventHandlers() {
    // window.addEventListener("hashchange", branchChange);
    window.addEventListener("hashchange", async (e) => await branchChange(e));

    document.getElementById("excelFile").addEventListener('change', fileChanged);
    document.getElementById("btnNoFilter").addEventListener('click', async (e) => resetFilter(e));

    let controls = document.querySelectorAll("form input, form select, form button");
    for (let ctrl of controls){
        ctrl.addEventListener(ctrl.tagName == "BUTTON" ? "click" : "change", filter);
    }
    
}

function translate() {
    T.translatePage();

    for (let opt of document.getElementById("selectFilterPointsType").options) {
        opt.text = T[opt.value];
    }
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

async function branchChange(event) {
    event.preventDefault(); // Prevent the default action
    if (event.newURL.indexOf("#")) {
        let hash = event.newURL.substring(event.newURL.indexOf("#")+1); // Get the hash and remove the '#'
        if (hash !== "") {
            branch = root.findChild(hash);
        }
    }
    else {
        branch = root;
    }
    renderer.currentBranch = branch;
    await Spinner.show(T.spinnerDrawing);
    await renderer.renderData(root, branch);
    Spinner.close();
}

async function filter() {
    await Spinner.show(T.spinnerCalculating);
    let filterMonths = document.getElementById("filterMonths").checked;
    let filterPoints = document.getElementById("filterPoints").checked;
    let filterDirectorsOnly = document.getElementById("filterDirectorsOnly").checked;
    let filterParentDirectors = document.getElementById("filterParentDirectors").checked;
    let filterUnpayedOrders = document.getElementById("filterUnpayedOrders").checked;

    let parentPredicate = ()=>true;

    if (!filterMonths && !filterPoints && !filterDirectorsOnly && !filterParentDirectors && !filterUnpayedOrders) {
        renderer.renderData(root, branch);
        return;
    }

    let filteredTree = Member.query(branch);

    if (filterParentDirectors) {
        parentPredicate = p=>p.isDirector();
        filteredTree = Member.query(filteredTree, n=>true, p=>p.isDirector());
    }

    if (filterDirectorsOnly) {
        filteredTree = Member.query(filteredTree, n=>n.isDirector(), p=>p.isDirector());
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
    await Spinner.show(T.spinnerDrawing);
    await renderer.renderData(root, filteredTree);    
    Spinner.close();
}

async function resetFilter() {
    let checkboxes = document.querySelectorAll("form input[type=checkbox]");
    checkboxes.forEach(c=>c.checked=false);
    
    await Spinner.show(T.spinnerDrawing);
    await renderer.renderData(root, branch);    
    Spinner.close();
}

function fileChanged() {
    parseUploaded(document.querySelector('#excelFile').files[0]);
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
            root = branch = await parser.parseExcel();

            await Spinner.show(T.spinnerDrawing);
            await renderer.renderData(root, root);
            return;
        }
        catch (e) {
            console.error(e);
            Spinner.close();
        }
    }
    document.querySelector('#excelFile').value = null;
    document.getElementById("spanParseFailed").textContent = T.parseFailedMessage("dmitry@galyuk.com");

    Spinner.close();
}
