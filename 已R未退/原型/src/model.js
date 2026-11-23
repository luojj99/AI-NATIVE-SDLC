/* 仅为原型的本地演示模型，不发送邮件、不接入真实账单。 */
window.RefundModel = (() => {
  const STATES = [
    ['wait','已R暂不核实','gray','财务'],['finance','待财务核实','blue','财务'],
    ['service','待售后核实','purple','售后'],['ready','待催款','orange','财务'],
    ['chased','已催款','cyan','财务'],['abnormal','供应反馈异常','red','财务'],
    ['promised','已承诺退款','blue','财务'],['overdue','承诺到期未退','red','财务'],
    ['business','商务升级中','purple','商务'],['done','来账已完结','green','财务'],['closed','未R已关闭','gray','财务']
  ].map(([id,label,color,role])=>({id,label,color,role}));
  const byState = Object.fromEntries(STATES.map(s=>[s.id,s]));
  const edges = {
    finance:{service:'T03',ready:'T04',closed:'T05'},service:{ready:'T06',closed:'T07'},
    ready:{chased:'T08'},chased:{wait:'T10',promised:'T11',business:'T12'},
    abnormal:{chased:'T13',wait:'T14',promised:'T15',business:'T16'},
    overdue:{chased:'T18',wait:'T19',promised:'T20',business:'T21'},
    business:{wait:'T22',promised:'T23'}
  };
  const PEOPLE = {'财务':['林晓','周宁','陈悦'],'售后':['何青','吴桐'],'商务':['许言','赵晨']};
  const REASONS = {'待核实':['票号状态待确认','外部账单待查找'], '供应处理':['正常账期待来账','航司仍在处理中','明确承诺待来账','承诺到期未来账','催款后未更新','供应明确拒退'], '特殊退款':['银行卡退款无账单','已导入但未匹配','金额差异'], '信息异常':['人工误标已R','扫错票号']};
  const NOW = '2026-11-20T12:00';
  const terminal = s=>['done','closed'].includes(s);
  const time = x=>{if(typeof x!=='string'||!x)return NaN;const iso=x.length===10?x+'T00:00:00':x;return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso)?iso:iso+'+08:00').getTime();};
  const deadline = x=>x?.length===10?time(x)+86400000-1:time(x);
  const addDays = (x,n)=>new Date(time(x)+n*86400000+8*3600000).toISOString().slice(0,x.length===10?10:/T\d{2}:\d{2}:\d{2}\.\d/.test(x)?23:/T\d{2}:\d{2}:\d{2}/.test(x)?19:16);
  const daySpan = (x,now)=>Math.max(0,Math.floor((time(now)-time(x))/86400000));
  const clone = x=>JSON.parse(JSON.stringify(x));
  const rows = [
    ['R001','wait','建单后接受继续等待，已指定下次核实','华辰航旅','林晓','2026-10-10','2026-11-23',1,'正常账期待来账'],
    ['R002','wait','供应反馈仍在处理，再次等待至指定日期','远行国际','周宁','2026-10-07','2026-11-24',2,'正常账期待来账'],
    ['R003','wait','供应仍在处理，接受继续等待','星洲票务','陈悦','2026-10-09','2026-11-21',2,'航司仍在处理中'],
    ['R004','finance','核实时间到，尚未来账','华辰航旅','林晓','2026-10-28','2026-11-12',0,'票号状态待确认'],
    ['R005','finance','钱已退回，但还没有外部退票单','远行国际','周宁','2026-10-21','2026-11-05',0,'银行卡退款无账单'],
    ['R006','finance','已导入外部单，票号未匹配','星洲票务','陈悦','2026-10-29','2026-11-13',0,'已导入但未匹配'],
    ['R007','service','财务无法确认票号状态','华辰航旅','何青','2026-10-18','',0,'票号状态待确认'],
    ['R008','service','疑似扫错票号，等待售后核实','远行国际','吴桐','2026-10-20','',0,'扫错票号'],
    ['R009','ready','真实已R，尚未实际发送邮件','华辰航旅','林晓','2026-10-22','',0,'正常账期待来账'],
    ['R010','ready','同状态批量催款示例','星洲票务','陈悦','2026-10-24','',1,'正常账期待来账'],
    ['R011','chased','首次邮件已发，等待供应反馈','华辰航旅','林晓','2026-10-15','',1,'正常账期待来账'],
    ['R012','chased','供应已回复，处理人尚未登记','远行国际','周宁','2026-10-14','',2,'催款后未更新'],
    ['R013','abnormal','超过5天仍停留在已催款','星洲票务','陈悦','2026-10-11','',2,'催款后未更新'],
    ['R014','abnormal','迟到回复：航司仍在处理中','华辰航旅','林晓','2026-10-12','',3,'航司仍在处理中'],
    ['R015','promised','已接受明确承诺：仅填写日期','远行国际','周宁','2026-10-08','2026-11-20',2,'明确承诺待来账'],
    ['R016','promised','承诺到今天18:00，尚未到期','星洲票务','陈悦','2026-10-07','2026-11-20T18:00',3,'明确承诺待来账'],
    ['R017','overdue','承诺到期仍未来账，可再次催款','华辰航旅','林晓','2026-09-30','2026-11-16',3,'承诺到期未来账'],
    ['R018','overdue','供应提出新的明确承诺','远行国际','周宁','2026-10-01','2026-11-15',2,'承诺到期未来账'],
    ['R019','business','供应拒退，商务继续跟进','星洲票务','许言','2026-09-25','',4,'供应明确拒退'],
    ['R020','business','商务协调后，等待登记处理结果','华辰航旅','赵晨','2026-09-27','',3,'航司仍在处理中'],
    ['R021','done','外部单匹配且金额一致','远行国际','周宁','2026-10-15','',1,'正常账期待来账'],
    ['R022','done','来账有金额差异，已交差异单','星洲票务','陈悦','2026-10-10','',2,'金额差异'],
    ['R023','done','财务补建外部单并关联后完结','华辰航旅','林晓','2026-10-14','',1,'银行卡退款无账单'],
    ['R024','done','退票单已关联，所在批次未结算','远行国际','周宁','2026-10-12','',2,'正常账期待来账'],
    ['R025','closed','财务确认人工误标已R','星洲票务','陈悦','2026-10-28','',0,'人工误标已R'],
    ['R026','closed','售后确认实际未R，直接关闭','华辰航旅','林晓','2026-10-24','',0,'扫错票号'],
    ['R027','finance','首次到期建单，处理人暂未分配','远行国际','','2026-11-01','',0,'正常账期待来账']
  ];
  const passengers=['陈安','王晴','李远','赵嘉','刘珂','孙宁','周悦','吴凡','郑然'];
  function seed(){return rows.map((a,i)=>{
    const [id,state,scene,supplier,owner,rDate,due,count,subreason]=a;
    const collector=supplier==='华辰航旅'?'林晓':supplier==='远行国际'?'周宁':'陈悦';
    const category=Object.keys(REASONS).find(k=>REASONS[k].includes(subreason));
    const r={id,state,scene,supplier,owner,collector,role:byState[state].role,rDate,count,
      order:'RF2026'+String(11080001+i),ticket:'781-'+String(6849200000+i),passenger:passengers[i%passengers.length],
      amount:([2860,4320,1680,6570,2980,1240,3700][i%7]),currency:'CNY',pnr:['HXTRPA','QNVWLD','BXKUFG'][i%3],
      category,subreason,next:state==='wait'||state==='finance'?due:'',promise:['promised','overdue'].includes(state)?due:'',
      chaseDate:count?'2026-11-10':'',entered:count?'2026-11-10T09:00':'',initial:id==='R027',bill:null,
      notes:[{at:'2026-11-17T15:20',by:owner||'系统',text:'【演示场景】'+scene}],
      internalBill:'IRF2026'+id.slice(1),
      logs:[{at:rDate,by:'系统',action:'生成内部退票账单',detail:'按乘机人生成内部退票账单，开始首次等待；此时尚未建跟进记录。'},
      {at:addDays(rDate,16)+'T00:00',by:'系统',action:'生成跟进记录',detail:'T01 · 首次15个自然日等待已到期，仍未关联对应外部退票单；初始待财务核实、催款次数0。'}]
    };
    if(state==='wait')r.logs.push({at:'2026-11-17T09:00',by:owner,action:'接受继续等待',detail:'已建单后再次等待，由处理人手工指定下次核实时间 '+due+'。'});
    if(['R011','R012'].includes(id)){r.entered=id==='R011'?'2026-11-18T09:30':'2026-11-15T16:00';r.chaseDate=r.entered.slice(0,10);}
    if(state==='done'){r.bill={number:'EXT202611'+(18001+i),source:id==='R023'?'财务手工建立':'供应导入',amount:r.amount-(id==='R022'?120:0),matched:true};r.logs.push({at:'2026-11-17T14:00',by:'系统',action:'来账已完结',detail:'G01 · 对应外部退票单关联成功，后续交差异单流程。'});}
    else if(state==='closed')r.logs.push({at:'2026-11-17T14:00',by:r.owner,action:'关闭记录',detail:(id==='R025'?'T05':'T07')+' · 已核实实际未R。'});
    else if(state!=='wait')r.logs.push({at:'2026-11-17T09:00',by:owner,action:'进入'+byState[state].label,detail:'演示记录 · '+scene});
    if(id==='R006')r.bill={number:'EXT20261118006',source:'供应导入',amount:r.amount,matched:false};
    return r;
  });}
  const allowed=s=>[s,...Object.keys(edges[s]||{})];
  function validInputDate(value){
    if(typeof value!=='string')return false;
    const m=value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if(!m)return false;
    const [,y,mo,d,h='0',mi='0',s='0']=m.map((v,i)=>i?Number(v||0):v);
    return y>=1900&&y<=9999&&mo>=1&&mo<=12&&d>=1&&d<=new Date(Date.UTC(y,mo,0)).getUTCDate()&&h<24&&mi<60&&s<60;
  }
  const transitionHints = {
    service: '财务无法确认票号状态时，将明确的待核实事项交给售后处理。',
    ready: '核实票号已R、尚未匹配或关联外部退票单且本轮催款邮件尚未发出时，可转为待催款。登记“已催款”时才增加催款次数并开始5个自然日的等待。',
    closed: '核实票号实际未R后才可关闭。关闭后结束跟进，无法重开。',
    chased: '本轮催款邮件实际发出后，登记最近催款日期。转入时催款次数默认加1，并开始本轮5个自然日的等待。',
    wait: '收到反馈并接受继续等待时，填写下次核实时间。届时仍未来账，系统会转回待财务核实。',
    promised: '接受供应商的退款承诺后，填写明确且尚未到期的承诺退款日期或时刻。超过该时间仍未来账，系统会转为“承诺到期未退”。',
    business: '供应的处理结果无法接受或需要商务协调时，处理人可直接升级，由商务继续跟进。催款次数不限。'
  };
  function processingHint(from, to) {
    if (from !== to) return transitionHints[to];
    if (terminal(from)) return '跟进已结束，可在当前状态补充信息。';
    if (from === 'business') return '商务协调尚无结果或供应明确拒退时，可在当前状态补充跟进说明。';
    return '可在当前状态修改处理信息。';
  }
  function validate(r,to,p,now){
    if(!allowed(r.state).includes(to))return '当前状态不允许流转到该目标状态';
    const changed=r.state!==to;
    if(changed&&r.bill?.matched)return '外部单已关联，应优先自动完结；请刷新记录';
    if(!p.role||!p.owner||!PEOPLE[p.role]?.includes(p.owner))return '请选择有效的处理角色和处理人';
    if(changed&&r.state==='finance'&&!PEOPLE['财务'].includes(p.collector))return '请选择有效的追款负责人';
    if(to==='wait'&&!validInputDate(p.next))return '请填写有效的下次核实时间';
    if(to==='wait'&&changed&&deadline(p.next)<=time(now))return '下次核实截止时间必须晚于演示当前时间';
    if(to==='promised'&&!validInputDate(p.promise))return '请填写明确且有效的承诺退款时间';
    if(to==='promised'&&changed&&deadline(p.promise)<=time(now))return '承诺退款截止时间必须尚未到达';
    if(to==='chased'){
      if(!validInputDate(p.chaseDate))return '请填写有效的最近催款时间';
      if(p.chaseDate.slice(0,10)>now.slice(0,10))return '最近催款时间不能晚于演示当天';
      if(p.chaseDate.includes('T')&&time(p.chaseDate)>time(now))return '最近催款时间不能晚于演示当前时间';
      if(p.count===''||p.count===undefined||!Number.isInteger(Number(p.count))||Number(p.count)<0)return '催款次数必须为非负整数';
    }
    return '';
  }
  function save(records,ids,to,payloads,now){
    const selected=ids.map(id=>records.find(r=>r.id===id));
    if(selected.some(r=>!r))throw Error('记录不存在，请刷新后重试');
    if(new Set(selected.map(r=>r.state)).size!==1)throw Error('批量流转仅支持同一当前状态');
    selected.forEach((r,i)=>{const error=validate(r,to,payloads[i],now);if(error)throw Error(r.id+'：'+error);});
    selected.forEach((r,i)=>{
      const p=payloads[i],from=r.state,changed=from!==to,prev=clone(r);
      ['role','owner','collector','category','subreason'].forEach(k=>{if(p[k]!==undefined)r[k]=p[k];});
      if(to==='wait')r.next=p.next;
      if(to==='promised')r.promise=p.promise;
      if(to==='chased'){r.chaseDate=p.chaseDate;r.count=Number(p.count);if(changed)r.entered=now;}
      r.state=to;r.initial=false;
      const changes=['owner','role','collector','next','promise','chaseDate','count','category','subreason'].filter(k=>prev[k]!==r[k]);
      const fieldLabels={owner:'处理人',role:'处理角色',collector:'追款负责人',next:'下次核实时间',promise:'承诺退款时间',chaseDate:'最近催款时间',count:'催款次数',category:'问题原因分类',subreason:'问题原因子类'};
      r.logs.push({at:now,by:'演示操作员',action:changed?byState[from].label+' → '+byState[to].label:'修改信息（状态未变）',detail:(changed?(edges[from][to]+' · '):'')+(changes.map(k=>fieldLabels[k]+'：'+(prev[k]||'未填写')+' → '+(r[k]??'未填写')).join('；')||'已确认当前信息')});
      if(p.note?.trim())r.notes.push({at:now,by:'演示操作员',text:p.note.trim(),html:p.noteHtml||''});
    });
  }
  function runAuto(records,now){
    const changes=[];
    records.forEach(r=>{
      if(terminal(r.state))return;
      const from=r.state;let to,rule;
      if(r.bill?.matched){to='done';rule='G01';}
      else if(from==='wait'&&time(now)>=deadline(r.next)){to='finance';rule='T02';}
      else if(from==='chased'&&time(now)>time(r.entered)+5*86400000){to='abnormal';rule='T09';}
      else if(from==='promised'&&time(now)>deadline(r.promise)){to='overdue';rule='T17';}
      if(to){r.state=to;r.role='财务';r.owner=r.collector;r.initial=false;r.logs.push({at:now,by:'系统（演示）',action:byState[from].label+' → '+byState[to].label,detail:rule+' · '+(rule==='G01'?'外部退票单关联成功，停止计时跟进。':'达到截止点，且仍未关联对应外部退票单。')});changes.push(r.id+' '+byState[to].label);}
    });return changes;
  }
  function saveMixed(records,items,now){
    if(!items.length)throw Error('没有可更新的记录');
    if(new Set(items.map(i=>i.id)).size!==items.length)throw Error('同一批次不能重复更新同一记录');
    const working=clone(records);
    items.forEach(item=>{
      const r=working.find(r=>r.id===item.id);
      if(!r)throw Error(item.id+'：记录不存在，请重新导出');
      if(r.state!==item.from)throw Error(item.id+'：当前状态已变化，请重新导出');
      save(working,[item.id],item.to,[item.payload],now);
      r.logs.at(-1).detail='Excel批量处理 · '+r.logs.at(-1).detail;
    });
    const changed=new Set(items.map(i=>i.id));
    records.forEach((r,i)=>{if(changed.has(r.id))records[i]=working[i];});
  }
  return {STATES,byState,edges,PEOPLE,REASONS,NOW,seed,allowed,terminal,deadline,time,addDays,daySpan,processingHint,validate,save,saveMixed,runAuto,clone,validInputDate};
})();
