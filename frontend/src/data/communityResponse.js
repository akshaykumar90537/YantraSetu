export function validateCommunityResponse(path,data){
 const object=data!==null && typeof data==='object' && !Array.isArray(data);
 let valid;
 if(path==='/demand') valid=object&&Array.isArray(data.summary)&&Array.isArray(data.mine);
 else if(path==='/notification-preferences') valid=object&&typeof data.reminders==='boolean';
 else if(path==='/capabilities') valid=object&&typeof data.admin==='boolean';
 else if(path==='/pilot-metrics') valid=object&&data.bookings&&data.average_response_minutes&&data.repeat_farmers&&Array.isArray(data.support);
 else valid=Array.isArray(data);
 if(!valid)throw new Error('This section returned an unexpected response. Please retry.');
 return data;
}
