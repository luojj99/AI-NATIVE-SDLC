(() => {
 const M=window.RefundModel, T=window.RefundTrigger, X=window.RefundExcel, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const docsLink=$('#product-docs');
 if(location.protocol==='https:' || location.protocol==='http:'){
   const docsUrl=new URL(docsLink.href), previewParams=new URLSearchParams(location.search);
   for(const key of ['eo_token','eo_time']) if(previewParams.has(key)) docsUrl.searchParams.set(key,previewParams.get(key));
   docsLink.href=docsUrl.href;
 }
 const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const KEY='refund-prototype-v2.0',PAGE_ORDER=['R004','R009','R011','R015','R013','R017','R019','R007','R001','R022','R025','R005','R006','R027'];
 const emptyFilters=()=>({q:'',status:'',supplier:'',owner:'',rFrom:'',rTo:'',daysMin:'',daysMax:'',countMin:'',countMax:''});
 const filterFields=['q','status','supplier','owner','rFrom','rTo','daysMin','daysMax','countMin','countMax'];
 let records=M.seed(),tickets=T.seedTickets(),config=T.seedConfig(),configDraft=null,lastCheck=null,view='list',now=M.NOW,selected=new Set(),filters=emptyFilters(),page=1,pageSize=12,detailId=null,detailMode='view',permission='edit',historyTab='notes',compose=false,modal=null,toastTimer,returnFocus=null;
 try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved?.version===2&&Array.isArray(saved.records)&&Array.isArray(saved.tickets)&&saved.config&&!T.validate(saved.config)){records=saved.records;tickets=saved.tickets;config=saved.config;lastCheck=saved.lastCheck||null;now=saved.now||M.NOW;}}catch{}
 try{permission=localStorage.getItem(KEY+'-permission')==='view'?'view':'edit';}catch{}
 const canEdit=()=>permission==='edit';
 const canModifyDetail=()=>canEdit()&&detailMode==='edit';
 function requireEdit(){if(!canEdit()){toast('无编辑权限，无法进入编辑或执行修改；请点击“查看”浏览只读信息',true);return false;}return true;}
 function persist(){try{localStorage.setItem(KEY,JSON.stringify({version:2,records,tickets,config,lastCheck,now}));}catch{toast('当前浏览器不支持保存，刷新将恢复演示数据');}}
 function toast(text,error=false){const el=$('#toast');el.textContent=text;el.className='toast show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3800);}
 const icon=(name,size=16)=>{const paths={search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',arrow:'<path d="M5 12h14M14 7l5 5-5 5"/>',list:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',back:'<path d="M19 12H5m5-5-5 5 5 5"/>',empty:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5M8 17h2"/>'};return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.list}</svg>`;};
 const ann=n=>`<span class="annotation" role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false" data-action="annotation" data-n="${n}" aria-label="查看原型标注${n}" title="原型标注 ${n}">${n}</span>`;
 const tag=s=>`<span class="tag ${M.byState[s].color}">${M.byState[s].label}</span>`;
 const date=v=>v?e(v.replace('T',' ')):'<span class="muted">—</span>';
 const opt=(v,label,value)=>`<option value="${e(v)}" ${v===value?'selected':''}>${e(label??v)}</option>`;
 const people=Object.values(M.PEOPLE).flat();
 function safeHtml(raw){const div=document.createElement('div');div.innerHTML=raw;[...div.querySelectorAll('*')].reverse().forEach(n=>{if(!['B','STRONG','I','EM','U','UL','OL','LI','P','DIV','BR'].includes(n.tagName)){n.replaceWith(document.createTextNode(n.textContent));}else [...n.attributes].forEach(a=>n.removeAttribute(a.name));});return div.innerHTML;}
 const getRecord=id=>records.find(r=>r.id===id);
 const configSignature=c=>JSON.stringify([Number(c.defaultDays),c.rules.map(r=>[r.id,r.supplier,r.nature,r.airline,Number(r.days),r.enabled])]);
 function goConfig(){closeOverlay();if(location.hash==='#config')render();else location.hash='config';window.scrollTo(0,0);}
 function ruleRow(r,i){return `<tr data-rule="${e(r.id)}"><td><input type="checkbox" data-rule-field="enabled" ${r.enabled?'checked':''} aria-label="启用规则${i+1}" ${canEdit()?'':'disabled'}></td><td><select data-rule-field="supplier" aria-label="规则${i+1}供应商">${opt('','不限',r.supplier)}${T.SUPPLIERS.map(v=>opt(v,v,r.supplier)).join('')}</select></td><td><select data-rule-field="nature" aria-label="规则${i+1}退票性质">${['','自愿','非自愿'].map(v=>opt(v,v||'不限',r.nature)).join('')}</select></td><td><select data-rule-field="airline" aria-label="规则${i+1}出票航司">${opt('','不限',r.airline)}${T.AIRLINES.map(v=>opt(v,v,r.airline)).join('')}</select></td><td><input type="number" min="1" max="36500" step="1" data-rule-field="days" value="${e(r.days)}" aria-label="规则${i+1}天数"></td><td><button class="link-button danger" data-action="remove-rule" data-id="${e(r.id)}" ${canEdit()?'':'disabled'}>删除</button></td></tr>`;}
 function renderConfig(){
   delete $('#main').dataset.mode;configDraft=M.clone(config);
   $('#main').innerHTML=`<div class="config-page"><button class="text-button detail-back" data-action="list">${icon('back',15)} 返回跟进列表</button><div class="heading spread"><div><div class="eyebrow">首次触发规则</div><h1>已R未退触发时长配置${ann(10)}</h1><p>已R后先等待，期限到达且仍未来账时，才创建“待财务核实”跟进单。</p></div><span class="outline-tag">按乘机人计算</span></div>
   <div class="trigger-principle"><strong>特殊规则命中多条，取最长天数</strong><p>选中的条件必须同时满足，未限定的条件视为不限；没有命中特殊规则，才使用通用天数。配置只影响尚未建单的票。</p></div>
   <section class="card config-card"><div class="card-head"><h2>通用与特殊规则</h2><span id="config-save-state">已保存配置</span></div><fieldset id="config-fields" ${canEdit()?'':'disabled'}><div class="config-default"><label for="default-days">通用天数</label><input id="default-days" type="number" min="1" max="36500" step="1" value="${config.defaultDays}"><span>个自然日</span><small>初始15天，仅在没有特殊规则命中时使用。</small></div><div class="config-rule-heading"><h3>特殊规则</h3><button data-action="add-rule">＋ 新增特殊规则</button></div><div class="table-wrap"><table class="rule-table"><thead><tr><th>启用</th><th>供应商</th><th>退票性质</th><th>出票航司</th><th>自然日天数</th><th>操作</th></tr></thead><tbody id="rule-rows">${config.rules.map(ruleRow).join('')}</tbody></table></div></fieldset><div id="config-error" class="config-error" role="alert" hidden></div><div class="config-save-bar"><p>修改、停用或删除后须保存。尚未建单的票按新配置判断，已建单记录继续按当前状态办理。</p><button class="primary" data-action="save-config" ${canEdit()?'':'disabled'}>保存配置</button></div></section>
   </div>`;
 }
 function readConfigDraft(){
   configDraft={defaultDays:Number($('#default-days').value),rules:$$('#rule-rows tr').map(row=>{const r={id:row.dataset.rule};row.querySelectorAll('[data-rule-field]').forEach(el=>r[el.dataset.ruleField]=el.type==='checkbox'?el.checked:el.dataset.ruleField==='days'?Number(el.value):el.value);return r;})};
   return configDraft;
 }
 function markConfigDirty(){readConfigDraft();const dirty=configSignature(configDraft)!==configSignature(config);$('#config-save-state').textContent=dirty?'有未保存的修改':'已保存配置';$('#config-save-state').classList.toggle('unsaved',dirty);}
 function requireSavedConfig(){if(view!=='config')return true;readConfigDraft();if(configSignature(configDraft)===configSignature(config))return true;toast('配置尚未保存，请先点击“保存配置”再执行演示操作',true);return false;}
 function saveConfig(){
   const draft=readConfigDraft(),error=T.validate(draft);if(error){$('#config-error').textContent=error;$('#config-error').hidden=false;return;}
   config=M.clone(draft);persist();$('#config-error').hidden=true;markConfigDirty();toast('配置已保存，将用于尚未建跟进单的票');
 }
 function executeTriggerCheck(value){
   if(!value||!Number.isFinite(M.time(value)))return toast('请选择有效的演示时间',true);
   if(M.time(value)<M.time(now))return toast('演示时间只能向前推进；重新开始请恢复演示数据',true);
   now=value;lastCheck=T.check(tickets,records,config,now);persist();render();toast(`检查完成：新建 ${lastCheck.created.length} 笔跟进单，原跟进单自动流转 ${lastCheck.changes.length} 笔`);
 }
 function route(){view=location.hash==='#config'?'config':'list';const match=location.hash.match(/^#detail\/(R\d+)(?:\?mode=(edit|view))?$/);detailId=match&&getRecord(match[1])?match[1]:null;detailMode=match?.[2]||'view';if(detailId&&detailMode==='edit'&&!canEdit()){detailId=null;detailMode='view';history.replaceState(null,'','#list');render();requireEdit();return;}render();}
 function list(){location.hash='list';if(!detailId&&view==='list')renderList();}
 function openDetail(id,mode='view'){if(mode==='edit'&&!requireEdit())return;closeOverlay();historyTab='notes';compose=false;const hash='#detail/'+id+'?mode='+mode;if(location.hash===hash)route();else location.hash=hash;window.scrollTo(0,0);}
 function render(){closeAnnotation(false);removeMore();$('#crumb').textContent=view==='config'?'已R未退触发时长配置':detailId?'已R未退 / 跟进详情':'已R未退';$$('.sidebar .nav-item').forEach(b=>b.classList.toggle('active',b.dataset.action===(view==='config'?'config':'list')));$('#side-count').textContent=records.filter(r=>!M.terminal(r.state)).length;$('#clock-label').textContent='演示时间 '+now.replace('T',' ')+'（北京时间）';$('#permission-label').textContent='演示操作员 · '+(canEdit()?'可编辑':'仅查看');view==='config'?renderConfig():detailId?renderDetail():renderList();}
 function filtered(){return records.filter(r=>{
   const q=filters.q.trim().toLowerCase();
   if(q&&![r.id,r.order,r.ticket,r.passenger,r.scene].join(' ').toLowerCase().includes(q))return false;
   if(filters.status&&r.state!==filters.status)return false;
   if(filters.supplier&&r.supplier!==filters.supplier)return false;
   if(filters.owner&&(filters.owner==='unassigned'?!!r.owner:r.owner!==filters.owner))return false;
   const rDay=r.rDate.slice(0,10),duration=M.daySpan(r.rDate,now);
   if(filters.rFrom&&rDay<filters.rFrom)return false;
   if(filters.rTo&&rDay>filters.rTo)return false;
   if(filters.daysMin!==''&&duration<Number(filters.daysMin))return false;
   if(filters.daysMax!==''&&duration>Number(filters.daysMax))return false;
   if(filters.countMin!==''&&r.count<Number(filters.countMin))return false;
   if(filters.countMax!==''&&r.count>Number(filters.countMax))return false;
   return true;
 }).sort((a,b)=>{const rank=id=>PAGE_ORDER.includes(id)?PAGE_ORDER.indexOf(id):100+Number(id.slice(1));return rank(a.id)-rank(b.id);});}
 function rowDeadline(r){if(r.state==='wait')return `${date(r.next)}<small>下次核实${ann(2)}</small>`;if(r.state==='chased')return `${date(M.addDays(r.entered,5))}<small>本轮等待截止${ann(3)}</small>`;if(['promised','overdue'].includes(r.state))return `${date(r.promise)}<small>承诺退款时间${ann(4)}</small>`;if(M.terminal(r.state))return '<span class="muted">跟进已结束</span>';return '<span class="muted">待人工处理</span>';}
 function renderRow(r){return `<tr class="${selected.has(r.id)?'is-selected':''}" data-record="${r.id}"><td><input type="checkbox" data-select="${r.id}" ${selected.has(r.id)?'checked':''} aria-label="选择${r.id}"></td><td><button class="tag status-trigger ${M.byState[r.state].color}" data-action="process" data-id="${r.id}" aria-label="处理${r.id}：${M.byState[r.state].label}" title="点击打开状态流转处理弹窗">${M.byState[r.state].label}</button><small>${r.id} ${r.state==='done'?'· 外部单已关联':r.state==='closed'?'· 已核实实际未R':''}</small></td><td><a class="order-link" href="#detail/${r.id}?mode=view">${r.order}</a><small class="ticket">${r.ticket}</small></td><td>${r.passenger}<small>${r.supplier}</small></td><td class="mono">${date(r.rDate)}<small>已R ${M.daySpan(r.rDate,now)} 天</small></td><td><span class="person">${r.owner?`<span class="person-dot">${r.owner.slice(0,1)}</span>${e(r.owner)}`:'<span class="muted">待分配</span>'}</span><small>${r.role}</small></td><td class="mono">${r.count}<span class="muted"> 次</span><small>${r.chaseDate?date(r.chaseDate):'尚未催款'}</small></td><td class="mono">${rowDeadline(r)}</td><td><div class="scene">${e(r.scene)}</div></td><td><div class="row-ops"><button class="link-button" data-action="edit-detail" data-id="${r.id}">编辑</button><button class="link-button" data-action="view-detail" data-id="${r.id}">查看</button><button class="row-more" data-action="more" data-id="${r.id}" aria-label="${r.id}更多操作">⋮</button></div></td></tr>`;}
 function renderList(){
   delete $('#main').dataset.mode;
   const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages);const visible=rows.slice((page-1)*pageSize,page*pageSize),allChecked=visible.length&&visible.every(r=>selected.has(r.id));
   const selectedStates=new Set([...selected].map(id=>getRecord(id)?.state));
   $('#main').innerHTML=`<div class="heading spread"><div><div class="eyebrow">REFUND FOLLOW-UP</div><h1>已R未退${ann(1)}</h1><p>跟进每一笔退票账单，让待办有据可查</p></div><div class="flex heading-actions"><button data-action="config">已R未退触发时长配置</button><span class="date-label">演示时间 · ${now.replace('T',' ')}</span><button class="primary" data-action="scenes">${icon('list')} 演示场景</button></div></div>
    <form class="search-card card" id="search-form"><div class="search-grid"><label>订单 / 票号 / 乘机人<input name="q" value="${e(filters.q)}" placeholder="输入订单号、票号、乘机人或场景关键词" aria-label="订单、票号、乘机人"></label><label>业务状态<select name="status">${opt('','全部状态',filters.status)}${M.STATES.map(s=>opt(s.id,s.label,filters.status)).join('')}</select></label><label>供应商<select name="supplier">${opt('','全部供应商',filters.supplier)}${[...new Set(records.map(r=>r.supplier))].map(s=>opt(s,s,filters.supplier)).join('')}</select></label><label>处理人<select name="owner">${opt('','全部处理人',filters.owner)}${opt('unassigned','待分配',filters.owner)}${people.map(s=>opt(s,s,filters.owner)).join('')}</select></label>
    <div class="search-field"><span>已R时间</span><div class="range-input"><input type="date" name="rFrom" value="${e(filters.rFrom)}" aria-label="已R开始日期"><span>至</span><input type="date" name="rTo" value="${e(filters.rTo)}" aria-label="已R结束日期"></div></div>
    <div class="search-field"><span>已R时长（天）</span><div class="range-input"><input type="number" name="daysMin" value="${e(filters.daysMin)}" min="0" step="1" placeholder="最少天数" aria-label="已R最少天数"><span>至</span><input type="number" name="daysMax" value="${e(filters.daysMax)}" min="0" step="1" placeholder="最多天数" aria-label="已R最多天数"></div></div>
    <div class="search-field"><span>催款次数</span><div class="range-input"><input type="number" name="countMin" value="${e(filters.countMin)}" min="0" step="1" placeholder="最少次数" aria-label="最少催款次数"><span>至</span><input type="number" name="countMax" value="${e(filters.countMax)}" min="0" step="1" placeholder="最多次数" aria-label="最多催款次数"></div></div>
    <div class="search-actions"><button class="primary" type="submit">${icon('search',14)} 查询</button><button type="button" data-action="clear-filters">重置</button></div></div><div class="search-help">区间包含起止值，可只填一端；已R时长按当前演示时间计算。多个条件同时满足才会显示。</div><div id="search-error" class="search-error" role="alert" hidden></div></form>
    <section class="card"><div class="list-toolbar"><div class="toolbar-actions"><button class="batch-action primary" data-action="batch-transition" ${selected.size&&canEdit()?'':'disabled'} title="${selected.size?'处理已选中的记录':'请先勾选记录'}">批量流转状态</button>${ann(6)}<button class="batch-action secondary" data-action="batch-count" ${selected.size&&canEdit()?'':'disabled'} title="${selected.size?'修改已选记录的催款次数':'请先勾选记录'}">编辑字段 · 催款次数</button><button data-action="excel-export" ${rows.length||selected.size?'':'disabled'}>导出Excel${selected.size?'（已选'+selected.size+'笔）':'（筛选结果）'}</button><button data-action="excel-import" ${canEdit()?'':'disabled'}>Excel批量流转</button></div><div class="list-count"><span>共 <strong>${rows.length}</strong> 笔</span></div></div>
    ${selected.size?`<div class="selected-bar"><span>已选择 <strong>${selected.size}</strong> 笔</span><span>${selectedStates.size===1?'当前状态相同，可批量处理':'包含不同状态；请导出Excel后混合批量流转'}</span><button class="link-button" data-action="clear-selection">清空选择</button></div>`:''}
    <div class="table-wrap"><table class="data-table"><colgroup><col style="width:39px"><col style="width:130px"><col style="width:154px"><col style="width:112px"><col style="width:106px"><col style="width:88px"><col style="width:82px"><col style="width:138px"><col style="width:184px"><col style="width:100px"></colgroup><thead><tr><th><input type="checkbox" id="select-page" ${allChecked?'checked':''} aria-label="选择本页全部记录"></th><th>状态</th><th>订单号 / 票号</th><th>乘机人 / 供应商</th><th>已R时间 / 时长${ann(2)}</th><th>处理人${ann(7)}</th><th>催款次数${ann(3)}</th><th>关键时间</th><th>演示场景</th><th>操作</th></tr></thead><tbody>${visible.map(renderRow).join('')}</tbody></table>${!rows.length?`<div class="empty">${icon('empty',34)}<h3>暂无符合条件的记录</h3><p>试试调整筛选条件，或 <button class="link-button" data-action="clear-filters">查看全部记录</button></p></div>`:''}</div>
    <div class="pagination"><span>共 ${rows.length} 笔 · 当前 ${rows.length?(page-1)*pageSize+1:0}–${Math.min(page*pageSize,rows.length)} 笔</span><div class="flex"><button data-action="page" data-page="${page-1}" ${page===1?'disabled':''} aria-label="上一页">‹</button>${Array.from({length:pages},(_,i)=>`<button class="${page===i+1?'active':''}" data-action="page" data-page="${i+1}">${i+1}</button>`).join('')}<button data-action="page" data-page="${page+1}" ${page===pages?'disabled':''} aria-label="下一页">›</button><select id="page-size" aria-label="每页条数">${[12,20,50].map(n=>opt(String(n),n+' 条 / 页',String(pageSize))).join('')}</select></div></div></section>`;
   if($('#select-page'))$('#select-page').indeterminate=!allChecked&&visible.some(r=>selected.has(r.id));
 }
 function kv(label,value,hint=''){return `<div class="kv"><label>${label}</label><div>${value||'—'}</div>${hint?`<div class="hint">${hint}</div>`:''}</div>`;}
 function renderDetail(){
   const r=getRecord(detailId);if(!r)return list();const ended=M.terminal(r.state),editable=canModifyDetail();$('#main').dataset.mode=editable?'edit':'view';
   const messages={wait:'等待对应外部退票单。到达下次核实截止点仍未来账，自动转待财务核实。',finance:'核实票号是否真实已R，并排查外部退票单是否未导入、未匹配或需要手工补建。',service:'请核实财务无法确认的票号状态。确认真实已R可直接转待催款；确认实际未R可直接关闭。',ready:'已确认真实已R且仍未来账。实际发出本轮催款邮件后，才能转为已催款。',chased:'等待处理人登记供应回复；系统不读取邮箱。超过本轮5个自然日仍未流转，将进入供应反馈异常。',abnormal:'本轮等待已超时，但不代表供应没有回复。可登记迟到回复、再次催款或交商务协调。',promised:'已接受供应的明确承诺。承诺截止点过后仍未关联外部单，将自动转为承诺到期未退。',overdue:'承诺时间已过，仍未来账。“未退”仅指缺少对应账单，不代表已经核实资金未到账。',business:'商务协调中。无结果或供应明确拒退时，继续保留本状态；本期没有放弃追款或损失核销终态。',done:'对应外部退票单已关联，本模块跟进结束。金额差异交差异单处理，不代表资金到账或批次结算完成。',closed:'已核实实际未R，本笔跟进已关闭。本版不提供回退或重开流转。'};
   $('#main').innerHTML=`<button class="text-button detail-back" data-action="list">${icon('back',15)} 返回跟进列表</button><div class="detail-head"><div class="spread"><div><div class="detail-title"><h1>已R未退详情</h1><span class="outline-tag">${r.id}</span><span class="detail-mode ${editable?'editable':''}">${editable?'可编辑':'只读查看'}</span></div><div class="detail-meta"><span>${r.order}</span><span>${r.passenger} · ${r.supplier}</span></div></div><div class="flex"><button data-action="annotation" data-n="1">查看跟进规则</button>${editable?`<button class="primary" data-action="process" data-id="${r.id}">${ended?'编辑信息':'处理 / 编辑'}</button>`:''}</div></div></div>
    <section class="detail-summary card"><div class="summary-top"><div><span class="status-caption">当前状态</span>${tag(r.state)}${ann(5)}</div><span class="muted" style="font-size:11px">最近更新 ${date(r.logs.at(-1)?.at)}</span></div><div class="notice ${ended?'green':['overdue','abnormal','business'].includes(r.state)?'warn':''}"><span class="info-mark">i</span><span>${messages[r.state]}</span></div><div class="summary-grid"><div class="summary-metric"><label>已R时间${ann(2)}</label><div class="value">${date(r.rDate)}</div></div><div class="summary-metric"><label>已R时长</label><div class="value">${M.daySpan(r.rDate,now)}<small>天</small></div></div><div class="summary-metric"><label>当前处理人${ann(7)}</label><div class="value">${e(r.owner)||'待分配'}<small>${r.role}</small></div></div><div class="summary-metric"><label>催款次数${ann(3)}</label><div class="value">${r.count}<small>次</small></div></div><div class="summary-metric"><label>${r.state==='wait'?'下次核实时间':r.promise?'承诺退款时间':'最近催款时间'}${ann(r.state==='wait'?2:r.promise?4:3)}</label><div class="value" style="font-size:14px">${date(r.state==='wait'?r.next:r.promise||r.chaseDate)}</div></div></div></section>
    <div class="detail-grid"><section class="card"><div class="card-head"><h2>基础信息</h2>${editable?`<button class="link-button" data-action="process" data-id="${r.id}">编辑</button>`:''}</div><div class="card-body kv-grid">${kv('订单号',e(r.order))}${kv('票号',e(r.ticket))}${kv('乘机人',e(r.passenger))}${kv('供应商',e(r.supplier))}${kv('内部退票单号',e(r.internalBill||'IRF2026'+r.id.slice(1)))}${r.nature?kv('退票性质',e(r.nature))+kv('出票航司',e(r.airline)):''}${r.triggerSnapshot?kv('首次建单依据',r.triggerSnapshot.days+'个自然日 · '+e(r.triggerSnapshot.source),'到期时间 '+r.triggerSnapshot.due.replace('T',' ')+'；建单后不随配置变化'):''}${kv('内部应退金额',r.currency+' '+r.amount.toLocaleString('zh-CN',{minimumFractionDigits:2}))}${kv('问题原因分类',e(r.category))}${kv('问题原因子类',e(r.subreason))}${kv('追款负责人',e(r.collector),'该供应商的追款负责人')}${kv('处理角色 / 处理人',r.role+' / '+(e(r.owner)||'待分配'),'本模块处理人，非原退票处理人')}</div></section>
    <section class="card"><div class="card-head"><h2>对应外部退票单${ann(1)}</h2>${r.bill?.matched?'<span class="tag green">已关联</span>':r.bill?'<span class="tag orange">未匹配</span>':'<span class="outline-tag">尚未关联</span>'}</div><div class="card-body">${r.bill?`<div class="bill-detail"><div class="spread"><label>外部退票单号</label><strong>${e(r.bill.number)}</strong></div><div class="spread"><label>账单来源</label><span>${e(r.bill.source)}</span></div><div class="spread"><label>外部单金额</label><span>${r.currency} ${r.bill.amount.toLocaleString('zh-CN',{minimumFractionDigits:2})}</span></div><div class="spread"><label>金额差异</label><span class="${r.bill.amount!==r.amount?'danger':''}">${r.bill.amount===r.amount?'金额一致':r.currency+' '+(r.amount-r.bill.amount).toFixed(2)+' · 交差异单处理'}</span></div><div class="notice ${r.bill.matched?'green':'warn'}"><span class="info-mark">i</span><span>${r.bill.matched?'对应外部单已关联，满足本模块完结条件。后续差异与资金核实在各自流程处理。':'外部单存在，但尚未匹配到本笔乘机人记录，不满足完结条件。'}</span></div></div>`:`<div class="bill-empty"><div class="bill-symbol">▤</div><h3>尚无已关联的外部退票单</h3><p>${r.id==='R005'?'即使钱已退回，仍需补建外部单并关联。':'等待供应导入，或由财务手工建立并关联。'}</p></div><div class="notice"><span class="info-mark">i</span><span>本模块以账单关联结果为完结依据，不以金额一致、实际到账或整批结算为前提。</span></div>`}</div></section></div>
    <section class="card"><div class="history-tabs"><button class="${historyTab==='notes'?'active':''}" data-action="history-tab" data-tab="notes">说明记录<span>${r.notes.length}</span></button><button class="${historyTab==='logs'?'active':''}" data-action="history-tab" data-tab="logs">操作记录<span>${r.logs.length}</span></button>${editable&&historyTab==='notes'?'<button class="link-button history-tools" data-action="compose-note">＋ 添加说明</button>':''}</div><div class="history-content">${editable&&compose&&historyTab==='notes'?`<div class="note-compose">${editor('detail-note','补充本笔记录的核实情况、供应反馈或处理说明')}<div class="flex" style="justify-content:flex-end;margin-top:12px"><button data-action="cancel-note">取消</button><button class="primary" data-action="save-note">保存说明</button></div></div>`:''}${[...(historyTab==='notes'?r.notes:r.logs)].reverse().map(n=>`<div class="timeline-item"><div class="timeline-top"><strong>${e(historyTab==='notes'?n.by:n.action)}${historyTab==='logs'?` <span class="muted">· ${e(n.by)}</span>`:''}</strong><time>${date(n.at)}</time></div><p>${historyTab==='notes'?(n.html?safeHtml(n.html):e(n.text)):e(n.detail)}</p></div>`).join('')||'<div class="empty">暂无记录</div>'}</div></section><p class="source-line">演示场景：${e(r.scene)}${editable?` · <button class="link-button" data-action="demo-bill" data-id="${r.id}">打开后台事件演示</button>（仅原型工具）`:''}</p>`;
 }
 function editor(id,placeholder){return `<div class="editor"><div class="editor-toolbar"><button type="button" data-action="format" data-command="bold" aria-label="加粗"><b>B</b></button><button type="button" data-action="format" data-command="italic" aria-label="斜体"><i>I</i></button><button type="button" data-action="format" data-command="underline" aria-label="下划线"><u>U</u></button><button type="button" data-action="format" data-command="insertUnorderedList" aria-label="项目列表">≡</button><span>富文本 · 选填</span></div><div class="editor-content" id="${id}" role="textbox" aria-label="说明（选填）" contenteditable="true" data-placeholder="${e(placeholder)}"></div></div>`;}
 function closeOverlay(){closeAnnotation(false);modal=null;$('#overlay-root').innerHTML='';document.body.style.overflow='';if(returnFocus?.isConnected)returnFocus.focus();}
 function overlay(html){closeAnnotation(false);if(!$('#overlay-root').children.length)returnFocus=document.activeElement;$('#overlay-root').innerHTML=html;document.body.style.overflow='hidden';const x=$('#overlay-root .icon-button');if(x)x.focus();}
 function modalShell(title,body,footer,subtitle='',cls=''){return `<div class="veil" data-overlay="true"><section class="modal ${cls}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><h2 id="modal-title">${title}</h2>${subtitle?`<small>${subtitle}</small>`:''}</div><button class="icon-button" data-action="close" aria-label="关闭弹窗">×</button></div><div class="modal-body">${body}</div><div class="modal-footer">${footer}</div></section></div>`;}
 function field(label,control,required=false){return `<div class="form-row"><div class="form-label">${required?'<span class="required">*</span>':''}${label}</div><div class="form-control">${control}</div></div>`;}
 function dateField(name,value,recordId){
   const precise=value?.includes('T'),verification=name==='next';
   const precisionLabel=verification?'核实时间精度':'承诺时间精度';
   const dateLabel=verification?'下次核实时间':'承诺退款时间';
   return `<div class="date-fields"><select data-date-mode="${name}" aria-label="${precisionLabel}">${opt('date','仅日期',precise?'datetime-local':'date')}${opt('datetime-local','日期和时刻',precise?'datetime-local':'date')}</select><input data-field="${name}" type="${precise?'datetime-local':'date'}" value="${e(value)}" aria-label="${dateLabel}${recordId?' '+recordId:''}"></div><div class="hint">仅日期：截止到当日结束；填写时刻：按该时刻判断（北京时间）。</div>`;
 }
 function transitionDefaults(r,to){const changed=r.state!==to,role=changed?M.byState[to].role:r.role;return {role,owner:changed?(role==='财务'?r.collector:role===r.role?r.owner:''):r.owner,collector:r.collector,category:r.category,subreason:r.subreason,next:changed?'':r.next,promise:changed?'':r.promise,chaseDate:changed?now.slice(0,10):r.chaseDate,count:r.count+(changed&&to==='chased'?1:0)};}
 function openProcess(ids){
   if(!requireEdit())return;
   if(detailId&&!canModifyDetail())return toast('当前详情为只读查看，请返回列表后从“编辑”入口进入',true);
   const rs=ids.map(getRecord).filter(Boolean);if(!rs.length)return;
   if(new Set(rs.map(r=>r.state)).size!==1)return toast('不同当前状态可通过“导出Excel → Excel批量流转”逐笔处理；列表弹窗请先选同一状态',true);
   modal={type:'process',ids:rs.map(r=>r.id),from:rs[0].state,to:rs[0].state,note:'',noteHtml:'',drafts:{}};
   renderProcess();
 }
 function currentDraft(){
   const {to,ids,drafts}=modal;
   if(drafts[to])return drafts[to];
   const [draft,...others]=ids.map(id=>transitionDefaults(getRecord(id),to));
   if(others.length){
     for(const [key,value] of Object.entries(draft)){
       if(others.some(other=>other[key]!==value))draft[key]='';
     }
     Object.assign(draft,{count:'',category:'',subreason:''});
   }
   drafts[to]=draft;
   return draft;
 }
 function readProcess(){
   if(!modal||modal.type!=='process')return;
   const draft=currentDraft();
   $$('#overlay-root [data-process-fields] [data-field]').forEach(input=>{draft[input.dataset.field]=input.value;});
   modal.note=$('#process-note')?.innerText||'';
   modal.noteHtml=safeHtml($('#process-note')?.innerHTML||'');
 }
 function processFields(record,draft,multi){
   const {to,from}=modal,changed=from!==to;
   const recordId=multi?'':record.id;
   const inputLabel=label=>recordId?label+' '+recordId:label;
   let fields='';
   if(to==='wait')fields+=field('下次核实时间'+ann(2),dateField('next',draft.next,recordId),true);
   if(to==='promised')fields+=field('承诺退款时间'+ann(4),dateField('promise',draft.promise,recordId),true);
   if(to==='chased'){
     const chaseHelp=changed?'默认带入演示当天，可修正。':'修正信息不触发再次催款。';
     const countHelp=multi
       ? (changed?'留空时按各笔原次数加 1。填写后统一为填写的次数。':'留空时保留各笔原次数。填写后统一修正，本轮计时继续。')
       : (changed?`原 ${record.count} 次 → 默认 ${record.count+1} 次，可修正。新一轮计时以本次进入已催款的时间为准。`:'保存当前状态不自动加1、不重置本轮5日计时。');
     fields+=field('最近催款时间',`<input type="date" data-field="chaseDate" value="${e(draft.chaseDate)}" aria-label="${inputLabel('最近催款时间')}"><div class="hint">${chaseHelp}</div>`,true);
     fields+=field('催款次数'+ann(3),`<input type="number" min="0" step="1" data-field="count" value="${e(draft.count)}" aria-label="${inputLabel('催款次数')}"><div class="hint">${countHelp}</div>`,!multi);
   }
   if(from==='finance'){
     const collectorHelp=multi?'选择后统一应用到全部所选记录。':'已带入该供应商的追款负责人。';
     fields+=field('追款负责人',`<select data-field="collector" aria-label="${inputLabel('追款负责人')}">${opt('','请选择追款负责人',draft.collector)}${M.PEOPLE['财务'].map(s=>opt(s,s,draft.collector)).join('')}</select><div class="hint">${collectorHelp}</div>`,changed);
   }
   const rolePlaceholder=multi?opt('','请选择统一处理角色',draft.role):'';
   const ownerPlaceholder=multi?'请选择统一处理人':'请选择处理人';
   fields+=field('处理角色'+ann(7),`<select data-field="role" data-role-select aria-label="${inputLabel('处理角色')}">${rolePlaceholder}${Object.keys(M.PEOPLE).map(s=>opt(s,s,draft.role)).join('')}</select>`,true);
   fields+=field('处理人',`<select data-field="owner" aria-label="${inputLabel('处理人')}">${opt('',ownerPlaceholder,draft.owner)}${(M.PEOPLE[draft.role]||[]).map(s=>opt(s,s,draft.owner)).join('')}</select>`,true);
   const reasonsId='subreasons-'+(recordId||'batch');
   const reasonHelp=multi?'填写后统一更新。两个字段留空时，沿用各笔已有原因。':'原因选项用于原型演示，不作为状态流转的前置校验。';
   const reasons=field('问题原因分类',`<div class="field-pair"><select data-field="category" data-category-select aria-label="${inputLabel('问题原因分类')}">${opt('','请选择分类',draft.category)}${Object.keys(M.REASONS).map(s=>opt(s,s,draft.category)).join('')}</select><input data-field="subreason" list="${reasonsId}" value="${e(draft.subreason)}" placeholder="选择或输入问题原因子类" aria-label="${inputLabel('问题原因子类')}"><datalist id="${reasonsId}">${(M.REASONS[draft.category]||[]).map(s=>`<option value="${e(s)}">`).join('')}</datalist></div><div class="hint">${reasonHelp}${ann(9)}</div>`);
   fields+=changed?`<details class="extra-fields"><summary>补充问题原因（选填）</summary>${reasons}</details>`:reasons;
   return `<div data-process-fields>${fields}</div>`;
 }
 function renderProcess(){
   const rs=modal.ids.map(getRecord),from=modal.from,to=modal.to,changed=from!==to,multi=rs.length>1,draft=currentDraft();
   const info = M.processingHint(from, to);
   let body=`<div id="form-error" class="error-banner" role="alert"></div><div class="context-strip">${multi?`<strong>批量处理 ${rs.length} 笔</strong><span>当前状态为${M.byState[from].label}</span><span>每个字段填一次，应用到全部所选记录</span>`:`<strong>${rs[0].order}</strong><span>${rs[0].passenger}</span><span>${rs[0].supplier}</span><span>${rs[0].ticket}</span>`}</div>`;
   body+=field('处理状态'+ann(5),`<div class="status-options">${M.allowed(from).map(s=>`<button type="button" class="status-option ${to===s?'selected':''}" data-action="target" data-target="${s}" aria-pressed="${to===s}">${M.byState[s].label}${s===from?'（当前）':''}</button>`).join('')}</div><div class="hint">${changed?'流转规则 '+M.edges[from][to]+' · 仅列出当前可人工到达的状态':'默认选中当前状态，可直接修改信息。自动触发的目标状态不提供人工选择。'}</div>`,true);
   body+=field('处理提示',`<div class="notice ${to==='closed'?'warn':''}"><span class="info-mark">i</span><span>${e(info)}</span></div>`);
   if(!multi&&to==='wait')body+=field('已R时间 / 时长',`<div class="readonly-line">${date(rs[0].rDate)}　/　已R ${M.daySpan(rs[0].rDate,now)} 天 <span class="muted">（系统带入）</span></div>`);
   body+=processFields(rs[0],draft,multi);
   body+=field('说明',editor('process-note',changed?({service:'可补充待售后核实的事项',wait:'可记录供应反馈及接受继续等待的原因',promised:'可记录供应的承诺内容',business:'可记录升级原因或商务处理结果',chased:'可记录催款邮件主题或发送情况',closed:'可记录核实依据'}[to]||'可补充本次处理说明'):'可补充核实情况、供应回复或处理进展'));
   overlay(modalShell(multi?'批量处理':'处理',body,`<span class="hint">${multi?'全部记录校验通过后统一保存':'带 * 的字段必填，说明选填'}</span><div class="flex"><button data-action="close">取消</button><button class="primary" data-action="save-process">${changed?(multi?'确认流转 '+rs.length+' 笔':'确认流转'):'保存信息'}</button></div>`,'已R未退 · 状态流转处理'));
   $('#process-note').innerHTML=modal.noteHtml||e(modal.note);
 }
 function formError(text){const el=$('#form-error');if(el){el.textContent=text;el.classList.add('visible');el.scrollIntoView({block:'nearest',behavior:'smooth'});}else toast(text,true);}
 function saveProcess(){
   const countField=$('#overlay-root [data-field="count"]');
   if(countField?.validity.badInput)return formError('催款次数必须为非负整数');
   readProcess();
   const {ids,to,from,note,noteHtml}=modal;
   const changed=from!==to,multi=ids.length>1;
   const shared={...currentDraft(),note,noteHtml};
   if(multi){
     if(from!=='finance'||(!changed&&!shared.collector))delete shared.collector;
     if(!shared.category&&!shared.subreason){
       delete shared.category;
       delete shared.subreason;
     }
   }
   const payloads=ids.map(id=>{
     if(!multi||to!=='chased'||shared.count!=='')return shared;
     return {...shared,count:transitionDefaults(getRecord(id),to).count};
   });
   try{
     M.save(records,ids,to,payloads,now);
     persist();
     closeOverlay();
     selected.clear();
     render();
     toast(changed?`${ids.length} 笔记录已流转为「${M.byState[to].label}」`:'信息已保存，当前状态保持不变');
   }catch(err){
     formError(err.message);
   }
 }
 function openBatchCount(){const rs=[...selected].map(getRecord);if(!rs.length)return;modal={type:'count',ids:rs.map(r=>r.id)};overlay(modalShell('批量编辑字段',`<div id="form-error" class="error-banner" role="alert"></div><div class="notice"><span class="info-mark">i</span><span>仅修正催款次数，保持每笔记录的状态和本轮计时不变。${ann(3)}</span></div><div style="margin-top:22px">${field('催款次数',`<input id="batch-count-value" type="number" min="0" step="1" placeholder="输入修正后的次数" aria-label="统一催款次数">`,true)}</div><div class="batch-preview"><div><span>记录 / 乘机人</span><span>当前状态</span><span>当前次数</span></div>${rs.map(r=>`<div><span>${r.id} · ${r.passenger}</span><span>${M.byState[r.state].label}</span><span>${r.count} 次</span></div>`).join('')}</div>`,`<span class="hint">将应用到选中的 ${rs.length} 笔记录</span><div class="flex"><button data-action="close">取消</button><button class="primary" data-action="save-count">保存修改</button></div>`,'可同时修正不同状态记录的次数','medium'));}
 function exportExcel(){
   const rs=selected.size?[...selected].map(getRecord).filter(Boolean):filtered();if(!rs.length)return toast('没有可导出的记录',true);
   try{X.download(X.exportRows(rs),'已R未退_批量流转_'+now.slice(0,10)+'.xlsx',{now});toast(`已导出 ${rs.length} 笔；填写目标状态及必填字段后，可导入批量流转`);}catch(err){toast('导出失败：'+err.message,true);}
 }
 function openExcelImport(){modal={type:'excel',rows:null,results:null,fileName:'',filter:'all',busy:false,completed:false};renderExcelImport();}
 function excelCounts(){return ['valid','error','skip'].map(k=>modal.results?.filter(r=>r.kind===k).length||0);}
 function excelPreviewRow(row) {
   const updated = modal.completed && row.kind === 'valid';
   const labels = {valid: '通过', error: '不通过', skip: '跳过'};
   const current = getRecord(row.id);
   const dates = {promised: row.promise, wait: row.next, chased: row.chaseDate};
   return `<tr data-import-row="${row.line}" class="excel-${row.kind}">
     <td>${row.line}</td><td><strong>${e(row.id)}</strong><small>${e(row.passenger)}</small></td>
     <td>${e(current ? M.byState[current.state].label : row.from)}</td><td>${e(row.to) || '—'}</td>
     <td>${e(dates[row.toId]) || '—'}</td><td>${e(row.role)}<small>${e(row.owner) || '未填写'}</small></td>
     <td><strong>${updated ? '已更新' : labels[row.kind]}</strong><p>${e(updated ? '已保存到跟进记录' : row.message)}</p></td>
   </tr>`;
 }
 function renderExcelImport(){
   const [valid,errors,skipped]=excelCounts(),hasRows=!!modal.results,done=modal.completed;
   const visibleRows = (modal.results || []).filter(row => modal.filter === 'all' || row.kind === modal.filter);
   const filters = [['all','全部结果'],['error','仅不通过'],['valid',done?'仅已更新':'仅可更新'],['skip','仅跳过']];
   const content = hasRows ? `
     <div class="excel-summary"><strong>${e(modal.fileName)}</strong><span>读取 ${modal.results.length} 笔</span><span class="excel-valid">${done?'已更新':'可更新'} ${valid} 笔</span><span class="excel-error">不通过 ${errors} 笔</span><span>跳过 ${skipped} 笔</span></div>
     <div class="excel-filter"><label for="excel-filter">查看</label><select id="excel-filter">${filters.map(([v,l])=>opt(v,l,modal.filter)).join('')}</select><button data-action="excel-feedback">下载校验结果</button><span>修改不通过的行后，可重新导入。</span></div>
     <div class="table-wrap excel-preview"><table>
       <thead><tr><th>Excel行</th><th>记录 / 乘机人</th><th>当前状态</th><th>目标状态</th><th>本次日期</th><th>处理人</th><th>校验结果与处理提示</th></tr></thead>
       <tbody>${visibleRows.map(excelPreviewRow).join('') || '<tr><td colspan="7">该分类没有记录</td></tr>'}</tbody>
     </table></div>` : `
     <div class="excel-help"><h3>填写后再导入</h3>
       <p>目标为“已承诺退款”时，填写供应商承诺的具体退款日期（如 2026-11-30），并核对处理角色和处理人。</p>
       <p>各状态的处理条件和必填项见文件内的“状态与必填规则”。</p>
       <button data-action="excel-export">导出${selected.size?'已选记录':'当前筛选结果'}及填写说明</button>
     </div>`;
   const body=`<div id="form-error" class="error-banner" role="alert"></div><div class="excel-steps"><span>1 导出记录</span><span>2 填写Excel</span><span class="${hasRows?'active':''}">3 校验预览</span><span class="${done?'active':''}">4 确认更新</span></div>
     ${done?`<div class="notice green"><span class="info-mark">✓</span><span>已更新 <strong>${modal.updated}</strong> 笔。${errors} 笔不通过、${skipped} 笔跳过，保持原记录。操作记录已逐笔保存。</span></div>`:`<div class="notice"><span class="info-mark">i</span><span>可混合导入不同的当前状态和目标状态。目标留空的行会跳过。核对预览后，点击“确认更新”提交通过的行。${ann(6)}</span></div>`}
     <div class="excel-upload"><div><label for="excel-file">${hasRows?'重新选择回填文件':'选择回填后的Excel'}</label><small>.xlsx / .xls，最多1000笔、10MB。请选择包含“批量流转”工作表的文件。</small></div><input id="excel-file" type="file" accept=".xlsx,.xls" aria-label="选择回填Excel" ${modal.busy?'disabled':''}></div>
     ${modal.busy?'<p role="status">正在读取并校验文件…</p>':''}
     ${content}`;
   overlay(modalShell('Excel批量流转',body,`<span class="hint">${done?'可关闭弹窗，在列表或详情查看结果':hasRows?'提交时会再次核对记录的最新状态。':''}</span><div class="flex"><button data-action="close">${done?'完成':'取消'}</button>${!done?`<button class="primary" data-action="excel-commit" ${valid&&!modal.busy?'':'disabled'}>确认更新 ${valid} 笔</button>`:''}</div>`,'导出、回填、逐笔校验与更新','excel-modal'));
 }
 async function readExcelFile(file){
   if(!file||modal?.type!=='excel'||!requireEdit())return;
   const current=modal;current.busy=true;current.rows=null;current.results=null;current.completed=false;current.fileName=file.name;current.filter='all';renderExcelImport();
   if(!/\.(xlsx|xls)$/i.test(file.name)||file.size>10*1024*1024){current.busy=false;renderExcelImport();return formError(file.size>10*1024*1024?'文件超过10MB，请拆分后导入。':'请选择.xlsx或.xls文件。');}
   try{
     const buffer=await file.arrayBuffer();if(modal!==current)return;
     current.rows=X.read(buffer);current.results=X.validate(current.rows,records,now);current.busy=false;renderExcelImport();
   }catch(err){if(modal!==current)return;current.busy=false;renderExcelImport();formError('无法导入：'+err.message);}
 }
 function commitExcel(){
   if(modal?.type!=='excel'||!modal.rows||modal.completed)return;
   try{const latest=JSON.parse(localStorage.getItem(KEY));if(latest?.version===2&&Array.isArray(latest.records)&&Array.isArray(latest.tickets)&&latest.config&&!T.validate(latest.config)){records=latest.records;tickets=latest.tickets;config=latest.config;lastCheck=latest.lastCheck||null;now=latest.now||M.NOW;}}catch{}
   const current=X.validate(modal.rows,records,now);
   if(JSON.stringify(current)!==JSON.stringify(modal.results)){modal.results=current;render();renderExcelImport();return formError('部分记录在预览后发生变化，已重新校验。请核对最新结果，再点击“确认更新”。');}
   const valid=current.filter(r=>r.kind==='valid');if(!valid.length)return formError('没有可更新的记录，请修改后重新导入。');
   try{
     M.saveMixed(records,valid.map(r=>({id:r.id,from:r.fromId,to:r.toId,payload:r.payload})),now);
     persist();selected.clear();modal.completed=true;modal.updated=valid.length;render();renderExcelImport();toast(`Excel批量处理完成，已更新 ${valid.length} 笔`);
   }catch(err){formError(err.message);}
 }
 function downloadFeedback(){
   if(!modal.results)return;
   X.download(modal.results.map(r=>({...r,result:modal.completed&&r.kind==='valid'?'已更新':({valid:'通过',error:'不通过',skip:'跳过'}[r.kind]),message:modal.completed&&r.kind==='valid'?'已更新，请勿重复提交':r.message})),'已R未退_校验结果_'+now.slice(0,10)+'.xlsx',{feedback:true,now});
 }
 const annotations=[
  ['来账完结与资金边界','任一非终态下，供应导入或财务手工建立的对应外部退票单匹配 / 关联成功，自动转来账已完结。未关联、仅钱已退回都不能完结；金额差异不阻止完结，后续交差异单流程。批次结算与余额核实不在本模块完成。','主流程：第1节、已确认规则 1、12；G01'],
  ['记录生成与核实时间','乘机人变为已R时只生成内部退票账单。首次等待期限到达且仍未来账，才创建跟进记录，初始待财务核实、催款次数0。通用初始15个自然日；命中特殊规则取其最长天数，未命中才取通用天数。配置变化重算所有尚未建单的票。暂缓核实仅用于建单后再次等待，须手工指定下次核实时间。仅日期截止到当日结束，有时刻按对应时刻判断。','T01、T02、T10、T14、T19、T22'],
  ['催款计数与5日等待','仅实际发送邮件后才能进入已催款。次数默认原值加1，最近催款日期默认当天，两者可人工修正；本轮5个自然日从本次进入时间起算。修改当前信息或单独修正次数不重置计时。系统不读邮箱：超时仍停留已催款，自动转供应反馈异常，即使供应实际已有回复。','T08、T09、T13、T18；无已催款→已催款流转'],
  ['明确承诺与到期判断','接受供应承诺须有明确且尚未到期的日期或时刻。“下期”等说法应先明确日期。只填日期则当天结束后判断；填写时刻则按时刻判断。到期仍未关联外部单，自动转承诺到期未退。“未退”不代表已核实资金未到账。','T11、T15、T17、T20、T23'],
  ['人工流转范围与终态','状态选项仅含当前状态及状态机允许的人工目标。当前状态用于修改信息，不生成自循环流转。来账已完结只能由系统关联结果触发；未R已关闭仅能由财务 / 售后核实进入。两种终态均不回退、不重开。商务拒退或无结果继续商务跟进，不新增放弃追款终态。','主流程：T03—T23；状态定义表'],
  ['批量与并发校验','列表勾选流转用于同一当前状态。日期、处理人等字段只填一次，统一应用到全部所选记录。必填项有不同的默认值时，须填写一个共同值。Excel可逐笔填写不同的值，也支持混合当前状态与目标状态，覆盖所有状态下的合法人工处理；自动流转和终态限制仍遵守既有规则。承诺退款日期、下次核实时间、最近催款时间及处理人等按每笔目标状态校验。页面和 Excel 按目标状态展示处理提示，核对后点击提交。目标留空跳过；校验不通过的行不更新；确认后仅更新通过的行。提交前再次核对导出校验标识、当前状态和外部单关联结果，阻止过期文件及重复导入。生产系统仍须实现真实并发控制。','已确认规则11、12；2026-11-23 Excel批量流转要求'],
  ['处理人与追款负责人','本模块处理人不是原退票处理人。除首次生成可空外，后续保存均需处理角色和处理人。财务角色默认带入供应商对应追款负责人；转售后、商务须指定人员。人员与供应商映射是虚构演示配置，实际按权限及组织配置。','流转表备注、状态定义表；自动流转时按配置分配'],
  ['原型演示与真实系统','原型只在本浏览器保存演示修改，不发送催款邮件，不查询票号、不导入真实账单、不核实资金。可在演示场景中切换账号编辑权限：两个列表入口始终可见，编辑和查看复用同一详情页；编辑需权限，查看始终只读。后台事件可模拟时间到期与外部单关联，真实账号鉴权、定时任务、邮箱、关联接口和并发控制尚未接入。演示时钟固定从2026-11-20 12:00开始。','点击“演示场景”可切换权限、推进时间或演示来账；恢复数据会重置'],
  ['待确认的界面约定','主流程要求问题原因分类及子类，但未给字典，当前选项仅供演示。主流程列有删除入口，未定义业务删除权限、条件及审计方式：本原型仅在二次确认后移除本地示例，可恢复。正式系统的删除规则须另行确认，不代表允许删除真实追款记录。','界面设计：基础信息区、行操作；未扩写正式业务规则'],
  ['首次触发时长规则示例','<strong>单条特殊规则：</strong>通用为15天，只命中一条7天特殊规则时，采用7天；到期仍未来账，创建待财务核实记录，催款次数0。<br><br><strong>多条特殊规则：</strong>供应商甲30天与供应商甲＋非自愿10天同时命中，采用30天；条件更多不代表优先级更高。<br><br><strong>缩短等待期：</strong>一张票已R12天，适用规则由30天改为10天，下次系统检查时若仍未来账，则生成一条待财务核实记录；重复检查不重复建单。<br><br><strong>期限内来账：</strong>对应外部退票单已匹配或关联成功，直接走对账流程，到期不生成已R未退跟进记录。<br><br>以上为后台判断逻辑说明。配置页只维护通用天数和特殊规则，不展示首次等待票、检查结果或模拟操作。','主流程：第1.1、1.2节；T01；配置页界面说明']
 ];
 function drawerShell(title,body,subtitle){return `<div class="veil drawer-veil"><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><h2 id="modal-title">${title}</h2><small>${subtitle}</small></div><button class="icon-button" data-action="close" aria-label="关闭侧栏">×</button></div><div class="modal-body">${body}</div></aside></div>`;}
 let notePopup=null;
 function closeAnnotation(restoreFocus=true){
   const anchor=notePopup?.anchor;notePopup=null;
   $('#annotation-root').replaceChildren();
   if(anchor){anchor.setAttribute('aria-expanded','false');anchor.removeAttribute('aria-controls');}
   if(restoreFocus&&anchor?.isConnected)anchor.focus({preventScroll:true});
 }
 function positionAnnotation(){
   if(!notePopup)return;
   const card=$('#annotation-root .annotation-popover'),anchor=notePopup.anchor;
   if(!card||!anchor?.isConnected){closeAnnotation(false);return;}
   const a=anchor.getBoundingClientRect(),gap=12,pad=12,w=window.innerWidth,h=window.innerHeight;
   if(a.bottom<0||a.top>h||a.right<0||a.left>w){closeAnnotation(false);return;}
   card.style.maxHeight=Math.max(160,h-pad*2)+'px';
   const box=card.getBoundingClientRect();
   const left=Math.max(pad,Math.min(a.left,w-box.width-pad));
   const below=h-a.bottom-gap-pad,above=a.top-gap-pad;
   const top=below>=box.height||below>=above?a.bottom+gap:a.top-box.height-gap;
   card.style.left=left+'px';card.style.top=Math.max(pad,Math.min(top,h-box.height-pad))+'px';
 }
 function showNotes(focus,anchor,catalog=false){
   const n=Number(focus)||(view==='config'?10:1),item=annotations[n-1];if(!item)return;
   anchor=anchor||document.activeElement;catalog=catalog||!focus;
   if(notePopup?.anchor===anchor&&notePopup.number===n&&notePopup.catalog===catalog){closeAnnotation();return;}
   closeAnnotation(false);notePopup={number:n,anchor,catalog};
   const [title,body,source]=item;
   $('#annotation-root').innerHTML=`<section class="annotation-popover" role="dialog" aria-modal="false" aria-labelledby="annotation-title" data-note="${n}"><header class="annotation-popover-head"><span class="annotation-number">${n}</span><h2 id="annotation-title">${e(title)}</h2><button class="icon-button" data-action="close-annotation" aria-label="关闭标注">×</button></header>${catalog?`<div class="annotation-picker"><label for="annotation-choice">选择标注</label><select id="annotation-choice">${annotations.map(([name],i)=>opt(String(i+1),(i+1)+' · '+name,String(n))).join('')}</select></div>`:''}<div class="annotation-popover-body" id="note-${n}" tabindex="0" aria-label="标注${n}说明"><h3>说明</h3><div class="annotation-copy">${safeHtml(body)}</div><div class="annotation-source"><h3>依据</h3><p>${e(source)}</p></div></div></section>`;
   anchor.setAttribute('aria-expanded','true');anchor.setAttribute('aria-controls','annotation-root');positionAnnotation();
   $('#annotation-root [data-action="close-annotation"]').focus({preventScroll:true});
 }

 function showScenes(){
   const writable=canEdit()&&(!detailId||canModifyDetail());modal={type:'scenes'};
   overlay(drawerShell('演示场景',`<div class="notice"><span class="info-mark">i</span><span>27个已有跟进案例覆盖全部11个状态。首次触发的四种规则示例见原型标注10。点击案例打开详情，可编辑账号可体验处理，只有查看权限的账号进入只读模式。</span></div>
   <div class="demo-panel"><h3>首次触发时长</h3><p>修改通用天数和特殊规则，验证首次到期建单及来账免建单。</p><button data-action="config">已R未退触发时长配置</button></div><div class="demo-panel"><h3>账号权限演示${ann(8)}</h3><label for="demo-permission" class="muted">当前演示账号</label><select id="demo-permission">${opt('edit','有编辑权限',permission)}${opt('view','无编辑权限 · 仅查看',permission)}</select><p>列表中的“编辑”和“查看”始终显示，进入的是同一详情页。“编辑”需编辑权限；“查看”始终只读。</p></div>
   <div class="demo-panel"><h3>后台事件演示</h3><label class="muted" style="font-size:11px">演示当前时间（北京时间）</label><input type="datetime-local" id="demo-time" value="${e(now)}" aria-label="演示当前时间" ${writable?'':'disabled'}><div class="flex"><button class="primary" data-action="advance-time" ${writable?'':'disabled'}>执行到期检查</button><button data-action="add-day" ${writable?'':'disabled'}>＋1天</button></div><p>${writable?'模拟首次到期建单、再次核实到期、5日等待超时、承诺到期，以及已关联外部单的优先完结。不读取邮箱。':'当前为只读模式，不能修改演示数据。可切换有编辑权限的账号，并返回列表后演示。'}</p></div>${M.STATES.map(s=>{const rs=records.filter(r=>r.state===s.id);return rs.length?`<section class="scene-section"><h3>${s.label} · ${rs.length} 笔</h3>${rs.map(r=>`<button class="scene-link" data-action="scene-detail" data-id="${r.id}"><span class="scene-no">${r.id}</span><div><strong>${e(r.scene)}</strong><small>${r.passenger} · ${r.supplier}</small></div><span class="muted" style="margin-left:auto">›</span></button>`).join('')}</section>`:'';}).join('')}`,'快速找到场景，查看每一种处理结果'));
 }
 function showBillDemo(id){const r=getRecord(id);modal={type:'bill',id};overlay(modalShell('后台事件演示',`<div id="form-error" class="error-banner" role="alert"></div><div class="notice warn"><span class="info-mark">i</span><span>这是原型演示工具，模拟外部账单系统的结果。不是业务人员手动选择“来账已完结”的入口。${ann(1)}</span></div><div class="delete-context">${r.id} · ${r.passenger} · ${r.ticket}<br>当前状态：${M.byState[r.state].label}<br>内部应退金额：CNY ${r.amount.toFixed(2)}</div>${M.terminal(r.state)?'<div class="notice">当前为终态，停止自动跟进，不允许通过关联事件重开或转换终态。</div>':`${field('外部单来源',`<select id="demo-bill-source" aria-label="外部单来源">${opt('供应导入')}${opt('财务手工建立')}</select>`)}${field('外部单金额',`<input id="demo-bill-amount" type="number" min="0" step="0.01" value="${r.amount}" aria-label="外部单金额">`)}${field('匹配 / 关联结果',`<select id="demo-bill-match" aria-label="匹配关联结果">${opt('matched','匹配 / 关联成功')}${opt('unmatched','账单已存在，但尚未匹配')}</select>`)}<p class="muted" style="font-size:11px">即使金额不一致，只要对应外部单关联成功，也自动完结；仅导入未匹配则保持当前状态。</p>`}`,`<span class="hint">演示事件会写入操作记录</span><div class="flex"><button data-action="close">取消</button><button class="primary" data-action="run-bill" ${M.terminal(r.state)?'disabled':''}>模拟外部单结果</button></div>`,'仅作用于本地演示数据','medium'));}
 function removeMore(){document.querySelector('.more-menu')?.remove();}
 function showMore(button){removeMore();const box=button.getBoundingClientRect(),menu=document.createElement('div');menu.className='more-menu';menu.style.right=Math.max(12,window.innerWidth-box.right)+'px';menu.style.top=Math.min(window.innerHeight-55,box.bottom+4)+'px';menu.innerHTML=`<button class="danger" data-action="delete" data-id="${button.dataset.id}">删除</button>`;document.body.append(menu);}
 function closeOrReturn(){closeOverlay();}
 const writeActions=new Set(['add-rule','remove-rule','save-config','process','batch-transition','batch-count','target','save-process','save-count','excel-import','excel-commit','compose-note','save-note','format','demo-bill','run-bill','advance-time','add-day','delete','confirm-delete','reset','confirm-reset']);
 document.addEventListener('click',event=>{
   const b=event.target.closest('[data-action]');if(!b){if(!event.target.closest('.more-menu'))removeMore();return;}const {action,id}=b.dataset;
   if(action!=='more')removeMore();
   if(writeActions.has(action)){if(!requireEdit())return;if(detailId&&!canModifyDetail())return toast('当前详情为只读查看，请返回列表后从“编辑”入口进入',true);}
   switch(action){
    case 'config':goConfig();break;
    case 'add-rule':{readConfigDraft();configDraft.rules.push({id:'S'+Date.now(),supplier:'',nature:'',airline:'',days:15,enabled:true});$('#rule-rows').innerHTML=configDraft.rules.map(ruleRow).join('');markConfigDirty();break;}
    case 'remove-rule':{readConfigDraft();configDraft.rules=configDraft.rules.filter(r=>r.id!==id);$('#rule-rows').innerHTML=configDraft.rules.map(ruleRow).join('');markConfigDirty();break;}
    case 'save-config':saveConfig();break;
    case 'list':closeOverlay();list();break;
    case 'close':closeOrReturn();break;
    case 'edit-detail':openDetail(id,'edit');break;
    case 'view-detail':openDetail(id,'view');break;
    case 'process':openProcess([id]);break;
    case 'batch-transition':openProcess([...selected]);break;
    case 'excel-export':exportExcel();break;
    case 'excel-import':openExcelImport();break;
    case 'excel-commit':commitExcel();break;
    case 'excel-feedback':downloadFeedback();break;
    case 'target':readProcess();modal.to=b.dataset.target;renderProcess();break;
    case 'save-process':saveProcess();break;
    case 'clear-filters':filters=emptyFilters();page=1;selected.clear();renderList();break;
    case 'clear-selection':selected.clear();renderList();break;
    case 'page':page=Number(b.dataset.page);renderList();break;
    case 'history-tab':historyTab=b.dataset.tab;compose=false;renderDetail();break;
    case 'compose-note':compose=true;renderDetail();$('#detail-note').focus();break;
    case 'cancel-note':compose=false;renderDetail();break;
    case 'save-note':{const el=$('#detail-note'),text=el.innerText.trim();if(!text){toast('请先输入说明内容',true);break;}const r=getRecord(detailId);r.notes.push({at:now,by:'演示操作员',text,html:safeHtml(el.innerHTML)});r.logs.push({at:now,by:'演示操作员',action:'添加说明',detail:'已补充说明，业务状态保持不变。'});persist();compose=false;renderDetail();toast('说明已保存');break;}
    case 'format':document.execCommand(b.dataset.command,false,null);break;
    case 'notes':showNotes(undefined,b,true);break;
    case 'close-annotation':closeAnnotation();break;
    case 'annotation':event.preventDefault();event.stopPropagation();showNotes(b.dataset.n,b);break;
    case 'scenes':showScenes();break;
    case 'scene-detail':openDetail(id,canEdit()?'edit':'view');break;
    case 'batch-count':openBatchCount();break;
    case 'save-count':{const raw=$('#batch-count-value').value,n=Number(raw);if(raw===''||!Number.isInteger(n)||n<0){formError('催款次数必须为非负整数');break;}const count=modal.ids.length;modal.ids.forEach(id=>{const r=getRecord(id),old=r.count;r.count=n;r.logs.push({at:now,by:'演示操作员',action:'修正催款次数',detail:old+' → '+n+'；状态和本轮计时保持不变。'});});persist();selected.clear();closeOverlay();render();toast(count+' 笔记录的催款次数已修改');break;}
    case 'advance-time':{if(!requireSavedConfig())break;const value=$('#demo-time').value;executeTriggerCheck(value);showScenes();break;}
    case 'add-day':$('#demo-time').value=M.addDays($('#demo-time').value||now,1);break;
    case 'demo-bill':showBillDemo(id);break;
    case 'run-bill':{const r=getRecord(modal.id),raw=$('#demo-bill-amount').value,amount=Number(raw);if(raw===''||!Number.isFinite(amount)||amount<0){formError('请输入有效的外部单金额');break;}if(M.terminal(r.state)){formError('终态不允许再次处理');break;}r.bill={number:'DEMO-EXT-'+r.id,source:$('#demo-bill-source').value,amount,matched:$('#demo-bill-match').value==='matched'};r.logs.push({at:now,by:'系统（演示）',action:'收到外部退票单结果',detail:r.bill.source+' · '+(r.bill.matched?'匹配 / 关联成功':'已存在但未匹配，保持原状态')});const sourceTicket=tickets.find(t=>t.id===r.sourceTicketId);if(sourceTicket)sourceTicket.bill=M.clone(r.bill);if(r.bill.matched)M.runAuto([r],now);persist();closeOverlay();render();toast(r.bill.matched?'外部单已关联，系统自动转为来账已完结':'外部单尚未匹配，当前状态保持不变');break;}
    case 'more':showMore(b);break;
    case 'delete':{const r=getRecord(id);modal={type:'delete',id};overlay(modalShell('删除这条演示记录？',`<div class="notice warn"><span class="info-mark">i</span><span>文档尚未定义正式删除规则。本操作只移除本地演示数据，可通过“恢复演示数据”找回。${ann(9)}</span></div><div class="delete-context">${r.id} · ${r.passenger}<br>${r.order}<br>当前状态：${M.byState[r.state].label}</div>`,`<span class="hint">不会删除任何真实业务单据</span><div class="flex"><button data-action="close">取消</button><button class="primary" data-action="confirm-delete">删除演示记录</button></div>`,'','small'));break;}
    case 'confirm-delete':records=records.filter(r=>r.id!==modal.id);selected.delete(modal.id);persist();closeOverlay();list();render();toast('已删除本地演示记录');break;
    case 'reset':modal={type:'reset'};overlay(modalShell('恢复初始演示数据？',`<p style="line-height:1.9;color:#75869c">将恢复27条已有跟进记录、6笔首次触发示例和通用15天及4条演示特殊规则，并把演示时间重置为2026-11-20 12:00。当前浏览器中的配置、流转、说明和删除操作会被清除。</p>`,`<span></span><div class="flex"><button data-action="close">取消</button><button class="primary" data-action="confirm-reset">恢复演示数据</button></div>`,'','small'));break;
    case 'confirm-reset':records=M.seed();tickets=T.seedTickets();config=T.seedConfig();configDraft=null;lastCheck=null;view='list';now=M.NOW;selected.clear();filters=emptyFilters();page=1;persist();closeOverlay();detailId=null;location.hash='list';render();toast('已恢复跟进记录、首次触发示例、配置与演示时间');break;
   }
 });
 document.addEventListener('pointerdown',event=>{
   if(notePopup&&!event.target.closest('.annotation-popover,[data-action="annotation"],[data-action="notes"]'))closeAnnotation(false);
 },true);
 document.addEventListener('mousedown',event=>{if(event.target.closest('[data-action="format"]'))event.preventDefault();});
 document.addEventListener('submit',event=>{if(event.target.id==='search-form'){
   event.preventDefault();const fd=new FormData(event.target),next={...filters};filterFields.forEach(k=>next[k]=String(fd.get(k)||''));
   let error='';
   if(next.rFrom&&next.rTo&&next.rFrom>next.rTo)error='已R时间的开始日期不能晚于结束日期。';
   for(const [min,max,label] of [['daysMin','daysMax','已R时长'],['countMin','countMax','催款次数']]){
     if([next[min],next[max]].some(v=>v!==''&&(!Number.isInteger(Number(v))||Number(v)<0)))error=label+'须填写非负整数。';
     else if(next[min]!==''&&next[max]!==''&&Number(next[min])>Number(next[max]))error=label+'的最小值不能大于最大值。';
   }
   if(error){$('#search-error').textContent=error;$('#search-error').hidden=false;return;}
   filters=next;page=1;selected.clear();renderList();
 }});
 document.addEventListener('input',event=>{if(event.target.closest('#config-fields'))markConfigDirty();});
 document.addEventListener('change',event=>{
   const el=event.target;
   if(el.id==='excel-file'){readExcelFile(el.files[0]);return;}
   if(el.id==='excel-filter'&&modal?.type==='excel'){modal.filter=el.value;renderExcelImport();return;}
   if(el.id==='annotation-choice'&&notePopup){if(Number(el.value)!==notePopup.number)showNotes(el.value,notePopup.anchor,true);return;}
   if(el.closest('#config-fields'))markConfigDirty();
   if(el.id==='demo-permission'){permission=el.value;try{localStorage.setItem(KEY+'-permission',permission);}catch{}if(detailId&&detailMode==='edit'&&!canEdit()){detailMode='view';compose=false;history.replaceState(null,'','#detail/'+detailId+'?mode=view');}render();showScenes();toast('当前演示账号：'+(canEdit()?'有编辑权限':'无编辑权限，仅可查看'));}
   if(el.matches('[data-select]')){el.checked?selected.add(el.dataset.select):selected.delete(el.dataset.select);renderList();}
   if(el.id==='select-page'){filtered().slice((page-1)*pageSize,page*pageSize).forEach(r=>el.checked?selected.add(r.id):selected.delete(r.id));renderList();}
   if(el.id==='page-size'){pageSize=Number(el.value);page=1;renderList();}
   if(el.matches('[data-role-select]')){const fields=el.closest('[data-process-fields]'),owner=fields.querySelector('[data-field="owner"]');owner.innerHTML=opt('',owner.options[0].textContent)+(M.PEOPLE[el.value]||[]).map(p=>opt(p)).join('');}
   if(el.matches('[data-category-select]')){const fields=el.closest('[data-process-fields]');fields.querySelector('[data-field="subreason"]').value='';fields.querySelector('datalist').innerHTML=(M.REASONS[el.value]||[]).map(s=>`<option value="${e(s)}">`).join('');}
   if(el.matches('[data-date-mode]')){const input=el.parentElement.querySelector('input'),old=input.value;input.type=el.value;input.value=old?(el.value==='date'?old.slice(0,10):(old.includes('T')?old:old+'T18:00')):'';}
 });
 document.addEventListener('keydown',event=>{
   if((event.key==='Enter'||event.key===' ')&&event.target.matches('.annotation')){event.preventDefault();event.target.click();return;}
   if(notePopup){
     if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeAnnotation();return;}
     if(event.key==='Tab'){
       const controls=$$('#annotation-root button,#annotation-root select,#annotation-root [tabindex="0"]').filter(x=>x.getClientRects().length),first=controls[0],last=controls.at(-1);
       if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
       return;
     }
   }
   if(event.key==='Escape'){removeMore();if($('#overlay-root').children.length)closeOrReturn();}
   if(event.key==='Tab'&&$('#overlay-root').children.length){const focusable=$$('#overlay-root button:not([disabled]),#overlay-root input,#overlay-root select,#overlay-root [contenteditable="true"],#overlay-root summary,#overlay-root .annotation').filter(x=>x.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
 });
 window.addEventListener('resize',positionAnnotation);
 window.addEventListener('scroll',event=>{if(!event.target.closest?.('.annotation-popover'))positionAnnotation();},{capture:true,passive:true});
 window.addEventListener('hashchange',()=>{historyTab='notes';compose=false;route();});
 window.addEventListener('scroll',removeMore,{passive:true});
 route();
})();
