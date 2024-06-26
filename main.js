const puppeteer = require('puppeteer');
const proxyChain = require('proxy-chain');
const fs = require('fs');
const readline = require('readline');

const proxys = fs.readFileSync('proxy.txt', 'utf8').split('\n');
const checkProxy = async (proxy) => {
    try{
    const aproxy = await proxyChain.anonymizeProxy(proxy);
    const browser = await puppeteer.launch({
        args: [`--proxy-server=${aproxy}`],
    });
    const page = await browser.newPage();
    await page.goto('https://iphub.info/');
    await new Promise(resolve => setTimeout(resolve, 30000));
    const type = await page.evaluate(() => {
        return document.querySelector('#type').innerHTML;
    });
    console.log(type);
    fs.appendFileSync(`${type}.txt`, `${proxy}\n`);
    //await page.screenshot({path: 'example.png', fullPage: true});
    await browser.close();
    await proxyChain.closeAnonymizedProxy(aproxy, true);
    }catch(e){
        console.log("Error");
    }
};

const main = async () => {
    for (let i = 0; i < proxys.length; i++) {
        console.log(proxys[i]);
        await checkProxy(proxys[i]);
    }
}
main();