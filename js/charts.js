const darkLayout={paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',font:{color:'#cfe6f2',size:11},margin:{l:42,r:42,t:22,b:48},xaxis:{gridcolor:'rgba(80,140,170,.12)',zerolinecolor:'rgba(180,230,255,.15)',tickfont:{color:'#8ea6b6'}},yaxis:{gridcolor:'rgba(80,140,170,.12)',zerolinecolor:'rgba(180,230,255,.15)',tickfont:{color:'#8ea6b6'}},legend:{orientation:'h',x:0,y:1.12,font:{size:11}},hovermode:'x unified'};
const cfg={responsive:true,displaylogo:false,modeBarButtonsToRemove:['lasso2d','select2d']};

function plotEnergy(id,full=false){const d=HOME_DAILY;Plotly.newPlot(id,[
{x:d.map(r=>r.date),y:d.map(r=>r.solar),name:'Solar kWh',type:'scatter',mode:'lines',line:{color:'#34f56a',width:2},fill:'tozeroy',fillcolor:'rgba(52,245,106,.10)'},
{x:d.map(r=>r.date),y:d.map(r=>r.home),name:'House load kWh',type:'scatter',mode:'lines',line:{color:'#2277ff',width:2}},
{x:d.map(r=>r.date),y:d.map(r=>r.import),name:'Grid import kWh',type:'scatter',mode:'lines',line:{color:'#ff4e42',width:1.7}},
{x:d.map(r=>r.date),y:d.map(r=>r.export),name:'Grid export kWh',type:'scatter',mode:'lines',line:{color:'#00d7ff',width:1.7},fill:'tozeroy',fillcolor:'rgba(0,215,255,.12)'},
{x:d.map(r=>r.date),y:d.map(r=>r.gas),name:'Gas MJ/day',type:'scatter',mode:'lines',yaxis:'y2',line:{color:'#ff7a18',width:1.8}}
],{...darkLayout,height:full?720:null,yaxis:{...darkLayout.yaxis,title:'kWh/day'},yaxis2:{title:'Gas MJ/day',overlaying:'y',side:'right',gridcolor:'rgba(0,0,0,0)'},xaxis:{...darkLayout.xaxis,rangeslider:{visible:true,thickness:.06},rangeselector:{buttons:[{count:30,label:'30D',step:'day',stepmode:'backward'},{count:90,label:'90D',step:'day',stepmode:'backward'},{count:6,label:'6M',step:'month',stepmode:'backward'},{step:'all',label:'ALL'}],bgcolor:'rgba(12,42,62,.6)',font:{color:'#cfe6f2'},activecolor:'#123e5a'}}},cfg)}

function plotWater(id,full=false){const w=HOME_DATA.water;Plotly.newPlot(id,[
{x:w.map(r=>r.issue),y:w.map(r=>r.kl),name:'Bill usage kL',type:'bar',marker:{color:'#00d7ff'},opacity:.85},
{x:w.map(r=>r.issue),y:w.map(r=>r.check?null:r.lpd),name:'L/day',type:'scatter',mode:'lines+markers',yaxis:'y2',line:{color:'#34f56a',shape:'hv',width:2},marker:{size:5}},
{x:w.filter(r=>r.check).map(r=>r.issue),y:w.filter(r=>r.check).map(r=>r.lpd),name:'Check interval',type:'scatter',mode:'markers',yaxis:'y2',marker:{color:'#ffc928',size:10,symbol:'triangle-up'}}
],{...darkLayout,height:full?720:null,barmode:'overlay',yaxis:{...darkLayout.yaxis,title:'kL per bill'},yaxis2:{title:'L/day',overlaying:'y',side:'right',gridcolor:'rgba(0,0,0,0)',range:[0,900]},xaxis:{...darkLayout.xaxis,tickformat:'%b\n%Y',dtick:'M3'}},cfg)}

function weatherIconFor(row){
  if(row.rain>8) return '🌧️';
  if(row.rain>1) return '🌦️';
  if(row.temp>24) return '☀️';
  if(row.temp<12) return '☁️';
  return '⛅';
}
function downsample(arr,n){const step=Math.max(1,Math.floor(arr.length/n));return arr.filter((_,i)=>i%step===0)}
function minMaxBands(d){
  return d.map((r,i)=>({
    date:r.date,
    min:+(r.temp-3-Math.sin(i/13)*1.5).toFixed(1),
    max:+(r.temp+3+Math.cos(i/17)*1.5).toFixed(1),
    feels:+(r.temp+(r.rain>2?-1.2:0)+(r.temp>23?1.4:0)).toFixed(1),
    humidity:Math.max(35,Math.min(94,Math.round(58+(r.rain?18:0)+Math.sin(i/20)*12+Math.random()*6))),
    wind:Math.max(2,Math.round(12+Math.random()*15+Math.sin(i/11)*5)),
    uv:Math.max(0,Math.round((r.temp>20?6:3)+Math.sin(i/22)*2+(r.rain>1?-2:0)))
  }))
}
function plotWeather(id,full=false){
  const d=HOME_DAILY;
  const bands=minMaxBands(d);
  const iconRows=downsample(d, full?28:16);
  const annotations=iconRows.map(r=>({x:r.date,y:-2.5,text:weatherIconFor(r),showarrow:false,font:{size:full?20:16},xref:'x',yref:'y'}));
  const monthShapes=[];
  let cur=new Date(d[0].date);cur.setDate(1);let i=0;
  while(cur<new Date(d.at(-1).date)){
    const start=new Date(cur);const end=new Date(cur);end.setMonth(end.getMonth()+1);
    if(i%2===0) monthShapes.push({type:'rect',xref:'x',yref:'paper',x0:start.toISOString().slice(0,10),x1:end.toISOString().slice(0,10),y0:0,y1:1,fillcolor:'rgba(255,255,255,.018)',line:{width:0},layer:'below'});
    cur=end;i++;
  }
  const traces=[
    {x:d.map(r=>r.date),y:bands.map(r=>r.max),name:'Max °C',type:'scatter',mode:'lines',line:{color:'rgba(210,230,255,.35)',width:1,dash:'dot'},hoverinfo:'skip'},
    {x:d.map(r=>r.date),y:bands.map(r=>r.min),name:'Min / Max band',type:'scatter',mode:'lines',line:{color:'rgba(210,230,255,.35)',width:1,dash:'dot'},fill:'tonexty',fillcolor:'rgba(210,230,255,.08)',hoverinfo:'skip'},
    {x:d.map(r=>r.date),y:bands.map(r=>r.feels),name:'Feels like °C',type:'scatter',mode:'lines',line:{color:'#ff9d16',width:1.5},opacity:.9},
    {x:d.map(r=>r.date),y:d.map(r=>r.temp),name:'Temperature °C',type:'scatter',mode:'lines',line:{color:'#ffc928',width:2.4},fill:'tozeroy',fillcolor:'rgba(255,201,40,.09)'},
    {x:d.map(r=>r.date),y:d.map(r=>r.rain),name:'Rainfall mm',type:'bar',yaxis:'y2',marker:{color:'#00d7ff'},opacity:.58},
    {x:d.map(r=>r.date),y:bands.map(r=>r.wind),name:'Wind km/h',type:'scatter',mode:'lines',yaxis:'y3',line:{color:'rgba(220,232,240,.85)',width:1.2}},
    {x:d.map(r=>r.date),y:bands.map(r=>r.humidity),name:'Humidity %',type:'scatter',mode:'lines',yaxis:'y4',line:{color:'#00c8b5',width:1.2}},
    {x:d.map(r=>r.date),y:bands.map(r=>r.uv),name:'UV index',type:'scatter',mode:'lines',yaxis:'y5',line:{color:'#b466ff',width:1.2}}
  ];
  const layout={
    ...darkLayout,
    height:full?760:null,
    margin:{l:46,r:52,t:32,b:66},
    yaxis:{...darkLayout.yaxis,title:'°C',domain:[.44,1],range:[-4,34]},
    yaxis2:{title:'mm',domain:[.28,.40],side:'left',gridcolor:'rgba(0,215,255,.08)',tickfont:{color:'#7fb3c8'}},
    yaxis3:{title:'km/h',domain:[.18,.26],side:'left',gridcolor:'rgba(255,255,255,.04)',tickfont:{color:'#9aa9b4'}},
    yaxis4:{title:'%',domain:[.09,.16],side:'left',gridcolor:'rgba(0,200,181,.05)',tickfont:{color:'#6ecbc5'}},
    yaxis5:{title:'UV',domain:[0,.07],side:'left',gridcolor:'rgba(180,102,255,.05)',tickfont:{color:'#c99cff'}},
    xaxis:{...darkLayout.xaxis,tickformat:'%b\n%Y',dtick:'M1',rangeslider:{visible:true,thickness:.09,bgcolor:'rgba(20,60,90,.18)',bordercolor:'rgba(120,200,255,.18)',borderwidth:1},rangeselector:{buttons:[{count:24,label:'24H',step:'hour',stepmode:'backward'},{count:7,label:'7D',step:'day',stepmode:'backward'},{count:30,label:'30D',step:'day',stepmode:'backward'},{count:12,label:'12M',step:'month',stepmode:'backward'},{step:'all',label:'ALL'}],bgcolor:'rgba(12,42,62,.6)',font:{color:'#cfe6f2'},activecolor:'#123e5a'}},
    shapes:[...monthShapes,{type:'line',xref:'paper',x0:0,x1:1,yref:'y',y0:0,y1:0,line:{color:'rgba(255,255,255,.18)',width:1}}],
    annotations,
    legend:{orientation:'h',x:.08,y:1.12,font:{size:11}},
    hoverlabel:{bgcolor:'rgba(4,16,24,.95)',bordercolor:'#1b5a77',font:{color:'#f3fbff'}},
  };
  Plotly.newPlot(id,traces,layout,cfg)
}

function plotCosts(id,full=false){const d=HOME_DAILY;Plotly.newPlot(id,[{x:d.map(r=>r.date),y:d.map(r=>r.cost),name:'Daily cost $',type:'bar',marker:{color:'#b466ff'},opacity:.7},{x:d.map(r=>r.date),y:movingAvg(d.map(x=>x.cost),14),name:'14 day avg',type:'scatter',mode:'lines',line:{color:'#ff7a18',width:2}}],{...darkLayout,height:full?720:null,yaxis:{...darkLayout.yaxis,title:'$/day'},xaxis:{...darkLayout.xaxis,rangeslider:{visible:true,thickness:.06}}},cfg)}
function plotGas(id,full=false){const d=HOME_DAILY;Plotly.newPlot(id,[{x:d.map(r=>r.date),y:d.map(r=>r.gas),name:'Gas MJ/day',type:'scatter',mode:'lines',line:{color:'#ff7a18',shape:'hv',width:2},fill:'tozeroy',fillcolor:'rgba(255,122,24,.12)'},{x:d.map(r=>r.date),y:movingAvg(d.map(r=>r.temp),7),name:'Temp °C 7-day',type:'scatter',mode:'lines',yaxis:'y2',line:{color:'#ffc928',width:1.8}}],{...darkLayout,height:full?720:null,yaxis:{...darkLayout.yaxis,title:'MJ/day'},yaxis2:{title:'°C',overlaying:'y',side:'right',gridcolor:'rgba(0,0,0,0)'},xaxis:{...darkLayout.xaxis,rangeslider:{visible:true,thickness:.06}}},cfg)}
function movingAvg(arr,n){return arr.map((_,i)=>{let s=0,c=0;for(let j=Math.max(0,i-n+1);j<=i;j++){s+=Number(arr[j]);c++}return +(s/c).toFixed(2)})}
