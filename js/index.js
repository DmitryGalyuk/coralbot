import ReportParses from '/js/parser.js'
import Renderer from '/js/render.js'
import Member from '/js/member.js'
import { Settings } from '/js/utils.js'
import { getTranslator } from "/js/translator.js";


let root = undefined;
let branch = undefined;
let renderer = new Renderer("diagram", "mm", "breadcrumbs");
const T = await getTranslator();

await (async function main() {
    await initTranslation();
    translate();

    assignEventHandlers();
})();



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

function branchChange(event) {
    event.preventDefault(); // Prevent the default action
    if (event.newURL.indexOf("#")) {
        let hash = event.newURL.substring(event.newURL.indexOf("#")+1); // Get the hash and remove the '#'
        if (hash !== "") {
            branch = root.findChild(hash);
            // branch.parentId = undefined;
            // branch.parent = undefined;
        }
    }
    else {
        branch = root;
    }
    renderer.currentBranch = branch;
    renderer.renderData(branch);
}

function filter() {
    let filterMonths = document.getElementById("filterMonths").checked;
    let filterPoints = document.getElementById("filterPoints").checked;
    let filterDirectorsOnly = document.getElementById("filterDirectorsOnly").checked;
    let filterParentDirectors = document.getElementById("filterParentDirectors").checked;

    let parentPredicate = ()=>true;

    if (!filterMonths && !filterPoints && !filterDirectorsOnly && !filterParentDirectors) {
        renderer.renderData(branch);
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
    renderer.renderData(filteredTree);    
}
function resetFilter() {
    let checkboxes = document.querySelectorAll("form input[type=checkbox]");
    checkboxes.forEach(c=>c.checked=false);
    renderer.renderData(branch);
}

function assignEventHandlers() {
    window.addEventListener("hashchange", branchChange);

    document.getElementById("excelFile").addEventListener('change', parseUploaded);
    document.getElementById("btnNoFilter").addEventListener('click', resetFilter);

    let controls = document.querySelectorAll("form input, form select, form button");
    for (let ctrl of controls){
        ctrl.addEventListener(ctrl.tagName == "BUTTON" ? "click" : "change", filter);
    }
    
}

async function parseUploaded() {
    location.hash = "";
    document.getElementById("spanParseFailed").textContent = "";

    let lang = Settings.language;
    const file = document.querySelector('#excelFile').files[0];
    let parser;
    try {
        parser = new ReportParses(file, lang);
        root = branch = await parser.parseExcel();
    }
    catch {
        document.querySelector('#excelFile').value = null;
        document.getElementById("spanParseFailed").textContent = T.parseFailedMessage("dmitry@galyuk.com");
        return;
    }
    renderer.dataRoot = root;
    renderer.currentBranch = root;

    renderer.renderData(root);
}

function translate() {
    T.translatePage();

    for (let opt of document.getElementById("selectFilterPointsType").options) {
        opt.text = T[opt.value];
    }
}