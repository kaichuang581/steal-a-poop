/* Runs before the game's code (see index.html). Old syntax on purpose; keep it small. Plan file 17, change 5. */
(function(){
var STILL_LOADING_LINE_AT_25_S=true; // Brian's question 20, unanswered: the plan's default, yes
var d=document,n=navigator,t0=Date.now(),miss=[],gpu='none',kind=0,loaded=0,opened=0,card,timer,old,
COPY='Copy device report',OLD='This browser is too old to run Fleeced. Please update it, or try another browser.';
function test(name,f){try{if(f())return}catch(e){}miss.push(name)}
function el(tag,css,s){var e=d.createElement(tag);e.style.cssText=css;e.textContent=s;return card.appendChild(e)}
// kind 1 is the card (with the report to read), kind 2 the one line; both have the copy button
function show(msg,k,why){
var b,s='Fleeced, '+location.origin+location.pathname+', '+Date()+'\nStopped: '+why+' at '+((Date.now()-t0)/1e3|0)+' s\nBrowser: '+n.userAgent+'\nScreen: '+screen.width+' x '+screen.height+' at '+devicePixelRatio+'x; '+(n.hardwareConcurrency||'?')+' cores; '+(n.deviceMemory||'?')+' GB\nMissing: '+(miss.join(', ')||'nothing')+'\nRenderer: '+gpu;
function ask(){prompt(COPY,s)}
kind=k;
card=d.body; // el() hangs each new piece on `card`: first the card itself on the page
card=el('div','position:fixed;z-index:999;left:5%;right:5%;max-width:32em;margin:auto;padding:14px;background:#FBF4E4;color:#3B3028;font:16px/1.4 sans-serif;text-align:center;'+(k==1?'top:8%':'bottom:16px'),msg);
card.setAttribute('role','alert');
if(k==1)el('pre','text-align:left;white-space:pre-wrap;font-size:12px',s);
b=el('button','font:inherit;margin:8px;padding:8px 14px',COPY);
b.onclick=function(){try{n.clipboard.writeText(s).then(function(){b.style.minWidth=b.offsetWidth+'px';b.textContent='Copied'},ask)}catch(e){ask()}};
}
test('lookbehind',function(){return RegExp('(?<=a)b')});
test('color-mix',function(){return CSS.supports('color','color-mix(in srgb, red, blue)')});
old=miss[0];
test('WebGL2',function(){
var g=d.createElement('canvas').getContext('webgl2'),x=g.getExtension('WEBGL_debug_renderer_info');
gpu=g.getParameter(x?37446:7937); // the unmasked renderer where the browser gives it
x=g.getExtension('WEBGL_lose_context');
x&&x.loseContext();
return 1});
if(old)return show(OLD,1,'browser check failed');
// No WebGL2 alone is left to the game, which has its own card for a scene that cannot draw.
addEventListener('load',function(){loaded=Date.now()});
timer=setInterval(function(){
var now=Date.now(),empty=!d.getElementById('root').firstChild,shut=d.querySelector('.sk-doors[data-phase=shut]:not([data-veil])');
if(!shut)opened=1;
if(kind==1?!empty:kind==2&&!shut)kind=d.body.removeChild(card)&&0; // it got going after all
if(!empty&&opened)return clearInterval(timer); // the game is up: nothing left to watch
if(kind)return;
if(empty&&loaded&&now-loaded>12e3)show(miss[0]?OLD:'Fleeced did not start. Please reload the page, or try another browser.',1,'page empty');
else if(STILL_LOADING_LINE_AT_25_S&&!opened&&now-t0>25e3)show('Still loading. This can take a while on older computers.',2,'doors still shut');
},250);
})();
