(function(){
 "use strict";
 document.querySelectorAll("[data-community-form]").forEach(function(form){
   form.addEventListener("submit",async function(event){
     event.preventDefault();
     var status=form.querySelector(".status"),button=form.querySelector("button[type=submit]");
     if(!form.reportValidity())return;
     var fields=new FormData(form);
     var name=String(fields.get("name")||"").trim();
     var email=String(fields.get("email")||"").trim();
     var city=String(fields.get("city")||"").trim();
     var note=String(fields.get("note")||"").trim();
     if(name.length<2||city.length<2||note.length<20||!fields.get("consent")){
       status.textContent="Please complete the required fields and consent checkbox.";return;
     }
     button.disabled=true;status.textContent="Sending…";
     var role=form.getAttribute("data-community-form");
     var payload={name:name,email:email,topic:role==="coordinator"?
       "Community-circle pilot — volunteer interest":"Community-circle pilot — family interest",
       kind:"support",message:"City/town: "+city+"\nRole: "+role+"\nMessage: "+note};
     try{
       var response=await fetch("/api/amanikah/tickets",{
         method:"POST",credentials:"same-origin",
         headers:{"Accept":"application/json","Content-Type":"application/json"},
         body:JSON.stringify(payload)
       });
       var data=await response.json();
       if(!response.ok||!data.ok)throw Error(data.message||data.code||"Please try again.");
       status.textContent="Thank you. Your expression of interest was received. Reference: "+data.reference+
         ". This is not a matchmaking registration, mosque partnership or promise of an introduction.";
       form.reset();
     }catch(e){status.textContent="We could not accept this request: "+e.message;}
     finally{button.disabled=false;}
   });
 });
})();