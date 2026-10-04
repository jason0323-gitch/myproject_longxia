(function(){
 const oldHash=location.hash.match(/^#entry-(\d{2})$/);
 const oldLinks=document.querySelectorAll('[data-legacy]');
 if(oldHash&&oldLinks.length){const a=document.querySelector('[data-legacy="'+oldHash[1]+'"]');if(a)location.replace(a.getAttribute('href'));}
 const field=document.getElementById('book-search'), output=document.getElementById('search-results'), count=document.getElementById('search-count'), data=document.getElementById('search-data');
 if(field&&output&&data){const items=JSON.parse(data.textContent);let frame;
 field.addEventListener('input',()=>{clearTimeout(frame);frame=setTimeout(()=>{let q=field.value.trim().toLocaleLowerCase();output.replaceChildren();if(!q){count.textContent='按章节浏览，或输入关键词查找条目标题';return;}const found=items.filter(x=>(x.title+' '+x.chapter).toLocaleLowerCase().includes(q));count.textContent='找到 '+found.length+' 条'+(found.length>60?'，显示前60条；可继续缩小关键词':'');for(const x of found.slice(0,60)){let li=document.createElement('li'),a=document.createElement('a'),small=document.createElement('small');a.href=x.href;a.textContent=x.title;small.textContent=x.chapter+' · 第'+x.number+'条';a.append(small);li.append(a);output.append(li);}},100);});}
})();
