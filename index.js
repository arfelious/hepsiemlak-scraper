const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const promisify = require('util').promisify
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const rlQuestion = promisify(rl.question).bind(rl);
const BASE_URL = "https://www.hepsiemlak.com"
const COOKIE_PATH = path.join(os.tmpdir(), "cookie_hepsiemlak.txt")
let cookie = fs.existsSync(COOKIE_PATH)?fs.readFileSync(COOKIE_PATH).toString():""
const ID_LIST_ENDPOINT = BASE_URL+"/api/realty-map/?mapSize=2500&intent=satilik&city=sakarya&mainCategory=konut&mapCornersEnabled=true"
const USER_AGENTS = [["Mozilla/5.0 (X11; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0",0.2],["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",0.3],["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",0.4],["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",0.1]]
const CAPTCHA_ERR = "Hata. Robot doğrulamasını geçmek gerekebilir.\nYönerge: https://github.com/arfelious/hepsiemlak-scraper/blob/main/captcha.md"
let getWeightedRandom = list=>{
    let totalWeight = list.reduce((a,c)=>a+c[1],0)
    let random = Math.random()*totalWeight
    for(let i=0;i<list.length;i++){
        random-=list[i][1]
        if(random<=0){
            return list[i][0]
        }
    }
}
let getOptions = (cookie)=>{
    let res = {
        "headers": {
          "accept": "application/json",
          "accept-language": "tr-TR,tr;q=0.9",
          "cache-control": "max-age=0",
          "priority": "u=0, i",
          "sec-ch-ua": "\"Chromium\";v=\"133\", \"Not(A:Brand\";v=\"99\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"Linux\"",
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": "none",
          "sec-fetch-user": "?1",
          "upgrade-insecure-requests": "1",
          "cookie": cookie,
          "User-Agent": getWeightedRandom(USER_AGENTS)
        },
        "referrerPolicy": "strict-origin-when-cross-origin",
        "body": null,
        "method": "GET"
    }      
    if(fetch.toString().includes("undici")){
        res={headers:res}
    }
    return res
}
let getListingIds = async ()=>{
    let res = await fetch(ID_LIST_ENDPOINT,getOptions(cookie))
    try{
        let curr = await res.text()
        if(curr.includes("Just a moment...")){
            throw CAPTCHA_ERR
        }
        try{
            let parsed = JSON.parse(curr)
            return parsed.realties.map(x=>x.listingId)
        }catch(e){
            console.error(e)
            throw "Hata. İlan ID'leri alınamadı.\nSunucudan gelen yanıt: "+curr.slice(0,50)+"..."
        }
    }
    catch(e){
        console.error(e)
    }
}
const IMG_EXTS = ["jpg","jpeg","png","gif","webp"]
let removeImages = obj=>{
    for(let key in obj){
        let val = obj[key]
        if(typeof val=="string"&&IMG_EXTS.some(x=>val.includes(x))){
            delete obj[key]
        }
        else if(typeof val == "object"){
            removeImages(val)
        }
    }
}
let getListing = async id=>{
    let res = await fetch(BASE_URL+"/api/realties/"+id, getOptions(cookie))
    try{
        let curr = await res.text()
        if(curr.includes("Just a moment...")){
            throw CAPTCHA_ERR
        }
        try{
            let parsed = JSON.parse(curr)
            if(parsed.exception){
                throw "Hata. Sunucudan gelen hata mesajı: "+parsed.errors.join(", ")
                
            }
            let res = parsed.realtyDetail
            removeImages(res)
            delete res.breadcrumbs
            return JSON.stringify(res)
        }catch(e){
            throw e.startsWith("Hata")?e:"Hata. İlan bilgileri alınamadı.\nSunucudan gelen yanıt: "+curr.slice(0,50)+"..."
        }
    }catch(e){
        console.error(e)
    }
}
let start = async ()=>{
    let curr = await rlQuestion("İşlem: (al/listele/cookie): ")
    curr=curr.trim().toLocaleLowerCase()
    switch(curr){
        case "al":{
            let id = await rlQuestion("İlan ID: ")
            let listing = await getListing(id)
            console.log(listing)
            break
        }
        case "listele":{
            let ids = await getListingIds()
            let max = Math.floor(process.stdout.columns/16)
            let str = ""
            if(!ids)break
            for(let i=0;i<ids.length;i++){
                str+=ids[i].padStart(15," ")+" "
                if(i%max==0){
                    console.log(str)
                    str=""
                }
            }
            console.log("Listelenen ilanların başkaları tarafından alınmadığını kontrol etmeyi unutmayın.")
            break
        }
        case "cookie":{
            let newCookie = await rlQuestion("Cookie: ")
            fs.writeFileSync(COOKIE_PATH, newCookie)
            cookie = newCookie
            break
        }
        default:
            console.log("Geçersiz işlem.")
    } 
    start()
}
start()