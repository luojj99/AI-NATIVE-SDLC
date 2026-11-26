/* 浏览器内 Excel 读写。导入仅修改本地演示记录，不访问外部接口。 */
window.RefundExcel = (() => {
  const M=window.RefundModel,X=window.XLSX;
  const columns=[
    ['id','记录编号',15],['order','订单号',23],['ticket','票号',21],['passenger','乘机人',13],['supplier','供应商',18],
    ['from','导出时状态',19],['to','目标状态',19],['promise','承诺退款日期',23],['next','下次核实时间',23],
    ['chaseDate','最近催款时间',23],['role','处理角色',13],['owner','处理人',13],['collector','追款负责人',16],
    ['note','说明',40],['originalCount','当前催款次数',16],['count','催款次数修正值',18],['token','导出校验标识',22]
  ];
  const text=v=>String(v??'').trim();
  // 旧版导出文件的状态值也可继续回填。
  const normalizeStateLabel=value=>text(value)==='已R暂不核实'?M.byState.wait.label:value;
  const stateId=v=>M.STATES.find(s=>s.label===text(v)||s.id===text(v))?.id;
  const blank=v=>v===null||v===undefined||text(v)==='';
  function signature(r){
    const s=JSON.stringify([r.id,r.order,r.ticket,r.state,r.role,r.owner,r.collector,r.next,r.promise,r.chaseDate,r.count,r.entered,r.bill,r.logs,r.notes]);
    let hash=2166136261;for(let i=0;i<s.length;i++){hash^=s.charCodeAt(i);hash=Math.imul(hash,16777619);}return 'R'+(hash>>>0).toString(16).padStart(8,'0');
  }
  function exportRows(records){return records.map(r=>({id:r.id,order:r.order,ticket:r.ticket,passenger:r.passenger,supplier:r.supplier,from:M.byState[r.state].label,to:'',promise:'',next:'',chaseDate:'',role:r.role,owner:r.owner,collector:r.collector,note:'',originalCount:r.count,count:'',token:signature(r)}));}
  function rules(){return [
    ['当前状态','可填写的人工目标状态','特别要求 / 自动流转'],
    ...M.STATES.map(s=>[s.label,Object.keys(M.edges[s.id]||{}).map(k=>M.byState[k].label).join('、')||'无人工流转目标，可保留当前状态补充信息',({wait:'核实时间到且未来账，系统转待财务核实',chased:'每次实际催款后进入；超5个自然日仍停留，系统转供应反馈异常',promised:'承诺日期必填；超过承诺截止点且未来账，系统转承诺到期未退',done:'终态，不回退不重开',closed:'终态，不回退不重开'}[s.id]||'按既有状态规则办理')]),
    ['任一非终态','来账已完结由系统自动处理','必须有已匹配或关联的对应外部退票单；Excel不能凭填写状态替代关联依据'],
    ['目标状态','必填项','填写规则'],
    ['全部人工更新','处理角色、处理人；从待财务核实流转另需追款负责人','角色与人员须存在且对应；目标与当前相同时仅修改信息，不增加催款次数或重置计时'],
    ['已承诺退款','承诺退款日期','进入时须为明确且尚未到期的日期或时刻，不能填写“下期”'],
    [M.byState.wait.label,'下次核实时间','进入时截止时间须晚于当前演示时间'],
    ['已催款','最近催款时间','填写实际催款日期。催款次数默认加1，修正值选填，须为非负整数。'],
    ['当前状态','目标状态','处理提示'],
    ...Object.entries(M.edges).flatMap(([from,targets])=>Object.keys(targets).map(to=>[M.byState[from].label,M.byState[to].label,M.processingHint(from,to)]))
  ];}
  function workbook(rows,{feedback=false,now=''}={}){
    const wb=X.utils.book_new(),cols=feedback?[...columns,['result','校验结果',18],['message','校验说明',65]]:columns;
    const ws=X.utils.aoa_to_sheet([cols.map(c=>c[1]),...rows.map(r=>cols.map(c=>r[c[0]]??''))]);
    ws['!cols']=cols.map(([key,,wch])=>({wch,hidden:key==='token'}));
    ws['!autofilter']={ref:X.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:cols.length-1}})};
    for(let row=1;row<=rows.length;row++)for(const key of ['promise','next','chaseDate']){
      const col=cols.findIndex(c=>c[0]===key),value=rows[row-1][key];
      if(M.validInputDate(value)){
        const parts=value.match(/\d+/g).map(Number),serial=(Date.UTC(parts[0],parts[1]-1,parts[2],parts[3]||0,parts[4]||0,parts[5]||0)-Date.UTC(1899,11,30))/86400000;
        ws[X.utils.encode_cell({r:row,c:col})]={t:'n',v:serial,z:value.includes('T')?'yyyy-mm-dd hh:mm:ss':'yyyy-mm-dd'};
      }
    }
    X.utils.book_append_sheet(wb,ws,'批量流转');
    const help=X.utils.aoa_to_sheet([
      ['已R未退 · Excel批量流转填写说明',''],
      ['导出范围',`${rows.length}笔；原型演示时间 ${now.replace('T',' ')}（北京时间）`],
      ['1. 发给供应','保留记录编号、导出时状态及隐藏的导出校验标识；供应可填写目标状态、明确的承诺退款日期及说明。'],
      ['2. 我方核实','按“状态与必填规则”里的处理提示核实业务情况，补齐对应日期、处理角色和处理人。供应承诺“下期退款”时须先明确日期。'],
      ['3. 导入预览','允许混合当前状态及目标状态，逐行校验。目标状态留空的行跳过；有错误的行不更新，可下载校验结果修改后再导入。'],
      ['4. 确认更新','核对预览中的处理提示和校验结果，点击“确认更新”提交通过的行。提交时会再次核对记录是否已变化。'],
      ['日期格式','可填写Excel日期值，或2026-11-30、2026-11-30 18:00。仅日期按当天结束判断；时刻按北京时间判断。'],
      ['催款次数','当前催款次数只供参考。进入已催款默认原值加1；确需修正时填“催款次数修正值”。保留当前状态编辑不会加1或重置计时。'],
      ['同状态编辑','目标填写当前状态可修改当前信息；仍须填写该状态要求的日期及处理人。终态仅可补充信息，不能回退。'],
      ['校验标识','隐藏列用于核对记录是否在导出后变化，请勿删除。若提示记录变化，请重新导出最新记录。'],
      ['人员范围',Object.entries(M.PEOPLE).map(([role,names])=>role+'：'+names.join('、')).join('；')],
      ['文件范围','导入本原型导出的.xlsx或.xls，最多1000笔、10MB。保留“批量流转”工作表和表头。数据仅保存在当前浏览器。']
    ]);help['!cols']=[{wch:20},{wch:105}];X.utils.book_append_sheet(wb,help,'填写说明');
    const rule=X.utils.aoa_to_sheet(rules());rule['!cols']=[{wch:24},{wch:65},{wch:95}];X.utils.book_append_sheet(wb,rule,'状态与必填规则');return wb;
  }
  function download(rows,name,options={}){X.writeFile(workbook(rows,options),name,{compression:true});}
  function parseDate(value,date1904,hasTime=false){
    if(blank(value))return '';
    if(typeof value==='number'){
      const d=X.SSF.parse_date_code(value,{date1904});
      if(!d)return text(value);
      const date=[String(d.y).padStart(4,'0'),String(d.m).padStart(2,'0'),String(d.d).padStart(2,'0')].join('-');
      return hasTime||d.H||d.M||d.S?date+'T'+[d.H,d.M,d.S].map(v=>String(v).padStart(2,'0')).join(':'):date;
    }
    const raw=text(value),m=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if(!m)return raw;
    return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0')+(m[4]!==undefined?'T'+m[4].padStart(2,'0')+':'+m[5]+(m[6]?':'+m[6]:''):'');
  }
  function read(buffer){
    const wb=X.read(buffer,{type:'array',cellDates:false,cellFormula:true,cellNF:true,sheetRows:1002});
    const ws=wb.Sheets['批量流转'];if(!ws)throw Error('未找到“批量流转”工作表，请使用本原型导出的Excel。');
    const full=ws['!fullref']||ws['!ref'];if(!full)throw Error('工作表为空。');
    const range=X.utils.decode_range(full);if(range.e.r>1000)throw Error('一次最多导入1000笔，请拆分文件。');
    if(range.e.c>100)throw Error('工作表列数异常，请保留原模板表头。');
    const header=[];for(let c=0;c<=range.e.c;c++)header.push(text(ws[X.utils.encode_cell({r:0,c})]?.v));
    const missing=columns.filter(c=>!header.includes(c[1])).map(c=>c[1]);if(missing.length)throw Error('缺少表头：'+missing.join('、')+'。请使用完整导出模板。');
    if(columns.some(c=>header.filter(h=>h===c[1]).length!==1))throw Error('存在重复表头，请保留每个字段各一列。');
    const rows=[];
    for(let n=1;n<=range.e.r;n++){
      const row={line:n+1,parseErrors:[]};
      columns.forEach(([key,label])=>{
        const cell=ws[X.utils.encode_cell({r:n,c:header.indexOf(label)})];
        if(cell?.f)row.parseErrors.push(label+'含公式，请粘贴为数值或文本后导入');
        if(cell?.t==='e')row.parseErrors.push(label+'包含Excel错误值');
        row[key]=['promise','next','chaseDate'].includes(key)?parseDate(cell?.v,!!wb.Workbook?.WBProps?.date1904,/[hs]/i.test(String(cell?.z||'').replace(/"[^"]*"/g,''))):(cell?.v??'');
      });
      if(columns.every(([key])=>blank(row[key])))continue;
      rows.push(row);
    }
    if(!rows.length)throw Error('文件没有可读取的数据行。');return rows;
  }
  function validate(rows,records,now){
    const duplicates=new Set(rows.map(r=>text(r.id)).filter((id,i,a)=>id&&a.indexOf(id)!==i));
    return rows.map(input=>{
      const row={...input,from:normalizeStateLabel(input.from),to:normalizeStateLabel(input.to)};
      const id=text(row.id),r=records.find(r=>r.id===id),to=stateId(row.to),from=stateId(row.from),errors=[...(row.parseErrors||[])];
      if(blank(row.to))return {...row,id,kind:'skip',errors:[],message:'目标状态未填写，保留原记录'};
      if(!r)errors.push('记录编号不存在');
      if(duplicates.has(id))errors.push('记录编号在文件中重复，请只保留一行');
      if(!to)errors.push('目标状态无效，请填写完整状态名称');
      if(r){
        if(text(row.ticket)!==r.ticket||text(row.order)!==r.order||text(row.passenger)!==r.passenger||text(row.supplier)!==r.supplier)errors.push('记录编号与订单、票号、乘机人或供应商不一致');
        if(from!==r.state)errors.push('当前状态已变化或导出时状态不一致，请重新导出');
        if(text(row.token)!==signature(r))errors.push('记录在导出后已更新或校验标识缺失，请重新导出');
        if(to&&!M.allowed(r.state).includes(to)){
          errors.push(to==='done'?'来账已完结须由对应外部退票单关联成功后自动触发':M.terminal(r.state)?'终态不能回退或重开':`不允许从${M.byState[r.state].label}流转至${M.byState[to].label}；请查阅“状态与必填规则”`);
        }
        if(to!==r.state&&r.bill?.matched)errors.push('对应外部退票单已关联，请先由系统自动完结');
      }
      const changed=!!r&&r.state!==to;
      const payload={role:text(row.role),owner:text(row.owner),collector:text(row.collector),promise:text(row.promise),next:text(row.next),chaseDate:text(row.chaseDate),note:text(row.note),count:blank(row.count)?(r?.count||0)+(changed&&to==='chased'?1:0):Number(row.count)};
      if(!M.PEOPLE[payload.role])errors.push('处理角色必填且须为财务、售后或商务');
      if(!payload.owner)errors.push('处理人必填');else if(!M.PEOPLE[payload.role]?.includes(payload.owner))errors.push('处理人与处理角色不匹配');
      if(changed&&r?.state==='finance'&&!M.PEOPLE['财务'].includes(payload.collector))errors.push('从待财务核实流转时须填写有效的追款负责人');
      for(const [state,key,label] of [['promised','promise','承诺退款日期'],['wait','next','下次核实时间'],['chased','chaseDate','最近催款时间']]){
        if(to===state){
          if(!M.validInputDate(payload[key]))errors.push(label+'必填，须为真实明确的日期或时刻');
          else if(changed&&state!=='chased'&&M.deadline(payload[key])<=M.time(now))errors.push(label+'截止时间必须晚于当前演示时间');
        }
      }
      if(to==='chased'&&M.validInputDate(payload.chaseDate)&&(payload.chaseDate.slice(0,10)>now.slice(0,10)||(payload.chaseDate.includes('T')&&M.time(payload.chaseDate)>M.time(now))))errors.push('最近催款时间不能晚于当前演示时间');
      if(!blank(row.count)&&to!=='chased')errors.push('催款次数修正值仅在目标为已催款时填写；其他状态请用列表“编辑字段”');
      if(!blank(row.count)&&(!Number.isInteger(payload.count)||payload.count<0))errors.push('催款次数修正值须为非负整数');
      if(r&&to&&!errors.length){const error=M.validate(r,to,payload,now);if(error)errors.push(error);}
      return {...row,id,toId:to,fromId:from,payload,kind:errors.length?'error':'valid',errors:[...new Set(errors)],message:errors.length?[...new Set(errors)].join('；'):M.processingHint(from,to)};
    });
  }
  return {columns,signature,exportRows,workbook,download,read,validate,parseDate,rules};
})();
