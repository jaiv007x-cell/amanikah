/* Amanikah verified-member family assistant and private voice UI. */
(function(){
 "use strict";
 var $=function(id){return document.getElementById(id);};
 var globals=$("globalStatus"), studio=$("studio");
 var token="";try{token=sessionStorage.getItem("amanikah.session")||"";}catch(e){}
 var audioBlob=null, recorder=null, stream=null, timer=null, startMs=0, audioURL=null, recordingSeconds=0;
 function say(id,text){$(id).textContent=text;}
 function setAudioURL(url){if(audioURL) URL.revokeObjectURL(audioURL);audioURL=url; $("preview").src=url||"";$("preview").hidden=!url;}
 async function api(path,opts){
   opts=opts||{};
   var r=await fetch("/api/amanikah"+path,{method:opts.method||"GET",
     headers:Object.assign({"Accept":"application/json","Authorization":"Bearer "+token},opts.headers||{}),
     body:opts.body,credentials:"same-origin",cache:"no-store"});
   var body=await r.json().catch(function(){return {ok:false,code:"BAD_RESPONSE"};});
   if(!r.ok||!body.ok)throw new Error(body.message||body.code||"Request failed.");
   return body;
 }
 async function jsonApi(path,body){
   return api(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{})});
 }
 async function init(){
   if(!token){globals.textContent="Please sign in and verify your email before using these private tools.";return;}
   try{
     var me=await api("/me");
     if(!me.member || !me.member.emailVerified || (me.member.consent&&me.member.consent.withdrawn))throw new Error("Verified consent is required.");
     globals.textContent="Signed in as "+me.member.email+" · Information stays private until you authorize sharing.";
     studio.hidden=false;
     await Promise.all([refreshFamily(),refreshVoice()]);
   }catch(e){globals.textContent="Private workspace unavailable: "+e.message;}
 }
 $("ask").addEventListener("click",async function(){
   say("guideStatus","Preparing…");$("ask").disabled=true;
   try{
     var reply=await jsonApi("/me/family/assistant",{
       topic:$("topic").value,lang:$("lang").value,note:$("note").value,
       consentToAI:$("aiConsent").checked
     });
     $("guideOutput").textContent=(reply.items||[]).map(function(s,i){return (i+1)+". "+s;}).join("\n\n");
     $("guideOutput").dir=$("lang").value==="ur"?"rtl":"ltr";
     $("copyGuide").disabled=false;
     say("guideStatus",(reply.mode==="ai_generated"?"AI-generated discussion prompts. ":"Guided checklist (not AI). ")+(reply.notice||""));
   }catch(e){say("guideStatus",e.message);}
   $("ask").disabled=false;
 });
 $("copyGuide").addEventListener("click",async function(){
   try{await navigator.clipboard.writeText($("guideOutput").textContent);say("guideStatus","Copied.");}
   catch(e){say("guideStatus","Select and copy the text manually.");}
 });
 async function refreshFamily(){
   try{
     var response=await api("/me/family");
     var sent=$("sentList"),inbox=$("inbox");sent.replaceChildren();inbox.replaceChildren();
     if(!response.sent.length){var li=document.createElement("li");li.textContent="You have not shared anything.";sent.appendChild(li);}
     response.sent.forEach(function(item){
       var li=document.createElement("li"),span=document.createElement("span");
       span.textContent=item.email+" · "+(item.revoked?"Revoked":item.accepted?"Accepted":"Pending")+" · "+item.scopes.join(", ");
       li.appendChild(span);
       if(!item.revoked){var button=document.createElement("button");button.className="secondary";button.textContent="Revoke";button.onclick=async function(){
         if(!confirm("Remove this person's access immediately?"))return;
         try{await jsonApi("/me/family/revoke",{invitationId:item.id});await refreshFamily();say("familyStatus","Access revoked.");}
         catch(e){say("familyStatus",e.message);}
       };li.appendChild(button);}
       sent.appendChild(li);
     });
     if(!response.received.length){var n=document.createElement("li");n.textContent="No family invitations.";inbox.appendChild(n);}
     response.received.forEach(function(item){
       var li=document.createElement("li"),info=document.createElement("span");
       info.textContent="From verified member "+item.ownerId.slice(-8)+" · "+item.scopes.join(", ")+" · "+(item.accepted?"Accepted":"Awaiting your approval");
       li.appendChild(info);
       if(!item.accepted){
         ["Accept","Decline"].forEach(function(label){
           var b=document.createElement("button");b.className=label==="Decline"?"secondary":"";
           b.textContent=label;b.onclick=async function(){
             try{await jsonApi("/me/family/respond",{invitationId:item.id,accept:label==="Accept"});await refreshFamily();}
             catch(e){say("familyStatus",e.message);}
           };li.appendChild(b);
         });
       }else{
         var b=document.createElement("button");b.textContent="View permitted information";b.className="secondary";b.onclick=async function(){
           try{
             var r=await api("/me/family/shared/"+encodeURIComponent(item.ownerId));
             var out=["Details shared with your permission:"];
             Object.keys(r.shared||{}).forEach(function(k){out.push(k+": "+r.shared[k]);});
             if(r.voiceAvailable){out.push("Voice permission granted; authorized playback available through your browser.");}
             $("sharedInfo").textContent=out.join("\n")||"No details shared.";
           }catch(e){$("sharedInfo").textContent=e.message;}
         };li.appendChild(b);
         if(item.scopes.includes("voice")){
           var play=document.createElement("button");play.textContent="Play authorized voice";play.className="secondary";
           play.onclick=async function(){await fetchVoice("/me/voice/received/"+encodeURIComponent(item.ownerId));};
           li.appendChild(play);
           var report=document.createElement("button");report.textContent="Report recording";report.className="secondary";
           report.onclick=async function(){
             var reason=prompt("Describe why this recording should be reviewed (at least 20 characters).");
             if(!reason)return;
             try{
               var feedback=await jsonApi("/me/voice/report",{memberId:item.ownerId,reason:reason});
               say("familyStatus","Safety report accepted. Reference: "+(feedback.reference||"pending"));
             }catch(e){say("familyStatus",e.message);}
           };li.appendChild(report);
         }
         var block=document.createElement("button");block.textContent="Block member";block.className="secondary";
         block.onclick=async function(){
           if(!confirm("Block this member and immediately prevent mutual family access?"))return;
           try{await jsonApi("/me/family/block",{memberId:item.ownerId});say("familyStatus","Member blocked.");await refreshFamily();}
           catch(e){say("familyStatus",e.message);}
         };li.appendChild(block);
       }
       inbox.appendChild(li);
     });
   }catch(e){say("familyStatus",e.message);}
 }
 $("invite").addEventListener("click",async function(){
   var scopes=[];
   if($("scopeCity").checked)scopes.push("city");
   if($("scopeIntentions").checked)scopes.push("intentions");
   if($("scopeVoice").checked)scopes.push("voice");
   if(!scopes.length){say("familyStatus","Select at least one permission.");return;}
   try{var r=await jsonApi("/me/family/invite",{email:$("familyEmail").value,scopes:scopes});
       say("familyStatus",r.message||"Invitation submitted.");await refreshFamily();}
   catch(e){say("familyStatus",e.message);}
 });
 $("refresh").addEventListener("click",refreshFamily);
 function findMime(){
   if(!window.MediaRecorder)return "";
   return ["audio/webm;codecs=opus","audio/mp4","audio/webm","audio/ogg"].find(function(m){return MediaRecorder.isTypeSupported(m);})||"";
 }
 $("start").addEventListener("click",async function(){
   if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){say("voiceStatus","This browser does not support microphone recording.");return;}
   var mime=findMime();
   if(!mime){say("voiceStatus","No supported recording format available in this browser.");return;}
   try{
     stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
     var parts=[]; recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:32000});
     recorder.ondataavailable=function(e){if(e.data.size)parts.push(e.data);};
     recorder.onerror=function(){say("voiceStatus","Recording error; please retry.");};
     recorder.onstop=function(){
       stream.getTracks().forEach(function(t){t.stop();});stream=null;
       clearInterval(timer);$("start").disabled=false;$("stop").disabled=true;
       audioBlob=new Blob(parts,{type:mime.split(";")[0]});
       if(audioBlob.size>2000000){say("voiceStatus","Recording exceeded 2 MB. Please retry.");audioBlob=null;return;}
       setAudioURL(URL.createObjectURL(audioBlob));$("save").disabled=recordingSeconds<1;
       say("voiceStatus","Recording ready for private preview. Save it when you're comfortable.");
     };
     recordingSeconds=0;startMs=Date.now();recorder.start(250);$("start").disabled=true;$("stop").disabled=false;$("save").disabled=true;
     say("voiceStatus","Recording… speak naturally.");timer=setInterval(function(){
       recordingSeconds=(Date.now()-startMs)/1000; say("timer",Math.floor(recordingSeconds)+" seconds / 45 seconds");
       if(recordingSeconds>=45 && recorder&&recorder.state==="recording")recorder.stop();
     },200);
   }catch(e){say("voiceStatus","Microphone access was not granted or the recorder failed.");}
 });
 $("stop").addEventListener("click",function(){if(recorder&&recorder.state==="recording")recorder.stop();});
 $("save").addEventListener("click",async function(){
   if(!audioBlob)return;
   $("save").disabled=true;say("voiceStatus","Validating and saving your private recording…");
   try{
     var r=await api("/me/voice",{method:"POST",headers:{"Content-Type":audioBlob.type},body:audioBlob});
     say("voiceStatus","Saved privately ("+r.seconds+" seconds).");await refreshVoice();
   }catch(e){say("voiceStatus",e.message);$("save").disabled=false;}
 });
 async function refreshVoice(){
   try{var r=await api("/me/voice");$("playSaved").disabled=!r.recording;$("removeVoice").disabled=!r.recording;
      if(r.recording)say("voiceStatus","Private recording saved: "+r.recording.seconds+" seconds.");}
   catch(e){say("voiceStatus",e.message);}
 }
 async function fetchVoice(path){
   try{
     var response=await fetch("/api/amanikah"+path,{headers:{"Authorization":"Bearer "+token},cache:"no-store"});
     if(!response.ok)throw new Error("Voice access denied or recording unavailable.");
     var blob=await response.blob();
     var player=$("preview");
     setAudioURL(URL.createObjectURL(blob));player.hidden=false;
     await player.play();
     say("voiceStatus","Playing a recording authorized for your account.");
   }catch(e){say("voiceStatus",e.message);}
 }
 $("playSaved").addEventListener("click",function(){fetchVoice("/me/voice/audio");});
 $("removeVoice").addEventListener("click",async function(){
   if(!confirm("Delete your saved voice recording? This cannot be undone."))return;
   try{await jsonApi("/me/voice/delete",{});setAudioURL(null);audioBlob=null;await refreshVoice();say("voiceStatus","Your recording was deleted.");}
   catch(e){say("voiceStatus",e.message);}
 });
 window.addEventListener("pagehide",function(){if(stream)stream.getTracks().forEach(function(t){t.stop();});if(audioURL)URL.revokeObjectURL(audioURL);});
 init();
})();
