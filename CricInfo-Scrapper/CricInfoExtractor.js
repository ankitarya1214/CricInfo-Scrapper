// npm init -y
// npm install minimist
// npm install axios
// npm install jsdom
// npm install excel4node
// npm install pdf-lib
// node .\CricInfoExtractor.js --excel=Worldcup.csv --dataFolder=WorldCup --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results

let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let excel = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");
let path = require("path");


let args = minimist(process.argv);

// convert matches to teams
// save teams to excel using excel4node
// create folders and save pdf using pdf-lib

let respomsePromise = axios.get(args.source);
respomsePromise.then(function (response) {
    let html = response.data;

    let dom = new jsdom.JSDOM(html);
    let document = dom.window.document;

    let matchScoreDivs = document.querySelectorAll("div.match-score-block");
    let matches = [];

    for (let i = 0; i < matchScoreDivs.length; i++) {
        let match = {
            t1: "",
            t2: "",
            t1s: "",
            t2s: "",
            result: ""
        };

        let teamName = matchScoreDivs[i].querySelectorAll("div.name-detail > p.name");
        match.t1 = teamName[0].textContent;
        match.t2 = teamName[1].textContent;

        let scoreSpans = matchScoreDivs[i].querySelectorAll("div.score-detail > span.score");

        if (scoreSpans.length == 2) {
            match.t1s = scoreSpans[0].textContent;
            match.t2s = scoreSpans[1].textContent;
        } else if (scoreSpans.length == 1) {
            match.t1s = scoreSpans[0].textContent;
            match.t2s = "";
        } else {
            match.t1s = "";
            match.t2s = "";
        }

        let resultSpan = matchScoreDivs[i].querySelector("div.status-text > span");
        match.result = resultSpan.textContent;

        matches.push(match);
    }

    let matchesJSON = JSON.stringify(matches);
    fs.writeFileSync("matches.json", matchesJSON, "utf-8");

    let teams = [];
    for (let i = 0; i < matches.length; i++) {
        addTeamsToTeamArray(teams, matches[i].t1);
        addTeamsToTeamArray(teams, matches[i].t2);
    }

    for (let i = 0; i < matches.length; i++) {
        addTeamsToSpecificTeams(teams, matches[i].t1, matches[i].t2, matches[i].t1s, matches[i].t2s, matches[i].result);
        addTeamsToSpecificTeams(teams, matches[i].t2, matches[i].t1, matches[i].t2s, matches[i].t1s, matches[i].result);
    }

    let teamsJSON = JSON.stringify(teams);
    fs.writeFileSync("teams.json", teamsJSON, "utf-8");

    prepareExcel(teams, args.excel);
    prepareFolderAndPdf(teams, args.dataFolder);
})

function prepareFolderAndPdf(teams, dataDir) {
    fs.mkdirSync(dataDir);
    for (let i = 0; i < teams.length; i++) {
        let teamName = path.join(dataDir, teams[i].name);
        fs.mkdirSync(teamName);

        for (let j = 0; j < teams[i].matches.length; j++) {
            let matchFileName = path.join(teamName, teams[i].matches[j].vs + ".pdf");
            createScoreCard(teams[i].name, teams[i].matches[j], matchFileName);
        }
    }
}
function createScoreCard(teamName, matches, matchFileName) {

    let pdfBytesTemplate = fs.readFileSync("Template.pdf");
    let pdfDocPromise = pdf.PDFDocument.load(pdfBytesTemplate);
    pdfDocPromise.then(function(pdfdoc) {
        let pages = pdfdoc.getPage(0);

        pages.drawText(teamName, {
            x: 320,
            y: 690,
            size: 8
        });
        pages.drawText(matches.vs, {
            x: 320,
            y: 677,
            size: 8
        });
        pages.drawText(matches.selfScore, {
            x: 320,
            y: 662,
            size: 8
        });
        pages.drawText(matches.oppScore, {
            x: 320,
            y: 647,
            size: 8
        });
        pages.drawText(matches.result, {
            x: 320,
            y: 634,
            size: 8
        });

        let finalPDFBytesKaPromise = pdfdoc.save();
        finalPDFBytesKaPromise.then(function (finalPDFBytes) {
            fs.writeFileSync(matchFileName, finalPDFBytes);
        })
    })
}
function addTeamsToTeamArray(teams, teamName) {
    let tidx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == teamName) {
            tidx = i;
            break;
        }
    }

    if (tidx == -1) {
        teams.push({
            name: teamName,
            matches: []
        })
    }
}


function addTeamsToSpecificTeams(teams, homeTeam, oppTeam, selfScore, oppScore, result) {
    let tidx = -1;
    for (let i = 0; i < teams.length; i++) {
        if (teams[i].name == homeTeam) {
            tidx = i;
            break;
        }
    }

    let team = teams[tidx];
    team.matches.push({
        vs: oppTeam,
        selfScore: selfScore,
        oppScore: oppScore,
        result: result
    })
}

function prepareExcel(teams, excelFile) {
    let wb = new excel.Workbook();

    for (let i = 0; i < teams.length; i++) {
        let sheet = wb.addWorksheet(teams[i].name);

        sheet.cell(1, 1).string("Vs");
        sheet.cell(1, 2).string("Self Score");
        sheet.cell(1, 3).string("Opponent Score");
        sheet.cell(1, 4).string("Result");

        for (let j = 0; j < teams[i].matches.length; j++) {
            sheet.cell(j + 2, 1).string(teams[i].matches[j].vs);
            sheet.cell(j + 2, 2).string(teams[i].matches[j].selfScore);
            sheet.cell(j + 2, 3).string(teams[i].matches[j].oppScore);
            sheet.cell(j + 2, 4).string(teams[i].matches[j].result);
        }
    }

    wb.write(excelFile);
}

