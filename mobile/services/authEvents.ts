type Listener=()=>void; const listeners=new Set<Listener>();
export const authEvents={subscribe(listener:Listener){listeners.add(listener);return()=>{listeners.delete(listener)}},expired(){listeners.forEach(listener=>listener())}};
