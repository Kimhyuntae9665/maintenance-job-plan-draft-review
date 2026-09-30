// Versioned CPU UI overlay; the original frozen server and source builder remain intact.
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createDevelopmentDesk} from '../development/v2-desk.mjs';
export function createReviewDesk(){
  const frozen=createDevelopmentDesk(),delegate=frozen.listeners('request')[0];
  const files={'/ui-evidence.mjs':['../ui-evidence.mjs','text/javascript'],'/':['index.html','text/html'],'/review-ui/client.mjs':['client.mjs','text/javascript'],'/review-ui/view-state.mjs':['view-state.mjs','text/javascript'],'/development/v2-contract.mjs':['../development/v2-contract.mjs','text/javascript'],'/development/v2-json.mjs':['../development/v2-json.mjs','text/javascript']};
  return createServer((req,res)=>{
    const item=files[new URL(req.url,'http://localhost').pathname];
    if(req.method!=='GET'||!item)return delegate(req,res);
    res.writeHead(200,{'Content-Type':item[1]+'; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'"});res.end(readFileSync(new URL(item[0],import.meta.url)));
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url))createReviewDesk().listen(Number(process.env.P09_V2_PORT??5109),'127.0.0.1',()=>console.log('P09 v2 stored-output CPU review UI ready'));
