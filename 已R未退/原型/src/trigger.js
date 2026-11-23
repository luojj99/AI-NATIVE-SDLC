/* 首次触发：内部账单与跟进记录分开存放。全部为本地模拟数据。 */
window.RefundTrigger=(()=>{
  const M=window.RefundModel;
  const SUPPLIERS=['供应商甲','供应商乙','供应商丙','华辰航旅','远行国际','星洲票务'];
  const AIRLINES=['中国东方航空（MU）','中国国际航空（CA）','中国南方航空（CZ）'];
  const DIMENSIONS=['supplier','nature','airline'];
  const rule=(id,supplier,nature,days)=>({id,supplier,nature,airline:'',days,enabled:true});
  const seedConfig=()=>({defaultDays:15,rules:[rule('S01','供应商乙','',7),rule('S02','供应商甲','',30),rule('S03','供应商甲','非自愿',10),rule('S04','供应商丙','',30)]});
  function validate(config){
    const valid=n=>Number.isSafeInteger(Number(n))&&Number(n)>=1&&Number(n)<=36500;
    if(!valid(config.defaultDays))return '通用天数须为1至36500的整数（自然日）';
    for(const [i,r] of config.rules.entries()){
      if(!DIMENSIONS.some(k=>r[k]))return `第${i+1}条特殊规则至少限定一个维度，其余维度可选不限`;
      if(!valid(r.days))return `第${i+1}条规则的天数须为1至36500的整数`;
    }
    return '';
  }
  function resolve(ticket,config){
    const matched=config.rules.filter(r=>r.enabled&&DIMENSIONS.every(k=>!r[k]||r[k]===ticket[k]));
    const days=matched.length?Math.max(...matched.map(r=>Number(r.days))):Number(config.defaultDays);
    const due=M.addDays(ticket.rDate,days);
    return {days,due,matched:M.clone(matched),source:matched.length?'特殊规则':'通用配置'};
  }
  const dueNow=(due,now)=>due.length===10?M.time(now)>M.deadline(due):M.time(now)>=M.deadline(due);
  function seedTickets(){
    const specs=[
      ['P001','林七','供应商乙','自愿','2026-11-12T12:00','单条7天规则'],
      ['P002','陈三十','供应商甲','非自愿','2026-11-08T12:00','两条规则取30天'],
      ['P003','周十二','供应商丙','非自愿','2026-11-08T12:00','已R12天，30天改10天'],
      ['P004','王来账','华辰航旅','自愿','2026-11-01','期限内已来账'],
      ['P005','李日期','星洲票务','自愿','2026-11-05','仅日期，截止日结束'],
      ['P006','赵时刻','远行国际','自愿','2026-11-05T18:00','具体时刻，18:00到期']
    ];
    return specs.map(([id,passenger,supplier,nature,rDate,scene],i)=>({id,passenger,supplier,nature,rDate,scene,airline:AIRLINES[i%3],
      order:'RF-TRIGGER-'+String(i+1).padStart(3,'0'),ticket:'781-990000000'+i,internalBill:'IRF-P'+String(i+1).padStart(3,'0'),
      collector:['林晓','周宁','陈悦'][i%3],amount:2860+i*120,currency:'CNY',pnr:'DEMO01',followupId:null,createdAt:rDate,
      bill:id==='P004'?{number:'EXT-P004',source:'供应导入',amount:3220,matched:true,linkedAt:'2026-11-10T10:00'}:null}));
  }
  function inspect(ticket,config,now){
    if(ticket.followupId)return {kind:'created',label:'已建跟进单',...(ticket.triggerSnapshot||resolve(ticket,config))};
    const resolved=resolve(ticket,config);
    if(ticket.bill?.matched)return {kind:'received',label:'已来账，直接对账',...resolved};
    if(dueNow(resolved.due,now))return {kind:'due',label:'已到期，待下次检查建单',...resolved};
    return {kind:'waiting',label:'首次等待中，尚未建单',...resolved};
  }
  function check(tickets,records,config,now){
    const error=validate(config);if(error)throw Error(error);
    if(!Number.isFinite(M.time(now)))throw Error('演示时间无效');
    const result={at:now,created:[],received:0,waiting:0,existing:0,changes:[]};
    for(const ticket of tickets){
      // 按乘机人的内部退票账单身份去重；既有跟进单和终态都不重复创建。
      const existing=records.find(r=>r.sourceTicketId===ticket.id||r.internalBill===ticket.internalBill);
      if(ticket.followupId||existing){if(existing){ticket.followupId=existing.id;if(ticket.bill?.matched&&!existing.bill?.matched)existing.bill=M.clone(ticket.bill);}result.existing++;continue;}
      const decision=inspect(ticket,config,now);
      if(decision.kind==='received'){result.received++;continue;}
      if(decision.kind==='waiting'){result.waiting++;continue;}
      const n=Math.max(0,...records.map(r=>Number(r.id.slice(1))||0),...tickets.map(t=>Number(t.followupId?.slice(1))||0))+1;
      const id='R'+String(n).padStart(3,'0');
      const snapshot={days:decision.days,due:decision.due,matched:decision.matched,source:decision.source};
      const basis=snapshot.matched.length?snapshot.matched.map(r=>r.id+' '+r.days+'天').join('、'):'通用'+snapshot.days+'天';
      const record={...M.clone(ticket),id,sourceTicketId:ticket.id,state:'finance',role:'财务',owner:ticket.collector||'',
        count:0,initial:true,next:'',promise:'',chaseDate:'',entered:'',createdAt:now,triggerSnapshot:snapshot,
        category:'待核实',subreason:'票号状态待确认',
        notes:[{at:now,by:'系统（演示）',text:'首次到期仍未来账，创建跟进记录。'+ticket.scene}],
        logs:[{at:ticket.rDate,by:'系统（演示）',action:'生成内部退票账单',detail:'按乘机人生成 '+ticket.internalBill+'；开始首次等待，此时尚未建跟进单。'},
          {at:now,by:'系统（演示）',action:'生成跟进记录 · 待财务核实',detail:'T01 · '+basis+'；采用'+snapshot.days+'个自然日，到期时间 '+snapshot.due.replace('T',' ')+'；仍未关联外部退票单。初始催款次数0。'}]};
      records.push(record);ticket.followupId=id;ticket.triggerSnapshot=M.clone(snapshot);result.created.push({id,ticketId:ticket.id,passenger:ticket.passenger});
    }
    result.changes=M.runAuto(records,now);
    return result;
  }
  function addTicket(tickets,form,now){
    if(!form.passenger?.trim())throw Error('请填写乘机人姓名');
    if(!SUPPLIERS.includes(form.supplier)||!['自愿','非自愿'].includes(form.nature)||!AIRLINES.includes(form.airline))throw Error('请选择供应商、退票性质和出票航司');
    if(!Number.isFinite(M.time(form.rDate))||M.time(form.rDate)>M.time(now))throw Error('已R时间须有效，且不能晚于演示当前时间');
    const n=Math.max(0,...tickets.map(t=>Number(t.id.slice(1))||0))+1,id='P'+String(n).padStart(3,'0');
    const t={...form,passenger:form.passenger.trim(),id,order:'RF-TRIGGER-'+id,ticket:'781-NEW-'+id,internalBill:'IRF-'+id,collector:'林晓',
      amount:2860,currency:'CNY',pnr:'DEMO01',followupId:null,bill:null,createdAt:now,scene:'模拟乘机人变为已R'};
    tickets.push(t);return t;
  }
  return {SUPPLIERS,AIRLINES,seedConfig,seedTickets,validate,resolve,dueNow,inspect,check,addTicket};
})();
