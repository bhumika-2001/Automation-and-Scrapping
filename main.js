//node main.js --config=config.json --url="https://internshala.com" --excel=internships.csv

let minimist = require("minimist");
let puppeteer = require("puppeteer");
let fs = require("fs");
let axios = require("axios");
let jsdom = require("jsdom");
let excel = require("excel4node");


let args = minimist(process.argv);

let configJSON = fs.readFileSync(args.config, "utf-8");
let configJSO = JSON.parse(configJSON);
let internship = [];
async function run() {
    let browser = await puppeteer.launch({
        headless: false,
        args: [
            '--start-maximized'
        ],
        defaultViewport: null
    });
    let page = await browser.pages();
    let pages = page[0];
    await pages.goto(args.url);

    await pages.waitForSelector("li.nav-item > button[data-target='#login-modal']");
    await pages.click("li.nav-item > button[data-target='#login-modal']");

    await pages.waitForSelector("div.form-group > input[type = 'email']");
    await pages.type("div.form-group > input[type = 'email']", configJSO.email);

    await pages.waitForSelector("div.form-group > input[type = 'password']");
    await pages.type("div.form-group > input[type = 'password']", configJSO.password);

    await pages.waitForSelector("div.form-group > button[type = 'submit']");
    await pages.click("div.form-group > button[type = 'submit']");

    await pages.waitFor(5000);
    await pages.waitForSelector("div.browse_container > a[href='/internships']");
    await pages.click("div.browse_container > a[href='/internships']");

    await pages.waitFor(3000);

    await pages.waitForSelector("div.category_container.form-group > div#categoryOptions > div.chosen-container.chosen-container-multi > ul.chosen-choices > li.search-field > input.chosen-search-input");
    await pages.type("div.category_container.form-group > div#categoryOptions > div.chosen-container.chosen-container-multi > ul.chosen-choices > li.search-field > input.chosen-search-input", "   " + configJSO.category, { delay: 200 });
    await pages.keyboard.press("Enter");
    await pages.waitFor(3000);
    await pages.waitForSelector("div.location_container.form-group  > div#cityOptions > div.chosen-container.chosen-container-multi > ul.chosen-choices > li.search-field > input.chosen-search-input");
    await pages.type("div.location_container.form-group  > div#cityOptions > div.chosen-container.chosen-container-multi > ul.chosen-choices > li.search-field > input.chosen-search-input", "   " + configJSO.location, { delay: 200 });

    await pages.keyboard.press("Enter");
    await pages.waitFor(3000);

    let ele = await pages.waitForSelector("#total_pages");
    let numPages = await pages.$eval("#total_pages", function (atag) {
        return atag.innerText;

    });
    let links = [];
    let url = await pages.url();
    for (let i = 1; i <= numPages; i++) {
        let temp = url;
        temp = temp + "/page-" + i;
        links.push(temp);
    }

    await getData(links, internship, pages, browser);
    console.log(".................................PREPARING EXCEL SHEET.............................................");

    await createExcelFile(internship);
}

async function getData(links, internship, pages, browser) {
 
    for (let i = 0; i < links.length; i++) {
        let cpage = await pages.goto(links[i]);
        let promise = axios.get(links[i]);
        promise.then(function (response) {
            let html = response.data;
            let dom = new jsdom.JSDOM(html);
            let document = dom.window.document;
            let dataDivs = document.querySelectorAll(".container-fluid.individual_internship");

            for (let j = 1; j < dataDivs.length; j++) {
                let data = {
                    cName: "",
                    duration: "",
                    stipend: "",
                    applyBy: ""

                };

                let innerdiv = dataDivs[j].querySelectorAll("div.other_detail_item");
                let time = innerdiv[1].querySelector("div.item_body");
                data.duration = time.textContent;


                let companyName = dataDivs[j].querySelector("div.company > div.heading_6.company_name > a.link_display_like_text");
                data.cName = companyName.textContent;



                let money = dataDivs[j].querySelector("span.stipend");
                data.stipend = money.textContent;

                let lastDate = dataDivs[j].querySelector("div.other_detail_item.apply_by > div.item_body");
                data.applyBy = lastDate.textContent;

                internship.push(data);
            }

        });

    }
    browser.close();





}
run();
async function createExcelFile(internship) {
    let wb = new excel.Workbook();
    let sheet = wb.addWorksheet("internships");

    let mystyle = wb.createStyle({

        font: {
            bold: true
        }
    });

    sheet.column(1).setWidth(40);
    sheet.column(2).setWidth(20);
    sheet.column(3).setWidth(20);
    sheet.column(4).setWidth(20);

    sheet.cell(1, 1).string("COMPANY NAME").mystyle;
    sheet.cell(1, 2).string("DURATION").mystyle;
    sheet.cell(1, 3).string("STIPEND").mystyle;
    sheet.cell(1, 4).string("APPLY BY"), mystyle;
    for (let i = 0; i < internship.length; i++) {
        sheet.cell(2 + i, 1).string(internship[i].cName);
        sheet.cell(2 + i, 2).string(internship[i].duration);
        sheet.cell(2 + i, 3).string(internship[i].stipend);
        sheet.cell(2 + i, 4).string(internship[i].applyBy);
    }

    wb.write(args.excel);
}