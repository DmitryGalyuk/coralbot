import ReportParses from '/js/parser.js'
import Renderer from '/js/render.js'
import Member from '/js/member.js'
import { Settings } from '/js/utils.js'
import { getTranslator } from "/js/translator.js";


let root = undefined;
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

function filter() {
    let from = document.getElementById("filterFrom").value || 0;
    let to = document.getElementById("filterTo").value || Infinity;
    let filterType = document.getElementById("selectFilterType").value;

    if (filterType.startsWith("points")) {
        let property = filterType == "pointsPersonal" ? "personalvolume"
            : filterType == "pointsGroup" ? "grouptotal"
            : filterType == "pointsOverall" ? "overallstructuretotal" : undefined;

        renderer.renderData( Member.query(root, n => {
            return from <= n[property] && n[property] <= to;
        }, p => p.isDirector()));
    }
}

function assignEventHandlers() {
    document.getElementById("excelFile").addEventListener('change', parseUploaded);
    
    document.getElementById("btnDirectorsOnly").addEventListener("click", () =>
        renderer.renderData(Member.query(root, n => n.isDirector(), p => p.isDirector())));
    // document.getElementById("btnMastersOnly").addEventListener("click", ()=>
    //     renderer.renderData( Member.query(root, n=>n.isMaster(), p=>p.isMaster())));
    document.getElementById("btnNoOrders").addEventListener("click", () =>
        renderer.renderData(Member.query(root, n => 1 < n.monthNoVolume && n.monthNoVolume < 4, p => p.isDirector())));
    document.getElementById("btnNoFilter").addEventListener("click", () =>
        renderer.renderData(root));

    document.getElementById("btnFilter").addEventListener("click", filter);
    
}

async function parseUploaded() {
    location.hash = "";
    document.getElementById("spanParseFailed").textContent = "";

    let lang = Settings.language;
    const file = document.querySelector('#excelFile').files[0];
    let parser;
    try {
        parser = new ReportParses(file, lang);
        root = await parser.parseExcel();
    }
    catch {
        document.querySelector('#excelFile').value = null;
        document.getElementById("spanParseFailed").textContent = T.parseFailedMessage("dmitry@galyuk.com");
        return;
    }
    renderer.dataRoot = root;

    renderer.renderData(root);
}

function translate() {
    document.getElementById("spanSelectFile").textContent = T.selectFile;
    document.getElementById("btnDirectorsOnly").textContent = T.directorsOnly;
    // document.getElementById("btnMastersOnly").textContent = T.mastersOnly;
    document.getElementById("btnNoOrders").textContent = T.noOrdersXMonths(3);
    document.getElementById("btnNoFilter").textContent = T.showFullStructure;
    
    document.getElementById("spanFilterFrom").textContent = T.spanFilterFrom;
    document.getElementById("spanFilterTo").textContent = T.spanFilterTo;
    document.getElementById("btnFilter").textContent = T.btnFilter;
    for (let opt of document.getElementById("selectFilterType").options) {
        opt.text = T[opt.value];
    }


    // document.getElementById("").textContent = T.;


}